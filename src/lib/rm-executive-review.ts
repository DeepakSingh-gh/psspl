import type { RmPerformanceReport } from '../../shared/rm-performance.mjs';

export interface ExecutiveReview {
  id: string;
  title: string;
  actionTitle: string;
  available: boolean;
  priority: string;
  points: string[];
  evidence: string;
  responses: string[];
}

const categories = [
  { id: 'achievement', title: 'Sales Target Achievement', actionTitle: 'Revenue Gap Review', limitation: 'A reliable actual and target comparison is unavailable.' },
  { id: 'momentum', title: 'Sales Momentum', actionTitle: 'Sales Trend Assessment', limitation: 'Comparable-period sales are missing or the comparison base is zero.' },
  { id: 'engagement', title: 'Customer Engagement', actionTitle: 'Account Coverage', limitation: 'Reliable customer-contact evidence is unavailable for this cutoff.' },
  { id: 'visits', title: 'Field Visit Productivity', actionTitle: 'Visit Plan Execution', limitation: 'Planned and timestamped completed-visit evidence is unavailable.' },
  { id: 'followups', title: 'Follow-up Execution', actionTitle: 'Follow-up Control', limitation: 'Open and overdue follow-up status cannot be established at this cutoff.' },
];

/** Presentation only: metrics and evidence remain the server's verified values. */
export function executiveReviews(report: RmPerformanceReport): ExecutiveReview[] {
  const closed = report.historical;
  const responses = (id: string): string[] => {
    switch (id) {
      case 'achievement':
        if (report.summary.target == null) return closed
          ? ['The missing target needed confirmation before performance could be assessed.', 'A verified target would have enabled a reliable variance review.']
          : ['Confirm the missing target with the RM.', 'Assess the variance only after the target has been verified.'];
        return report.summary.variation != null && report.summary.variation < 0
          ? closed
            ? ['The revenue gap required customer-wise variance investigation.', 'Lost or delayed orders needed verification against invoice dates.']
            : ['Investigate the revenue gap by customer and product.', 'Confirm which orders were lost or delayed before deciding the response.']
          : closed
            ? ['Target attainment called for a review of contributing customers and products.', 'A repeat-order assessment would have helped test whether sales were sustainable.']
            : ['Review the customers and products contributing to target attainment.', 'Check repeat-order prospects before assuming the performance will continue.'];
      case 'momentum': return closed
        ? ['The change in sales required an order and invoice timing review.', 'A review of lost and delayed opportunities would have helped establish the cause.']
        : ['Compare order movements and invoice timing with the previous period.', 'Verify the reasons for change with the RM; do not infer causes from the chart.'];
      case 'engagement': return closed
        ? ['Recorded contacts needed review against the assignment list.', 'Coverage gaps required confirmation because historical assignments are not versioned.']
        : ['Review recorded calls and visits against current customer assignments.', 'Confirm coverage gaps before prioritizing customers without recorded contact.'];
      case 'visits':
        if (report.kpi.visitsPlanned === 0) return closed
          ? ['The visit-planning scope needed confirmation for this period.', 'Zero planned visits alone did not establish an execution failure.']
          : ['Confirm the visit-planning scope for this period.', 'Do not treat zero planned visits alone as an execution failure.'];
        if (report.kpi.visitsCompleted === report.kpi.visitsPlanned) return closed
          ? ['Completed visit outcomes needed a quality review.', 'Verified customer responses would have helped assess the next coverage plan.']
          : ['Review recorded outcomes to assess visit quality.', 'Use verified customer responses when planning the next coverage cycle.'];
        return closed
        ? ['Visit execution needed review against completion timestamps and recorded outcomes.', 'Uncompleted plans would have benefited from a scheduling and capacity review.']
        : ['Check completion timestamps and outcomes for planned visits.', 'Review scheduling for visits without completion evidence.'];
      default:
        if (!closed && report.kpi.followUpsOpen === 0) return ['Confirm the empty backlog against recorded customer commitments.', 'Keep next-contact dates recorded for new commitments.'];
        if (!closed && report.kpi.followUpsOverdue === 0) return ['Review open follow-ups against their next-contact dates.', 'Record customer contacts and outcomes as they become due.'];
        return closed
        ? ['The recorded follow-up backlog required a closure-status review at the time.', 'Any overdue commitments needed prioritization without assuming they remain open now.']
        : ['Prioritize verified overdue follow-ups and confirm their current status.', 'Record the next customer contact and its outcome.'];
    }
  };
  const ordered = [...categories].sort((a, b) => {
    const index = (id: string) => { const i = report.narratives.findIndex(n => n.id === id); return i < 0 ? 99 : i; };
    return index(a.id) - index(b.id);
  });
  return ordered.map(category => {
    const narrative = report.narratives.find(n => n.id === category.id);
    return {
      ...category,
      available: Boolean(narrative),
      priority: narrative?.priority ?? 'Unavailable',
      points: narrative ? narrative.points.slice(0, 2) : [category.limitation],
      evidence: narrative?.reason ?? category.limitation,
      responses: narrative ? responses(category.id) : [],
    };
  });
}

export function unavailableTables(report: RmPerformanceReport) {
  return report.tables.filter(table => !table.rows.length || table.rows.every(row => row.slice(1).every(value => value == null)));
}
