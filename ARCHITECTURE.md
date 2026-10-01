# PSSPL CRM data architecture

## CRM database (salesperson-entered data)

- User accounts, roles and login sessions
- Attendance and optional check-in coordinates
- Planned, started and completed customer visits
- Products discussed during visits (stored as Tally product IDs)
- Discussion outcome and notes
- Expected order value/date
- Follow-ups and completion status
- Monthly salesperson target and territory assignment

## Tally connector (accounting and master data)

- Customer and ledger master
- Product and stock-item master
- Sales invoices, returns and credit notes
- Receipts, outstanding balances and repeat sales
- Product-, customer-, territory- and date-wise sales totals

The CRM references Tally customer and product IDs rather than maintaining duplicate masters. Configure `TALLY_CONNECTOR_URL`; the adapter expects `/customers`, `/products`, `/sales/summary` and `/status` endpoints. Until configured, local development sample data is clearly labelled in the interface.
