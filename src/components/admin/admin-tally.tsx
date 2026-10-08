"use client";
import { useState } from "react";
import { AdminPage, AdminState } from "./admin-shell";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatDate, formatDateTime, formatNumber, formatPeriod, formatRupees } from "@/lib/format";

const COVERAGE_LABEL: Record<string, string> = {
  customerSales: "Customer monthly sales", productSales: "Product monthly sales", targets: "RM monthly targets",
};

function connectionLabel(status?: string) {
  if (status === "online") return "Connected";
  if (status === "paired") return "Paired — waiting for heartbeat";
  if (status === "offline") return "Connector offline";
  return "Not connected";
}

export function AdminTally() {
  const { data, loading, error, reload } = useAdminData(() => adminApi.tally(), []);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiry, setPairingExpiry] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);

  async function createPairingCode() {
    setWorking(true); setActionError(""); setCopied(false);
    try {
      const result = await adminApi.createTallyPairingCode();
      setPairingCode(result.code); setPairingExpiry(result.expiresAt); await reload();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Could not create a pairing code"); }
    finally { setWorking(false); }
  }

  async function cancelPairing() {
    setWorking(true); setActionError("");
    try { await adminApi.cancelTallyPairingCode(); setPairingCode(null); setPairingExpiry(null); await reload(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Could not cancel the pairing code"); }
    finally { setWorking(false); }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect this Tally connector? A new pairing code will be required to connect again.")) return;
    setWorking(true); setActionError("");
    try { await adminApi.revokeTallyConnector(); await reload(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Could not disconnect the connector"); }
    finally { setWorking(false); }
  }

  async function copyCode() {
    if (!pairingCode) return;
    await navigator.clipboard.writeText(pairingCode); setCopied(true);
  }

  return (
    <AdminPage eyebrow="Tally integration" title="Tally connector"
      description="Connect the office Tally system and monitor customer, product, sales, payment and outstanding data flowing into the CRM."
      actions={<button type="button" className="admin-button ghost small" onClick={reload}>Refresh status</button>}>
      <AdminState loading={loading} error={error} onRetry={reload}>
        {data && <>
          {actionError && <div className="admin-error" role="alert"><span>{actionError}</span></div>}

          <section className={`tally-connection ${data.connector?.status === "online" ? "is-online" : ""}`}>
            <div className="tally-connection-copy">
              <div className="tally-connection-heading"><span className="tally-connector-icon" aria-hidden="true">T</span><div>
                <p className="admin-eyebrow">Desktop connector</p><h2>{connectionLabel(data.connector?.status)}</h2>
              </div></div>
              <p>{data.connector ? "Fresh Tally data is received whenever the connector is running on the accounts computer." : "Generate a one-time code, then enter it in the PSSPL Tally Connector on the accounts computer."}</p>
            </div>
            <div className="tally-connection-actions">
              {data.connector
                ? <button type="button" className="admin-button" disabled={working} onClick={disconnect}>Disconnect</button>
                : !pairingCode && <button type="button" className="admin-button" disabled={working} onClick={createPairingCode}>{working ? "Generating…" : "Generate pairing code"}</button>}
            </div>
          </section>

          {!data.connector && (pairingCode || data.pairing) && <section className="admin-card tally-pairing-card">
            <div><p className="admin-eyebrow">One-time pairing code</p>
              {pairingCode ? <><div className="tally-code-row"><output className="tally-code" aria-label="Pairing code">{pairingCode}</output><button type="button" className="admin-button ghost small" onClick={copyCode}>{copied ? "Copied" : "Copy code"}</button></div><p className="tally-code-expiry">Valid until {formatDateTime(pairingExpiry)}. It can be used once.</p></>
                : <><h2>A pairing code is already active</h2><p className="tally-code-expiry">Code ending in •••• {data.pairing?.codeHint}, valid until {formatDateTime(data.pairing?.expiresAt ?? null)}.</p></>}
            </div><button type="button" className="admin-button ghost small" disabled={working} onClick={cancelPairing}>Cancel code</button>
          </section>}

          {!data.connector && <section className="admin-card"><header className="admin-card-header"><div><p className="admin-eyebrow">Accounts computer</p><h2>Connect in three steps</h2></div></header>
            <ol className="tally-steps">
              <li><span>1</span><div><strong>Open Tally and the PSSPL Connector</strong><p>Keep the required company open in Tally on the accounts computer.</p></div></li>
              <li><span>2</span><div><strong>Enter the one-time code</strong><p>Copy the code shown above into the connector and confirm the company name.</p></div></li>
              <li><span>3</span><div><strong>Wait for Connected</strong><p>This page will show the computer, company and latest sync once pairing succeeds.</p></div></li>
            </ol>
          </section>}

          <div className="admin-stats tally-health-grid">
            <article className="admin-stat"><span className="admin-stat-label">Connector</span><strong className={data.connector?.status === "online" ? "tone-positive" : undefined}>{connectionLabel(data.connector?.status)}</strong><small>{data.connector?.machineName ?? "No computer paired"}</small></article>
            <article className="admin-stat"><span className="admin-stat-label">Tally company</span><strong>{data.connector?.tallyCompany ?? "Not selected"}</strong><small>{data.connector?.tallyVersion ? `Tally ${data.connector.tallyVersion}` : "Shown after connection"}</small></article>
            <article className="admin-stat"><span className="admin-stat-label">Last heartbeat</span><strong>{data.connector?.lastHeartbeatAt ? formatDateTime(data.connector.lastHeartbeatAt) : "—"}</strong><small>Confirms the connector is running</small></article>
            <article className="admin-stat"><span className="admin-stat-label">Last successful sync</span><strong>{formatDateTime(data.connector?.lastSyncAt ?? data.status.lastSyncAt)}</strong><small>{data.status.connected ? "Live connector data" : "Current CRM snapshot"}</small></article>
          </div>

          <section className="admin-card"><header className="admin-card-header"><div><p className="admin-eyebrow">Sync activity</p><h2>Recent data updates</h2></div><span className={`admin-pill ${["completed", "stored"].includes(data.syncRuns[0]?.status) ? "positive" : "neutral"}`}>{data.syncRuns.length ? `${data.syncRuns.length} recent runs` : "No runs yet"}</span></header>
            {data.syncRuns.length === 0 ? <p className="admin-note subtle">Sync history will appear here after the connector sends its first batch.</p> : <div className="admin-table-wrap"><table className="admin-table compact"><thead><tr><th>Started</th><th>Status</th><th>Records received</th><th>Completed</th></tr></thead><tbody>{data.syncRuns.map((run) => {
              let count = "—"; try { const parsed = JSON.parse(run.entityCountsJson ?? "{}"); count = formatNumber(Object.values(parsed).reduce((sum: number, value) => sum + Number(value || 0), 0)); } catch {}
              return <tr key={run.id}><td>{formatDateTime(run.startedAt)}</td><td><span className={`admin-pill ${["completed", "stored"].includes(run.status) ? "positive" : run.status === "failed" ? "negative" : "neutral"}`}>{run.status}</span>{run.errorMessage && <small>{run.errorMessage}</small>}</td><td>{count}</td><td>{formatDateTime(run.completedAt)}</td></tr>;
            })}</tbody></table></div>}
          </section>

          <section className="admin-card"><header className="admin-card-header"><div><p className="admin-eyebrow">Data available in CRM</p><h2>Imported Tally records</h2></div><span className={`admin-pill ${data.status.connected ? "positive" : "neutral"}`}>{data.status.mode.replace(/_/g, " ")}</span></header>
            <div className="tally-data-overview"><table className="admin-table compact"><thead><tr><th>Data set</th><th className="numeric">Records</th></tr></thead><tbody>{data.tables.map((row) => <tr key={row.table}><td><strong className="admin-cell-title">{row.label}</strong></td><td className="numeric">{formatNumber(row.rows)}</td></tr>)}</tbody></table>
              <dl className="admin-definition">{Object.entries(data.coverage).map(([key, range]) => <div key={key}><dt>{COVERAGE_LABEL[key] ?? key}</dt><dd>{range.start ? `${formatPeriod(range.start)} – ${formatPeriod(range.end)}` : "No data"}</dd></div>)}</dl>
            </div>{data.status.message && <p className="admin-note subtle">{data.status.message}</p>}
          </section>

          <section className="admin-card tally-reconciliation"><header className="admin-card-header"><div><p className="admin-eyebrow">Reconciliation</p><h2>Tally data health</h2></div><span className={`admin-pill ${data.reconciliation.status === "healthy" ? "positive" : "negative"}`}>{data.reconciliation.status === "healthy" ? "Checks passed" : `${formatNumber(data.reconciliation.criticalIssues)} issues`}</span></header>
            <p className="admin-note subtle">Automatically checked {formatDateTime(data.reconciliation.checkedAt)}. Line-value variance is shown separately because Tally voucher totals may include tax or adjustments.</p>
            <div className="admin-stats reconciliation-stats">
              <article className="admin-stat"><span className="admin-stat-label">Live invoices</span><strong>{formatNumber(data.reconciliation.totals.invoiceCount)}</strong><small>{formatRupees(data.reconciliation.totals.invoiceValue)} · {formatDate(data.reconciliation.totals.firstInvoiceDate)} to {formatDate(data.reconciliation.totals.lastInvoiceDate)}</small></article>
              <article className="admin-stat"><span className="admin-stat-label">Invoice lines</span><strong>{formatNumber(data.reconciliation.totals.lineCount)}</strong><small>{formatRupees(data.reconciliation.totals.lineValue)}</small></article>
              <article className="admin-stat"><span className="admin-stat-label">Payments</span><strong>{formatNumber(data.reconciliation.totals.paymentCount)}</strong><small>{formatRupees(data.reconciliation.totals.paymentValue)}</small></article>
              <article className="admin-stat"><span className="admin-stat-label">Unassigned customers</span><strong>{formatNumber(data.reconciliation.unassignedCustomers)}</strong><small>Require CRM ownership mapping</small></article>
            </div>
            {data.reconciliation.paymentsByType && data.reconciliation.paymentsByType.length > 0 && (
              <div className="admin-table-wrap payments-breakdown">
                <table className="admin-table compact">
                  <thead><tr><th>Voucher type</th><th className="numeric">Vouchers</th><th className="numeric">Value</th><th>Covering</th><th>Direction</th></tr></thead>
                  <tbody>
                    {data.reconciliation.paymentsByType.map((row) => {
                      const incoming = /receipt/i.test(row.type);
                      return <tr key={row.type}>
                        <td><strong className="admin-cell-title">{row.type}</strong></td>
                        <td className="numeric">{formatNumber(row.count)}</td>
                        <td className="numeric">{formatRupees(row.value)}</td>
                        <td>{formatDate(row.firstDate)} – {formatDate(row.lastDate)}</td>
                        <td><span className={`admin-pill ${incoming ? "positive" : "neutral"}`}>{incoming ? "Money in" : "Money out"}</span></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="reconciliation-checks">
              <Check label="Duplicate Tally GUIDs" value={data.reconciliation.duplicateVouchers.length} />
              <Check label="Invoices missing customer link" value={data.reconciliation.missingCustomers} />
              <Check label="Lines missing product link" value={data.reconciliation.missingProducts} />
              <Check label="Non-zero sales missing lines" value={data.reconciliation.invoicesWithoutLines} />
              <Check label="Stale incomplete syncs" value={data.reconciliation.staleSyncRuns} />
              <Check label="Ledger-only / zero-value vouchers" value={data.reconciliation.ledgerOnlyVouchers} warning />
              <Check label="Reused voucher numbers" value={data.reconciliation.reusedVoucherNumbers.length} warning />
              <Check label="Line-total variances" value={data.reconciliation.lineVariances.length} warning />
            </div>
            {data.reconciliation.missingLineInvoices.length > 0 && <div className="admin-table-wrap"><table className="admin-table compact"><thead><tr><th>Sales voucher requiring re-sync</th><th>Customer</th><th>Date</th><th className="numeric">Value</th></tr></thead><tbody>{data.reconciliation.missingLineInvoices.map((row) => <tr key={row.id}><td><strong className="admin-cell-title">{row.voucherNumber ?? "No voucher number"}</strong><small>{row.voucherGuid ?? "No Tally GUID"}</small></td><td>{row.customerName}</td><td>{formatDate(row.invoiceDate)}</td><td className="numeric">{formatRupees(row.amount)}</td></tr>)}</tbody></table></div>}
            {data.reconciliation.reusedVoucherNumbers.length > 0 && <details className="reconciliation-details"><summary>Review reused voucher numbers (different Tally GUIDs; not treated as duplicates)</summary><div className="admin-table-wrap"><table className="admin-table compact"><thead><tr><th>Voucher</th><th>Type</th><th>Date</th><th className="numeric">Tally records</th></tr></thead><tbody>{data.reconciliation.reusedVoucherNumbers.map((row, index) => <tr key={`${row.companyName}-${row.voucherNumber}-${index}`}><td>{row.voucherNumber}<small>{row.companyName}</small></td><td>{row.voucherType}</td><td>{formatDate(row.invoiceDate)}</td><td className="numeric">{row.count}</td></tr>)}</tbody></table></div></details>}
            {data.reconciliation.lineVariances.length > 0 && <details className="reconciliation-details"><summary>Review {data.reconciliation.lineVariances.length} largest invoice/line variances</summary><div className="admin-table-wrap"><table className="admin-table compact"><thead><tr><th>Voucher</th><th>Customer</th><th className="numeric">Invoice</th><th className="numeric">Lines</th><th className="numeric">Variance</th></tr></thead><tbody>{data.reconciliation.lineVariances.map((row) => <tr key={row.id}><td>{row.voucherNumber}<small>{formatDate(row.invoiceDate)}</small></td><td>{row.customerName}</td><td className="numeric">{formatRupees(row.invoiceValue)}</td><td className="numeric">{formatRupees(row.lineValue)}</td><td className="numeric">{formatRupees(row.variance)}</td></tr>)}</tbody></table></div></details>}
          </section>

          <section className="admin-card"><header className="admin-card-header"><div><p className="admin-eyebrow">Data quality</p><h2>RM name reconciliation</h2></div></header><p className="admin-note subtle">Different spellings found in source data are grouped under one regional manager for accurate reporting.</p>
            <div className="admin-table-wrap"><table className="admin-table compact"><thead><tr><th>Manager</th><th>Also spelled</th><th>Appears in</th></tr></thead><tbody>{data.directory.map((rm) => <tr key={rm.id}><td><strong className="admin-cell-title">{rm.name}</strong></td><td>{rm.aliases.length ? rm.aliases.join(", ") : <span className="admin-muted">One spelling only</span>}</td><td>{rm.sources.join(", ")}</td></tr>)}</tbody></table></div>
          </section>
        </>}
      </AdminState>
    </AdminPage>
  );
}

function Check({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div><span className={`admin-pill ${value === 0 ? "positive" : warning ? "neutral" : "negative"}`}>{value === 0 ? "Passed" : formatNumber(value)}</span><strong>{label}</strong></div>;
}
