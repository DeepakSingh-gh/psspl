"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminPage, AdminState } from "./admin-shell";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatDate, formatNumber, formatPeriod, formatRupees } from "@/lib/format";
import type { CustomerDetail } from "@/types/admin";

const PAGE_SIZE = 50;

export function AdminCustomers() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(initialSearch);
  const [term, setTerm] = useState(initialSearch);
  const [owner, setOwner] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [assignOwner, setAssignOwner] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => { setTerm(search); setPage(0); }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, loading, error, reload } = useAdminData(
    () => adminApi.customers({ search: term, rm: owner, type, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    [term, owner, type, page]
  );

  const total = data?.total ?? 0;
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const pageIds = data?.items.map((item) => item.id) ?? [];
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedRows.has(id));

  function toggleCustomer(id: string) {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function applyOwner() {
    if (selectedRows.size === 0) return;
    setAssigning(true);
    setNotice("");
    try {
      const result = await adminApi.assignCustomerOwners([...selectedRows], assignOwner || null);
      setNotice(`${result.updated} customer${result.updated === 1 ? "" : "s"} updated.`);
      setSelectedRows(new Set());
      await reload();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not update customer ownership.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <AdminPage
      eyebrow="Master data"
      title="Customers"
      description="The party master imported from Tally, with lifetime sales, outstanding balance and the last recorded payment."
      actions={
        <label className="admin-search">
          <span className="admin-sr-only">Search customers</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, city or code" type="search" />
        </label>
      }
    >
      <div className="admin-filters">
        <label className="admin-select">
          <span>Regional manager</span>
          <select value={owner} onChange={(event) => { setOwner(event.target.value); setPage(0); }}>
            <option value="">All managers</option>
            {data?.filters.owners.map((item) => <option key={item.userId} value={item.userId}>{item.name}</option>)}
            <option value="unassigned">No RM assigned</option>
          </select>
        </label>
        <label className="admin-select">
          <span>Party type</span>
          <select value={type} onChange={(event) => { setType(event.target.value); setPage(0); }}>
            <option value="">All types</option>
            {data?.filters.types.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <p className="admin-result-count">{formatNumber(total)} customers</p>
      </div>

      <div className="customer-assignment-bar">
        <div>
          <strong>{selectedRows.size ? `${selectedRows.size} selected` : "Assign customer ownership"}</strong>
          <span>Map Tally customers to a CRM salesperson or RM.</span>
        </div>
        <label className="admin-select">
          <span>New owner</span>
          <select value={assignOwner} onChange={(event) => setAssignOwner(event.target.value)}>
            <option value="">Remove assignment</option>
            {data?.filters.owners.map((item) => (
              <option key={item.userId} value={item.userId}>{item.name} · {item.role === "rm" ? "RM" : item.territory || "Salesperson"}</option>
            ))}
          </select>
        </label>
        <button type="button" className="admin-button" disabled={selectedRows.size === 0 || assigning} onClick={applyOwner}>
          {assigning ? "Assigning…" : "Apply"}
        </button>
      </div>
      {notice && <p className="admin-note">{notice}</p>}

      <AdminState loading={loading} error={error} onRetry={reload} empty={!data?.items.length}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="customer-select-cell"><input type="checkbox" aria-label="Select all customers on this page" checked={allPageSelected} onChange={togglePage} /></th>
                <th>Customer</th><th>Type</th><th>Salesperson / RM</th>
                <th className="numeric">Lifetime sales</th><th className="numeric">Outstanding</th><th>Last payment</th><th />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((customer) => (
                <tr key={customer.id}>
                  <td className="customer-select-cell"><input type="checkbox" aria-label={`Select ${customer.name}`} checked={selectedRows.has(customer.id)} onChange={() => toggleCustomer(customer.id)} /></td>
                  <td>
                    <strong className="admin-cell-title">{customer.name}</strong>
                    <small>{customer.city || "City not recorded"} · {customer.id}</small>
                  </td>
                  <td><span className="admin-tag">{customer.type || "—"}</span></td>
                  <td>{customer.rmAssigned ? customer.rmName : <span className="admin-muted">{customer.rmName || "Not assigned"}</span>}</td>
                  <td className="numeric">{formatRupees(customer.totalSales)}</td>
                  <td className={`numeric${customer.outstanding > 0 ? " tone-negative" : ""}`}>{formatRupees(customer.outstanding)}</td>
                  <td>{formatDate(customer.lastPaymentDate)}</td>
                  <td className="numeric"><button type="button" className="admin-button ghost small" onClick={() => setSelected(customer.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="admin-pager">
            <button type="button" className="admin-button ghost small" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span>Page {page + 1} of {pages}</span>
            <button type="button" className="admin-button ghost small" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        )}
      </AdminState>

      {selected && <CustomerDrawer id={selected} onClose={() => setSelected(null)} />}
    </AdminPage>
  );
}

function CustomerDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading, error, reload } = useAdminData<CustomerDetail>(() => adminApi.customer(id), [id]);
  const peak = Math.max(1, ...(data?.monthly ?? []).map((row) => row.amount));

  return (
    <div className="admin-drawer" role="dialog" aria-modal="true" aria-label="Customer detail">
      <button type="button" className="admin-drawer-scrim" onClick={onClose} aria-label="Close" />
      <div className="admin-drawer-panel">
        <header>
          <div>
            <p className="admin-eyebrow">Customer</p>
            <h2>{data?.customer.name ?? "Loading…"}</h2>
          </div>
          <button type="button" className="admin-button ghost small" onClick={onClose}>Close</button>
        </header>

        <AdminState loading={loading} error={error} onRetry={reload}>
          {data && (
            <>
              <dl className="admin-definition">
                <div><dt>Party code</dt><dd>{data.customer.id}</dd></div>
                <div><dt>Type</dt><dd>{data.customer.type || "—"}</dd></div>
                <div><dt>City</dt><dd>{data.customer.city || "—"}</dd></div>
                <div><dt>Regional manager</dt><dd>{data.customer.rmName || "—"}{data.customer.rmCode ? ` (${data.customer.rmCode})` : ""}</dd></div>
                <div><dt>Lifetime sales</dt><dd>{formatRupees(data.customer.totalSales)}</dd></div>
                <div><dt>Outstanding</dt><dd>{formatRupees(data.customer.outstanding)}</dd></div>
                <div><dt>Last payment</dt><dd>{formatDate(data.customer.lastPaymentDate)}</dd></div>
              </dl>

              <section>
                <h3>Monthly sales</h3>
                {data.monthly.length === 0 ? <p className="admin-note subtle">No monthly breakdown was imported for this customer.</p> : (
                  <ul className="admin-bars">
                    {data.monthly.map((row) => (
                      <li key={row.period}>
                        <span className="admin-bar-label">{formatPeriod(row.period)}</span>
                        <span className="admin-bar"><span style={{ width: `${Math.max((row.amount / peak) * 100, row.amount > 0 ? 2 : 0)}%` }} /></span>
                        <span className="admin-bar-value">{formatRupees(row.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3>Receipts and payments</h3>
                {data.payments.length === 0
                  ? <p className="admin-note subtle">No receipt or payment vouchers have been synced for this customer.</p>
                  : (() => {
                    const received = data.payments.filter((row) => /receipt/i.test(row.paymentType ?? ""));
                    const receivedTotal = received.reduce((sum, row) => sum + row.amount, 0);
                    return <>
                      <div className="ledger-summary">
                        <div><span>Receipts banked</span><strong>{formatRupees(receivedTotal)}</strong><small>{formatNumber(received.length)} of {formatNumber(data.payments.length)} vouchers</small></div>
                        <div><span>Outstanding</span><strong>{formatRupees(data.customer.outstanding)}</strong><small>Ledger balance from Tally</small></div>
                      </div>
                      <table className="admin-table compact ledger-table">
                        <thead><tr><th>Date</th><th>Type</th><th>Voucher</th><th className="numeric">Amount</th></tr></thead>
                        <tbody>
                          {data.payments.slice(0, 25).map((row) => (
                            <tr key={row.id}>
                              <td>{formatDate(row.paymentDate)}</td>
                              <td><span className={`admin-tag${/receipt/i.test(row.paymentType ?? "") ? " is-in" : ""}`}>{row.paymentType || "—"}</span></td>
                              <td>{row.voucherNumber || <span className="admin-muted">—</span>}</td>
                              <td className="numeric">{formatRupees(row.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {data.payments.length > 25 && <p className="admin-note subtle">Showing the 25 most recent of {formatNumber(data.payments.length)} vouchers.</p>}
                    </>;
                  })()}
              </section>

              <section>
                <h3>CRM visits</h3>
                {data.visits.length === 0
                  ? <p className="admin-note subtle">No visits have been recorded against this customer yet.</p>
                  : (
                    <ul className="admin-list">
                      {data.visits.map((visit) => (
                        <li key={visit.id}>
                          <strong>{visit.purpose}</strong>
                          <small>{formatDate(visit.businessDate)} · {visit.salesperson ?? "Unknown"} · {visit.status.replace("_", " ")}</small>
                        </li>
                      ))}
                    </ul>
                  )}
              </section>

              {data.customer.sourceFile && <p className="admin-note subtle">Source: {data.customer.sourceFile}</p>}
            </>
          )}
        </AdminState>
      </div>
    </div>
  );
}
