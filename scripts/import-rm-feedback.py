"""Compile supplied sales-feedback PDFs into checked-in snapshots; never modify CRM records.

Usage: python scripts/import-rm-feedback.py <source-directory>
Dependencies (import time only): pypdf, pymupdf. Runtime needs neither Python nor PDFs.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

import fitz
from pypdf import PdfReader

NAMES = ['Ketan Bhatt', 'Anil Jena', 'Gowri Shankar', 'Harsh Shah', 'Jithin Thomas',
         'Nazmul Islam', 'Pradeep Mulik', 'Rais Khan', 'Sourav Ranjit',
         'V Ramesh Kumar', 'Vilas Kharabe', 'YP Sharma']
MONTHS = ['Apr', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
NUMBER = re.compile(r'-?\d[\d,]*(?:\.\d+)?%?|(?<!\S)-(?!\S)')


def number(value):
    value = (value or '').strip().replace(',', '').replace('%', '')
    return None if value in ('', '-') else float(value)


def compile_report(path, name):
    reader = PdfReader(str(path))
    if len(reader.pages) != 1:
        raise ValueError(f'{path.name}: expected one source page; review new layout')
    text = reader.pages[0].extract_text(extraction_mode='layout')
    lines = text.splitlines()
    header = next(line for line in lines if 'RM Code' in line)
    code = re.search(r'RM Code\s+(\d+)', header).group(1)
    date = re.search(r'\d{2}\.\d{2}\.\d{4}', header).group()
    if date != '30.09.2026':
        raise ValueError(f'{path.name}: review financial year for {date}')
    city = re.search(r'Operting\s+(.+)$', header).group(1).strip()
    source_name = re.sub(r'\b(?:Regional|Manager)\b', '', header.split(date)[1].split('RM Code')[0]).strip()
    target_line = next(line for line in lines if re.match(r'^\s*Target\s+\d', line))
    ends = [match.end() for match in NUMBER.finditer(target_line)]
    if len(ends) != 13:
        raise ValueError(f'{path.name}: expected annual total and 12 target columns')

    def row(line):
        result = [None] * 13
        occupied = set()
        for match in NUMBER.finditer(line):
            if match.end() < ends[0] - 8:
                continue  # e.g. the week number in the row label
            column = min(range(13), key=lambda i: abs(ends[i] - match.end()))
            if column in occupied or abs(ends[column] - match.end()) > 8:
                raise ValueError(f'{path.name}: ambiguous numeric alignment: {line}')
            occupied.add(column)
            result[column] = number(match.group())
        return result

    target = row(target_line)
    actual = row(next(line for line in lines if re.match(r'^\s*Achieved\s+\d', line)))
    pct = row(next(line for line in lines if re.match(r'^\s*% Achieve', line)))
    variation = row(next(line for line in lines if re.match(r'^\s*Variation', line)))
    annual_rows = re.findall(r'(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+)%', text.split('Monthly Sales Target')[0])
    if len(annual_rows) != 2:
        raise ValueError(f'{path.name}: expected two annual summary rows')
    current, previous = [[float(value) for value in entry] for entry in annual_rows]
    monthly = [dict(month=label, period=f'{2026 if i < 9 else 2027}-{(i + 3) % 12 + 1:02}', target=target[i+1], achieved=actual[i+1], pct=pct[i+1], variation=variation[i+1]) for i, label in enumerate(MONTHS)]
    weekly = []
    for week in range(1, 5):
        targets = row(next(line for line in lines if re.match(rf'^\s*Wk {week} Target', line)))
        achieved = row(next(line for line in lines if re.match(rf'^\s*Wk {week}\s+(?!Target)\S', line)))
        weekly.append(dict(weekLabel=f'Wk {week}', targetTotal=targets[0], achievedTotal=achieved[0], targets=targets[1:], achieved=achieved[1:]))
    prior = [row(line) for line in lines if re.match(r'^\s*Previous year\s+\d', line)]
    if len(prior) != 2:
        raise ValueError(f'{path.name}: previous-year rows need review')

    doc = fitz.open(str(path))
    page = doc[0]
    top = next(table for table in page.find_tables().tables if table.bbox[1] < 60)
    rows = top.extract()
    x0, _, x1, _ = top.bbox
    width = x1 - x0

    def find_row(label):
        return next(i for i, cells in enumerate(rows) if label in ' '.join(str(cell or '') for cell in cells))

    def cell_text(index, left, right):
        bounds = top.rows[index].bbox
        return page.get_textbox(fitz.Rect(x0 + left * width + .7, bounds[1] + .5, x0 + right * width - .7, bounds[3] - .5)).strip()

    team_index = find_row('Team Mates')
    territory_index = find_row('Existing Sales Territory')
    dealer_index = find_row('New Dealer or Customer')
    expansion_index = find_row('Expansion')
    visits_index = find_row('Visits made')
    thrust_indexes = [i for i, cells in enumerate(rows) if any('Thrust' in str(cell) and 'Product' in str(cell) and 'Actual' not in str(cell) for cell in cells)]
    def thrust_text(index, label):
        column = next(j for j, value in enumerate(rows[index]) if label in str(value))
        bounds = top.rows[index].cells[column]
        return page.get_textbox(fitz.Rect(x0 + .15 * width + .7, bounds[1] + .5, x1 - .7, bounds[3] - .5)).strip()
    thrust_groups = [dict(productsText=thrust_text(i, 'Thrust'), achievedText=thrust_text(i+1, 'YTD')) for i in thrust_indexes]
    registration = cell_text(dealer_index, .455, .665)
    codes = re.findall(r'\b\d{4}[A-Z]\d{3}\b', registration)
    team_line_index = next(i for i, line in enumerate(lines) if re.match(r'^\s*Team Mates', line))
    city_line_index = next(i for i, line in enumerate(lines) if re.match(r'^\s*Existing Sales Territory', line))
    # A vertically centered territory label can follow the first city line.
    # The blank row after team names marks the boundary in these supplied PDFs.
    team_end = next((i for i in range(team_line_index + 1, city_line_index + 1) if not lines[i].strip()), city_line_index)
    tech_start = lines[team_line_index].find('Tech Serv')
    if tech_start < 0:
        raise ValueError(f'{path.name}: technical-service boundary needs review')
    anchors = [match.start() for match in re.finditer(r'\S+(?: \S+)*', lines[team_line_index]) if 30 <= match.start() < tech_start]
    def column_parts(line, anchor):
        return [match.group().strip() for match in re.finditer(r'\S+(?: \S+)*', line)
                if 30 <= match.start() < tech_start and min(anchors, key=lambda value: abs(value-match.start())) == anchor]
    team_entries = []
    for i, anchor in enumerate(anchors):
        name_parts = [part for line in lines[team_line_index:team_end] for part in column_parts(line, anchor)]
        territory_parts = []
        for line in lines[team_end:]:
            if re.match(r'^\s*\d+\.\d+\s+Thrust', line):
                break
            territory_parts.extend(column_parts(line, anchor))
        team_entries.append(dict(name=' '.join(part for part in name_parts if part), citiesCovered=' '.join(part for part in territory_parts if part)))
    notes = text.split('Special Achievement')[-1].replace('and Other Notes', '').strip()
    warnings = []
    for label, values, printed in [('monthly achieved', actual[1:], actual[0]), ('previous-year actual', prior[1][1:], prior[1][0])]:
        calculated = round(sum(value for value in values if value is not None), 2)
        if printed is not None and abs(calculated - printed) > .06:
            warnings.append(f'Source {label} total {printed:.2f} differs from visible monthly sum {calculated:.2f}; printed values retained.')
    data = dict(id=re.sub('[^a-z0-9]', '', name.lower()), reportDate=date, asOf='2026-09-30', financialYear='2026-27', units='INR lakh',
        source=dict(kind='supplied_pdf_snapshot', fileName=path.name, sha256=hashlib.sha256(path.read_bytes()).hexdigest(), page=1),
        rm=dict(name=name, sourceName=source_name, rmCode=code, operatingFrom=city, businessRegistrationForm='Yes' if re.search(r'\bYes\b', registration) else None, registrationCodes=codes),
        annual=dict(currentYearTarget=current[0], currentYearTargetTillMonth=current[1], currentYearActual=current[2], currentYearPct=current[3], lastYearTarget=previous[0], lastYearTargetTillMonth=previous[1], lastYearActual=previous[2], lastYearPct=previous[3]),
        monthlyMetrics=monthly, monthlyTotals=dict(target=target[0], achieved=actual[0], pct=pct[0], variation=variation[0]), weeklySummary=weekly,
        previousYearPerformance=[dict(month=label, target=prior[0][i+1], actual=prior[1][i+1]) for i, label in enumerate(MONTHS)], previousYearTotals=dict(target=prior[0][0], actual=prior[1][0]),
        territoryExpansion=dict(targetExpansionCities=cell_text(expansion_index, .15, .665), visitsMade=cell_text(visits_index, .15, .665), newDealersText=cell_text(dealer_index, .15, .455)),
        teamSourceText=cell_text(team_index, .15, .802), territoriesSourceText=cell_text(territory_index, .15, .802),
        teamEntries=team_entries, thrustTotalLakh=number(rows[thrust_indexes[0]][0]),
        technicalService=dict(center=cell_text(team_index, .875, 1), executive=cell_text(territory_index, .875, 1)),
        thrustProductGroups=thrust_groups, specialAchievementsNotes=notes, sourceWarnings=warnings, sourceText=text)
    doc.close()
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    sources = list(args.directory.glob('PSS*Sales Feedback.pdf'))
    reports = []
    for name in NAMES:
        matches = [path for path in sources if name in path.name]
        if len(matches) != 1:
            raise ValueError(f'Expected exactly one supplied PDF for {name}')
        reports.append(compile_report(matches[0], name))
    output = Path(__file__).resolve().parents[1] / 'server' / 'data' / 'rm-feedback-snapshots.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(dict(schemaVersion=1, reports=reports), indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'Compiled {len(reports)} supplied snapshots to {output.relative_to(output.parents[2])}')
    for report in reports:
        print(report['rm']['name'], report['rm']['rmCode'], report['annual']['currentYearActual'], f"source warnings={len(report['sourceWarnings'])}")


if __name__ == '__main__':
    main()
