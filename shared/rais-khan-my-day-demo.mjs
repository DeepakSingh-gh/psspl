// Presentation-only examples. Never write these records to CRM or financial APIs.
export function raisKhanMyDayDemo(report) {
  if (report.id !== 'raiskhan' || report.selectedSalespersonId || report.future || report.from > report.asOf) return null;
  const customers = ['Demo · Sutlej Coatings', 'Demo · Punjab Metal Finishers', 'Demo · Ludhiana Surface Works', 'Demo · Doaba Auto Components', 'Demo · Malwa Engineering', 'Demo · Northern Precision', 'Demo · Shivalik Industries'];
  const cities = ['Ludhiana', 'Jalandhar', 'Chandigarh', 'Amritsar', 'Patiala', 'Mohali', 'Kundli'];
  const products = ['Zpn Blue 15', 'Zpn 200', 'Zpn Black', 'Shimaclad Peony', 'Clearclad Lcbh', 'Enilex Chrome Catalyst', 'Uviclad 612'];
  const purposes = ['Product demonstration', 'Sample evaluation', 'Quotation discussion', 'Technical review', 'Order negotiation', 'Dealer development', 'Collection follow-up'];
  const outcomes = ['Sample approved for pilot trial', 'Evaluation feedback received', 'Revised quotation requested', 'Technical guidance provided', 'Purchase approval in progress', 'Next demonstration agreed', 'Payment commitment received'];
  const end = new Date(`${report.asOf}T00:00:00Z`).getTime();
  const start = new Date(`${report.from}T00:00:00Z`).getTime();
  return (report.myDayTables ?? []).map(table => ({
    ...table, title: table.title,
    note: 'DEMO — seven fictional, display-only examples. Not saved CRM activity or verified business results.',
    rows: Array.from({length: 7}, (_, i) => {
      const day = new Date(Math.max(start, end - (6-i)*86400000)).toISOString().slice(0,10);
      const value = 45000 + i * 12500;
      const fields = {
        'Customer': customers[i], 'Executive': 'Rais Khan · Demo', 'Visit date': day, 'Business date': day,
        'Created at': `${day}T04:00:00Z`, 'Recorded at': `${day}T05:30:00Z`,
        'Scheduled at': `${day}T05:00:00Z`, 'Started at': `${day}T05:05:00Z`, 'Completed at': `${day}T06:00:00Z`,
        'Purpose': purposes[i], 'Priority': ['high','medium','low'][i%3], 'Products discussed': products[i],
        'Recorded outcome': outcomes[i], 'Discussion notes': `Demo discussion ${i+1}: reviewed ${products[i]} application requirements at ${cities[i]}. ${outcomes[i]}. Confirm specifications and share the next update with the customer.`,
        'Visit tags': ['product_discussion, sample_request','technical_support, follow_up','quotation, expected_order'][i%3],
        'Recorded status': table.id === 'input-visits' ? 'completed' : table.id === 'input-followups' ? (i%3 ? 'Open' : 'Completed') : table.id === 'input-orders' ? ['open','won','lost'][i%3] : ['open','in_progress','closed'][i%3],
        'Latitude': Number((30.90+i*.015).toFixed(5)), 'Longitude': Number((75.85+i*.012).toFixed(5)),
        'Voice note': 'Demo recording placeholder · no audio file',
        'Interaction type': i%2 ? 'call_incoming':'call_outgoing', 'Purpose / subject': purposes[i],
        'Outcome & notes': `${outcomes[i]}. Demo call ${i+1}: agreed to share specifications and reconnect on the next working day.`,
        'Lead': `Demo Prospect ${i+1}`, 'Title': `Demo · ${purposes[i]}`, 'Follow-up mode': i%2?'visit':'call',
        'Due date': day, 'Assigned to': 'Rais Khan · Demo', 'Linked visit': `DEMO-RAIS-VISIT-${String(i+1).padStart(2,'0')}`,
        'Product': products[i], 'Expected value': value, 'Expected date': day,
        'Request type': ['quotation','sample_request','technical_support','complaint','other','quotation','sample_request'][i],
        'Details': `Demo request ${i+1}: ${purposes[i]} for ${products[i]} at ${customers[i]}. Provide application guidance, sample availability and written confirmation before the next review.`,
        'Responsible person': 'Demo · Technical service desk', 'Name': `Demo Prospect ${i+1}`,
        'Company': customers[i], 'Phone': `DEMO-PHONE-0${i+1}`, 'Email': `prospect${i+1}@example.test`,
        'City': cities[i], 'Source': ['Trade exhibition','Customer referral','Field visit','Website enquiry','Dealer referral','Technical seminar','Inbound enquiry'][i],
        'Interested product': products[i], 'Next action date': day,
        'Notes': `Demo lead ${i+1}: interested in ${products[i]}; review technical requirements, share a quotation and confirm trial readiness.`,
        'Recorded stage': ['lead','technical_discussion','sample','quotation','follow_up','expected_order','won'][i],
        'Check-in at': `${day}T03:30:00Z`, 'Recorded check-out at': `${day}T12:30:00Z`, 'GPS accuracy (m)': 8+i*2,
      };
      return table.columns.map(column => fields[column] ?? `Demo ${column} ${i+1}`);
    }),
  }));
}
