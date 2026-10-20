// Evidence-based Phase 8 decisions. Run with --write to update repository matrices.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const notes = {
 A01:'Authenticated dashboard APIs pass; actual dashboard rendering/navigation and clean initialization remain unaccepted.',
 A02:'Net invoice and explicit target calculations pass P2/P4; earlier double-counting finding is superseded. Live control totals, target coverage and UI acceptance remain.',
 A03:'MTD/FYTD and fiscal-boundary fixtures pass; daily/all-screen period parity and date-preset defect UAT-02 remain.',
 A04:'Visits, attendance and logged-call metrics persist in P5/P8; complete browser activity/coverage acceptance remains.',
 A05:'Coordinates and accuracy are captured/validated synthetically; map rendering, GPS permission, staleness and device accuracy remain unverified.',
 A06:'RM directory and unique owner mapping are implemented; authoritative client roster and aliases require approval.',
 A07:'Score-only ascending ranking and missing-target placement pass P4; displayed order requires browser acceptance.',
 A08:'Target-based ranking replaces revenue fallback and passes P4; live targets/mapping and displayed ranking require acceptance.',
 A09:'Evidence-linked prioritized management actions exist and P4 helpers pass; thresholds and browser workflow remain pending.',
 A10:'Attention APIs and deduplication pass P2/P4; attention-card rendering and client policy acceptance remain.',
 A11:'Team links preserve financial year in source; actual click-through and report rendering are NOT VERIFIED.',
 A12:'Logged calls and visits now persist in P5/P8; telephony verification, complete consolidated UI and client scope remain pending.',
 B01:'MTD explicit target/actual and no-target behavior pass P2/P3; production target coverage and browser acceptance remain.',
 B02:'FYTD actual/target agrees with management attention in P2; production target coverage and period acceptance remain.',
 B03:'Shared explicit-lakh target calculation passes P2/P3; mixed-unit profile targets are withheld. Client target reconciliation remains.',
 B04:'Zero-sales months and comparable-period product trends implemented; full chart rendering and live history remain unverified.',
 B05:'Admin detail now counts team-owned visits by business date without the old customer OR predicate; source reviewed, full report/device acceptance remains.',
 B06:'Admin detail now counts call/incoming/outgoing activities and P5/P8 verify call persistence; report-card browser acceptance remains.',
 B07:'Persisted planned/completed classification passes P4/P5/P8; no-show semantics and report-card rendering remain pending.',
 B08:'Overdue binding and insights pass P2; current-state follow-up/history limitations and browser acceptance remain.',
 B09:'Full eligible dealer population, beyond 50 detail rows, is verified by P2; real dealer control totals remain unverified.',
 B10:'Distinct eligible invoice customer counts pass P2; authoritative dealer identities and actual report rendering remain unverified.',
 B11:'Invoice-history dormancy and insufficient-history rules pass P3; approved age threshold and complete live history remain.',
 B12:'Customer creation timestamp/origin is absent; API intentionally returns null. Six-month new-customer metric is not implemented; obsolete fabricated-estimate defect removed.',
 B13:'Complete-population top-five concentration reconciles in P2/P3; live accounting denominator and UI remain unverified.',
 B14:'Authoritative signed product aggregates pass P2; live invoice-line coverage and report/PDF acceptance remain.',
 B15:'Comparable-period product intelligence includes prior-only products; live mapping/line coverage and charts remain unverified.',
 B16:'History-based decline/dormancy classification passes P3/P4; approved thresholds, history completeness and client acceptance remain.',
 B17:'Server evidence-backed review actions pass P3/P4; action owner/due-date/closure tracking and business policy are incomplete.',
 B18:'Linked RM report endpoint passes P2; click-through, tabs and rendered PDF/browser output remain NOT VERIFIED.',
 C01:'Real HTTP login/logout and expiry pass P8 for all roles; browser login/session UX remains NOT VERIFIED.',
 C02:'Actual-app check-in/check-out, duplicate guards and saved state pass P8; physical-device and browser acceptance remain.',
 C03:'Valid coordinates/accuracy persist and invalid coordinates are rejected in P5/P8; physical GPS and permission states remain unverified.',
 C04:'India business-date tracking passes P5; actual-app attendance, visit and call persistence passes P8. Narrow timestamp requirement verified synthetically.',
 C05:'No approved customer coordinates, distance rule or physical-visit geofence verification exists.',
 C06:'Create/start/complete, owner denial and repeat guards pass actual-app P8; browser/device visit forms remain unverified.',
 C07:'Incoming/outgoing call persistence, daily counts and follow-ups pass P5/P8; UI acceptance remains. Entries are not carrier-verified calls.',
 C08:'Mandatory daily visit/call completeness gate and approved logging policy are absent.',
 C09:'Owner/team access passes P1/P8; customer list still slices to 100 and search/list browser coverage remains pending.',
 C10:'Product reference and saved visit product are wired and P8 completion passes; actual product-selector interaction remains unverified.',
 C11:'Purpose required by creation endpoint and saved through actual-app P8 visit workflow; narrow persisted-field requirement verified.',
 C12:'Required outcome is validated and saved by actual-app P8 completion; invalid state/repeated completion are rejected.',
 C13:'Nonnegative expected-order validation and saved value/day totals pass P5/P8 with synthetic value 2500.',
 C14:'Date-only follow-up validation, creation and owner-protected completion pass P5/P8; malformed dates are rejected.',
 C15:'Synthetic byte upload/download passes P8 with owner/team protection; microphone, codec and actual recording acceptance remain NOT VERIFIED.',
 C16:'Authenticated multipart STT returns a mocked transcript in P8; actual audio recognition/language/accuracy is NOT VERIFIED.',
 C17:'No explicit English translation pipeline or accepted language/translation policy exists.',
 C18:'Original synthetic bytes round-trip through protected storage in P8; durable production audio storage, retention and backup remain unverified.',
 C19:'Mandatory voice-to-text submission is not enforced; recording/transcription remains optional.',
 C20:'UAT-01: fresh initialized database login succeeds but My Day returns HTTP 500 because profile columns are absent. Seed-compatible fixture summary passes; clean-start path is BROKEN.',
 C21:'Planned/completed/pending counts pass P4/P5 and actual-app P8 completion persists one completed visit.',
 C22:'India-day expected-order value/count passes P5/P8; synthetic completed visit produces daily value 2500 without historical commitments.',
 C23:'Scoped overdue/due reminder payloads pass P7; browser visibility and any external notification acceptance remain pending.',
 C24:'Service-request source/API and owner checks exist; complete sample/quote/support form acceptance remains unverified.',
 D01:'Owned lead creation/validation passes P6L/P8; actual create form remains unverified.',
 D02:'Admin/RM team-limited reassignment and salesperson denial pass P6L; assignment selector interaction remains unverified.',
 D03:'Kanban groups and stage controls are present in lead-board source; actual drag/button/layout acceptance remains NOT VERIFIED.',
 D04:'Actual-app P8 progresses six stages with RM authorization and other-user denial; persisted stage update semantics verified.',
 D05:'Actual-app P8 verifies six actor/time stage-history entries; P6L verifies no-op and scope behavior. Pre-migration history is not reconstructed.',
 D06:'next_action_date persists and validates; lead changes do not synchronize a linked follow-up/reminder lifecycle.',
 D07:'Nonnegative lead expected value persists and negative inputs are rejected in P6L; narrow stored-value requirement verified.',
 D08:'Won/Lost enums and actor/time transition history exist; closure reason/date fields and reopening policy remain incomplete.',
 D09:'Scoped won-of-decided conversion passes P6L/P8; browser summary and client denominator approval remain pending.',
 E01:'Connector ingestion implementation exists; actual import workflow and authoritative live reconciliation remain unverified.',
 E02:'Workbook import exists but reconstructs invoice allocations; these projections are excluded from authoritative metrics, not accepted as real vouchers.',
 E03:'No authorized live Tally agent/exchange was exercised. Server source is insufficient for live-sync acceptance.',
 E04:'Signed eligible sales/credit-note reporting passes P2/P8; cancellation state and full extraction/import acceptance remain incomplete.',
 E05:'Customer parsing/master source exists; durable company identity, owner mapping and approved live master reconciliation remain.',
 E06:'Product parsing/master source exists; unit/rate/company mapping and complete live master reconciliation remain.',
 E07:'Signed complete product-line aggregates pass P2/P6R/P8; actual line completeness and mapping require approved Tally reconciliation.',
 E08:'Full filtered customer aggregates beyond 100 groups pass P6R; authoritative live customer totals remain unverified.',
 E09:'Owner/team attribution and cross-team exclusion pass P2/P7; live roster/aliases and effective-dated historical ownership remain unresolved.',
 E10:'Admin Sales Reports dealer-type predicate is implemented and exercised by P6R; distributor taxonomy and cross-screen acceptance remain.',
 E11:'Admin report territory predicate is exercised by P6R; approved territory mapping and cross-screen UI acceptance remain.',
 E12:'RM/team scope and report totals pass P2/P6R/P7; live manager mapping and report rendering remain unverified.',
 E13:'Customer/dealer filtering exists; distinct direct-customer taxonomy and approved segmentation remain unverified.',
 E14:'Historical authoritative fixtures can be reported; reconstructed workbook history is excluded and complete genuine history remains unverified.',
 E15:'Status/error and unavailable-data handling pass P4/P7; actual ingest interruption/recovery and live monitoring remain unverified.',
 E16:'Stable IDs/upsert/chunk checks exist; import replay, company collisions and staged overwrite/line replacement need dedicated ingestion tests.',
 E17:'Missing/old/failed sync states pass P4/P7; browser indicators and approved freshness SLA remain unverified.',
 E18:'Owner-ID mapping governs authorized customers in P1/P8; durable cross-source/company identity and live mapping approval remain.',
 E19:'Unique CRM owner/team attribution passes P2/P7; shared alias parity, historical reassignment and real control totals remain.',
 F01:'Dealer-type filter now passes P6R; distributor classification, complete performance UX and client acceptance remain.',
 F02:'100-group aggregate cap is removed and signed product totals pass P6R; actual line coverage and charts remain unverified.',
 F03:'Territory filter exists in Admin Sales Reports and passes P6R; all-screen territory parity/mapping remains incomplete.',
 F04:'Manager/team report filter passes P6R; consistent client-approved targets and browser acceptance remain.',
 F05:'RM target/actual and attention/card parity pass P2/P3; production mappings/targets and report rendering remain unverified.',
 F06:'Complete customer aggregates pass P6R; explicit direct-customer taxonomy and segmentation remain unverified.',
 F07:'Explicit backend date/FY filters pass P6R; UAT-02 reproduces India-midnight UTC shift in UI presets. Cross-screen period parity remains.',
 F08:'Report region grouping exists; a report-wide region selector and consistent propagation are not established. Territory filter is not region parity.',
 F09:'Product filter reaches complete backend aggregates and passes P6R; browser selection/export and all-screen parity remain unverified.',
 F10:'Salesperson/RM team filter passes P6R; actual UI selection and legacy-screen parity remain unverified.',
 F11:'Customer filter passes P6R/P8, including net value 900; actual UI/export interaction remains unverified.',
 F12:'Daily CRM activity and daily automation pass P5/P7/P8; complete daily sales report UI and approved period semantics remain.',
 F13:'Monthly aggregation/scheduling fixtures pass P2/P7; UI date presets are defective and real monthly control totals remain unverified.',
 F14:'April-March and FYTD fixture boundaries pass P2/P7; UI preset defect, partial target coverage and live acceptance remain.',
 F15:'API-backed chart source exists; no actual browser chart or mobile layout was executed.',
 F16:'Detail APIs and RM report-card drill-down endpoint pass P2; actual dialogs, links and expansions remain unverified.',
 F17:'Complete filtered aggregates and saved summaries pass P6R; CSV escaping is source-reviewed. Actual downloads, HTML .xls interpretation and complete paginated print/PDF remain unverified/incomplete.',
 F18:'Grounded server metrics and deterministic review actions pass P3/P4/P7; business thresholds and actionable workflow/client acceptance remain.',
 G01:'Authorized scoped evidence selection and explicit periods pass mocked P7; broader BI and browser/live-provider acceptance remain.',
 G02:'Server-rendered facts reject fabricated provider values and cross-team context in P7; actual provider and live Tally evidence coverage remain unverified.',
 G03:'STT now requires authentication and P8 verifies mocked success; obsolete unauthenticated-endpoint finding removed. Real service accuracy remains unverified.',
 G04:'Grounded performance evidence/review rules pass P7; broader provider observations and client acceptance remain incomplete.',
 G05:'Deterministic evidence-backed RM review suggestions pass P7; open-ended coaching and approved policy acceptance remain incomplete.',
 G06:'Persistent daily/monthly generation, restart catch-up, claims and bounded retries pass P7; approved live cadence and operations remain unverified.',
 G07:'Mocked approved-template transport and signed callbacks pass P7; real opt-in/template/account/provider delivery is NOT VERIFIED.',
 G08:'Scoped pending/due/overdue and visit payloads pass P7; actual notification UX and external delivery remain unverified.',
 G09:'Authenticated role-specific AI routes, cross-team denials and per-account throttling pass P7; clustered quotas and production acceptance remain.',
 H01:'Scrypt login/logout/expiry passes P8; production admin seeding fails closed without a password in source. Browser token handling, HTTPS and configuration acceptance remain.',
 H02:'Unauthenticated, wrong-role and object-scope denials pass P1/P7/P8, including STT; complete deployment/endpoint security acceptance remains.',
 H03:'Customer, lead, follow-up, AI and audio owner/team denials pass P1/P7/P8; broader data inventory and deployment verification remain.',
 H04:'Hashed bearer tokens and authoritative-source restrictions exist; request HMAC is not implemented and full connector ingestion/security lifecycle remains unverified.',
 H05:'Replication source now enforces certificate validation; prior insecure-TLS finding is superseded. Actual deployed HTTPS/origin/TLS enforcement remains unverified.',
 H06:'Password/session hashes and encrypted synthetic backups pass P1/P8; SQLite/audio storage protection, baseline handling and retention remain production decisions.',
 H07:'Admin audit and Phase 7 redaction exist; complete login/denial/field/export audit coverage and operational monitoring remain incomplete.',
 H08:'Synthetic encrypted restore, integrity, tamper/wrong-key/overwrite rejection pass P1/P8; durable destination, schedule, key escrow, RPO/RTO and full audio recovery remain unverified.',
 H09:'Cached metrics and disconnected/failed sync states are exercised; staged-ingest interruption/recovery remains unverified.',
 H10:'Frontend retry/error source and attendance monitor tests pass; offline queue and guaranteed unsaved-form recovery remain absent, and browser failure UX is unverified.',
 H11:'Full filtered financial aggregates and backup restore exist; complete CRM/customer/audio portability and actual export downloads remain incomplete/unverified.',
 H12:'Role scope, provider minimization and audit redaction pass synthetic tests; retention, device/storage policies and client confidentiality approval remain.',
 H13:'Single-client tenancy applicability and deployed client separation have no acceptance evidence; role/team isolation is not tenant isolation.',
 H14:'This UAT uses disposable synthetic records only; historical authorization for bundled/imported client data in development is unavailable.',
 H15:'No executed NDA or independent contractual confidentiality evidence is available; technical controls cannot establish legal execution.',
};
const stageNames=['Lead','Technical Discussion','Sample','Quotation','Follow-up','Order Expected','Won','Lost'];
stageNames.forEach((name,index)=>notes[`DS0${index+1}`]=`${name} is present in API stage enum, persisted lead model and source labels; P6L/P8 verify stage semantics. This row certifies the named stage, not browser Kanban acceptance (D03).`);
for(let index=1;index<=10;index++) notes[`I${String(index).padStart(2,'0')}`]='All three existing training SOPs were read in Phase 8 and contain the relevant task procedure, metric limits and practice/sign-off fields. Documentation authorship is complete; actual training and signed acceptance are pending.';
const completed=new Set('C04 C11 C12 C13 C14 C21 C22 D04 D05 D07 DS01 DS02 DS03 DS04 DS05 DS06 DS07 DS08 I01 I02 I03 I04 I05 I06 I07 I08 I09 I10'.split(' '));
const missing=new Set('B12 C05 C08 C17 C19'.split(' '));
const unverified=new Set('E03 G07 H13 H14 H15'.split(' '));
const broken=new Set(['C20']);
const status=id=>completed.has(id)?'COMPLETED':missing.has(id)?'NOT IMPLEMENTED':unverified.has(id)?'NOT VERIFIED':broken.has(id)?'BROKEN':'PARTIALLY COMPLETED';
const files=['PSSPL_REQUIREMENTS_AUDIT_MATRIX.md','PSSPL_REQUIREMENTS_AUDIT_MATRIX_2.md'];
const rows=[];
const write=process.argv.includes('--write');
for(const file of files){
 const source=readFileSync(file,'utf8');
 const updated=source.split(/\r?\n/).map(line=>{
  if(!/^\|\s*[A-Z]+\d+\s*\|/.test(line)) return line;
  const fields=line.split('|').map(s=>s.trim()),id=fields[1];
  assert.ok(notes[id],`Missing review for ${id}`);
  const entry={id,module:fields[2],requirement:fields[3],status:status(id),finding:notes[id],evidence:'E41',previousStatus:fields[4].replaceAll('*','')};
  rows.push(entry);
  fields[4]=`**${entry.status}**`;
  fields[5]='[E41](PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md#e41) - Phase 8 fresh execution and source review; earlier E01-E40 are historical traces';
  fields[6]=entry.finding;
  return `| ${fields.slice(1,8).join(' | ')} |`;
 }).join('\n');
 if(write) writeFileSync(file,updated);
}
assert.equal(rows.length,142);assert.equal(new Set(rows.map(row=>row.id)).size,142);assert.equal(Object.keys(notes).length,142);
const counts=Object.fromEntries(['COMPLETED','PARTIALLY COMPLETED','NOT IMPLEMENTED','BROKEN','NOT VERIFIED'].map(s=>[s,rows.filter(row=>row.status===s).length]));
const artifact={date:'2026-10-18',baseline:142,counts,verifiedCompletionPercent:Number((counts.COMPLETED/142*100).toFixed(2)),acceptance:'FAIL',rows};
if(write){
 writeFileSync('docs/uat/phase8/requirements.json',JSON.stringify(artifact,null,2)+'\n');
 const table='| ID | Requirement | Status | Finding and remaining acceptance |\n| --- | --- | --- | --- |\n'+rows.map(row=>`| ${row.id} | ${row.requirement} | ${row.status} | ${row.finding} |`).join('\n');
 writeFileSync('docs/uat/phase8/requirements-matrix.md',`# Phase 8 reconciled requirements\n\nAll 142 original IDs. Evidence: [E41](../../../PSSPL_REQUIREMENTS_AUDIT_EVIDENCE.md#e41). Each row was reviewed against fresh isolated tests and source/acceptance limits.\n\n${table}\n`);
}
console.log(JSON.stringify({counts,verifiedCompletionPercent:artifact.verifiedCompletionPercent,requirements:rows.length,write},null,2));
