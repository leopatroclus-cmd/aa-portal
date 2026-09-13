"use client";
import { useState } from "react";
import type { BUData } from "@/lib/sheets";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BUEntry {
  name: string;
  label: string;
  data: BUData;
}

interface Props {
  buSheets: BUEntry[];
}

function fmt(n: number, prefix = "") {
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toFixed(0)}`;
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// Map BU name → _new tab name and field schema
interface FieldDef {
  label: string;
  group?: string; // section header
}

interface BUSchema {
  newTab: string;
  fields: FieldDef[];
}

// "CONSOLIDATED OPS" is excluded — it's an aggregation, not a data-entry BU
const BU_SCHEMA: Record<string, BUSchema> = {
  "AASA": {
    newTab: "AASA_new",
    fields: [
      { label: "Airfreight Shipments", group: "Airfreight" },
      { label: "Airfreight Weight (kg)" },
      { label: "Airfreight Profit (USD)" },
      { label: "Solution Shipments", group: "Solution" },
      { label: "Solution Weight (kg)" },
      { label: "Solution Profit (USD)" },
      { label: "Staff", group: "General" },
    ],
  },
  "AAINT ": {
    newTab: "AAINT_new",
    fields: [
      { label: "Export Shipments", group: "Airfreight Export" },
      { label: "Export Weight (kg)" },
      { label: "Export Profit (USD)" },
      { label: "Import Shipments", group: "Airfreight Import" },
      { label: "Import Weight (kg)" },
      { label: "Import Profit (USD)" },
      { label: "Ocean Shipments", group: "Ocean Freight" },
      { label: "Ocean Weight (CBM)" },
      { label: "Ocean Profit (USD)" },
      { label: "Staff", group: "General" },
    ],
  },
  "AAEA": {
    newTab: "AAEA_new",
    fields: [
      { label: "Airfreight Shipments", group: "Airfreight" },
      { label: "Airfreight Weight (kg)" },
      { label: "Airfreight Profit (USD)" },
      { label: "Solution Shipments", group: "Solution" },
      { label: "Solution Weight (kg)" },
      { label: "Solution Profit (USD)" },
      { label: "Gulf Air Shipments", group: "Gulf Air" },
      { label: "Gulf Air Weight (kg)" },
      { label: "Gulf Air Profit (USD)" },
      { label: "Staff", group: "General" },
    ],
  },
  "AAWN": {
    newTab: "AAWN_new",
    fields: [
      { label: "Airfreight Shipments", group: "Airfreight" },
      { label: "Airfreight Weight (kg)" },
      { label: "Airfreight Profit (USD)" },
      { label: "Solution Shipments", group: "Solution" },
      { label: "Solution Weight (kg)" },
      { label: "Solution Profit (USD)" },
      { label: "Staff", group: "General" },
    ],
  },
  "AACN ": {
    newTab: "AACN_new",
    fields: [
      { label: "Airfreight Shipments", group: "Airfreight" },
      { label: "Airfreight Weight (kg)" },
      { label: "Airfreight Profit (USD)" },
      { label: "Solution Shipments", group: "Solution" },
      { label: "Solution Weight (kg)" },
      { label: "Solution Profit (USD)" },
      { label: "Staff", group: "General" },
    ],
  },
  "AAMA ": {
    newTab: "AAMA_new",
    fields: [
      { label: "Airfreight Shipments", group: "Airfreight" },
      { label: "Airfreight Weight (kg)" },
      { label: "Airfreight Profit (USD)" },
      { label: "Solution Shipments", group: "Solution" },
      { label: "Solution Weight (kg)" },
      { label: "Solution Profit (USD)" },
      { label: "Staff", group: "General" },
    ],
  },
};

// Must match month names used in _new sheets (mixed full/abbreviated)
const MONTHS = ["April", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

// Map from BUData display months (e.g. "Apr") → _new tab month names
const MONTH_NAME_MAP: Record<string, string> = {
  "Apr": "April", "May": "May", "Jun": "June", "Jul": "July",
  "Aug": "Aug", "Sep": "Sep", "Oct": "Oct", "Nov": "Nov",
  "Dec": "Dec", "Jan": "Jan", "Feb": "Feb", "Mar": "Mar",
};

// FYE: Apr–Dec = 2025, Jan–Mar = 2026
const MONTH_YEAR_MAP: Record<string, number> = {
  "Apr": 2025, "May": 2025, "Jun": 2025, "Jul": 2025,
  "Aug": 2025, "Sep": 2025, "Oct": 2025, "Nov": 2025, "Dec": 2025,
  "Jan": 2026, "Feb": 2026, "Mar": 2026,
};

export default function BUDashboard({ buSheets }: Props) {
  const [selected, setSelected] = useState(0);
  const bu = buSheets[selected];
  const d = bu.data;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalBU, setModalBU] = useState<BUEntry | null>(null);
  const [month, setMonth] = useState("April");
  const [year, setYear] = useState(new Date().getFullYear());
  const [fieldValues, setFieldValues] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const chartData = d.months.map((m, i) => ({
    month: m,
    profit: d.totalProfit[i],
    shipments: d.shipments[i],
    weight: Math.round(d.weight[i]),
  }));

  const openModal = async (buEntry: BUEntry, prefillMonth?: string, prefillYear?: number) => {
    const schema = BU_SCHEMA[buEntry.name];
    if (!schema) return;

    const m = prefillMonth ?? "April";
    const y = prefillYear ?? new Date().getFullYear();

    setModalBU(buEntry);
    setMonth(m);
    setYear(y);
    setFieldValues(schema.fields.map(() => ""));
    setSubmitError("");
    setSubmitSuccess(false);
    setShowModal(true);

    // Fetch existing row data if a specific month was clicked
    if (prefillMonth) {
      setFetching(true);
      try {
        const res = await fetch(
          `/api/bu-entries?tab=${encodeURIComponent(schema.newTab)}&month=${encodeURIComponent(m)}&year=${y}`
        );
        const data = await res.json();
        if (data.found && data.fields.length > 0) {
          setFieldValues(schema.fields.map((_, i) => data.fields[i] ?? ""));
        }
      } catch {
        // silently ignore — user can fill in manually
      } finally {
        setFetching(false);
      }
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    setSubmitError("");
    setSubmitSuccess(false);
  };

  const updateField = (i: number, val: string) => {
    setFieldValues((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalBU) return;
    const schema = BU_SCHEMA[modalBU.name];
    if (!schema) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/bu-entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: schema.newTab,
          month,
          year,
          fields: fieldValues,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Something went wrong.");
        return;
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        setShowModal(false);
        setSubmitSuccess(false);
      }, 2000);
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: "0.5rem",
    padding: "0.45rem 0.75rem",
    width: "100%",
    fontSize: "0.875rem",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.72rem",
    fontWeight: 500,
    color: "var(--muted)",
    marginBottom: "0.2rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  const schema = modalBU ? BU_SCHEMA[modalBU.name] : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          Business Unit Report
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Aero Africa — FYE 2026 (Apr 2025 – Mar 2026)
        </p>
      </div>

      {/* BU Selector */}
      <div className="flex flex-wrap gap-2 mb-8">
        {buSheets.map((b, i) => (
          <div key={b.name} className="flex items-center gap-1">
            <button
              onClick={() => setSelected(i)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: selected === i ? "var(--accent)" : "var(--surface2)",
                color: selected === i ? "#fff" : "var(--text)",
                border: "1px solid",
                borderColor: selected === i ? "var(--accent)" : "var(--border)",
              }}
            >
              {b.label}
            </button>
            {BU_SCHEMA[b.name] && (
              <button
                onClick={() => openModal(b)}
                title={`Add entry for ${b.label}`}
                className="flex items-center justify-center rounded-lg text-xs font-bold transition-colors"
                style={{
                  width: "28px",
                  height: "36px",
                  background: "var(--surface2)",
                  color: "var(--accent)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                +
              </button>
            )}
          </div>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="space-y-4 mb-8">
        {/* Row 1: Core */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Total Profit" value={fmtUSD(d.totals.totalProfit)} sub="All freight types" />
          <KPICard label="Profit / Shipment" value={d.totals.profitPerShipment ? fmtUSD(d.totals.profitPerShipment) : "—"} sub="Air freight" />
          <KPICard label="Staff" value={String(d.staff || "—")} sub="incl. managers" />
          <KPICard label="Air Freight Shipments" value={fmt(d.totals.shipments)} sub="Total files" />
        </div>

        {/* Row 2: Air Freight */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: "var(--muted)" }}>Air Freight</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KPICard label="Shipments" value={fmt(d.totals.shipments)} sub="Total files" />
            <KPICard label="Chargeable Weight" value={fmt(d.totals.weight, "") + " kg"} sub="Air freight" />
            <KPICard label="Profit (USD)" value={fmtUSD(d.totals.profit)} sub="Air freight" />
          </div>
        </div>

        {/* Row 3: Solution (if any) */}
        {d.totals.solutionShipments > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: "var(--muted)" }}>Solution</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KPICard label="Shipments" value={fmt(d.totals.solutionShipments)} sub="Solution files" />
              <KPICard label="Chargeable Weight" value={fmt(d.totals.solutionWeight, "") + " kg"} sub="Solution" />
              <KPICard label="Profit (USD)" value={fmtUSD(d.totals.solutionProfit)} sub="Solution" />
            </div>
          </div>
        )}

        {/* Row 4: Ocean Freight — INT only */}
        {d.totals.oceanShipments > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: "var(--muted)" }}>Ocean Freight</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KPICard label="Shipments" value={fmt(d.totals.oceanShipments)} sub="Ocean files" />
              <KPICard label="Weight (CBM)" value={fmt(d.totals.oceanWeight, "") + " CBM"} sub="Ocean" />
              <KPICard label="Profit (USD)" value={fmtUSD(d.totals.oceanProfit)} sub="Ocean" />
            </div>
          </div>
        )}

        {/* Row 5: Gulf Air — EA / Consolidated only */}
        {d.totals.gulfShipments > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: "var(--muted)" }}>Gulf Air</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KPICard label="Shipments / AWBs" value={fmt(d.totals.gulfShipments)} sub="Gulf Air" />
              <KPICard label="Chargeable Weight" value={fmt(d.totals.gulfWeight, "") + " kg"} sub="Gulf Air" />
              <KPICard label="Profit (USD)" value={fmtUSD(d.totals.gulfProfit)} sub="Gulf Air" />
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="p-5 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--muted)" }}>
            Monthly Total Profit (USD)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v, "$")} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8 }}
                labelStyle={{ color: "var(--text)", fontWeight: 600 }}
                formatter={(v) => [fmtUSD(Number(v)), "Profit"]}
              />
              <Bar dataKey="profit" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--muted)" }}>
            Monthly Shipments
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8 }}
                labelStyle={{ color: "var(--text)", fontWeight: 600 }}
                formatter={(v) => [Number(v).toLocaleString(), "Shipments"]}
              />
              <Line type="monotone" dataKey="shipments" stroke="var(--accent)" strokeWidth={2.5}
                dot={{ fill: "var(--accent)", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-5 py-3" style={{ background: "var(--surface2)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
            Monthly Breakdown — {bu.label}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="text-left px-4 py-3 font-medium">Month</th>
                <th className="text-right px-4 py-3 font-medium">Shipments</th>
                <th className="text-right px-4 py-3 font-medium">Weight (kg)</th>
                <th className="text-right px-4 py-3 font-medium">Total Profit</th>
              </tr>
            </thead>
            <tbody>
              {d.months.map((m, i) => {
                const hasSchema = !!BU_SCHEMA[bu.name];
                const tabMonth = MONTH_NAME_MAP[m] ?? m;
                const tabYear = MONTH_YEAR_MAP[m] ?? new Date().getFullYear();
                return (
                <tr
                  key={m}
                  onClick={() => hasSchema && openModal(bu, tabMonth, tabYear)}
                  style={{
                    borderTop: "1px solid var(--border)",
                    background: i % 2 === 0 ? "var(--surface)" : "transparent",
                    cursor: hasSchema ? "pointer" : "default",
                  }}
                  title={hasSchema ? `Edit ${m} data` : undefined}
                  className={hasSchema ? "hover:opacity-80 transition-opacity" : ""}
                >
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      {m}
                      {hasSchema && <span style={{ fontSize: "0.65rem", color: "var(--accent)", opacity: 0.7 }}>✎ edit</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                    {d.shipments[i] ? d.shipments[i].toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                    {d.weight[i] ? Math.round(d.weight[i]).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium"
                    style={{ color: d.totalProfit[i] > 0 ? "var(--accent)" : d.totalProfit[i] < 0 ? "#dc2626" : "var(--muted)" }}>
                    {d.totalProfit[i] ? fmtUSD(d.totalProfit[i]) : "—"}
                  </td>
                </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid var(--accent)", background: "var(--surface2)" }}>
                <td className="px-4 py-3 font-semibold" style={{ color: "var(--text)" }}>Total</td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text)" }}>
                  {d.totals.shipments.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text)" }}>
                  {Math.round(d.totals.weight).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--accent)" }}>
                  {fmtUSD(d.totals.totalProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Entry Modal */}
      {showModal && modalBU && schema && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[60] p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "90vh", overflowY: "auto" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>Edit Entry</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{modalBU.label}</p>
              </div>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
            </div>

            {submitSuccess ? (
              <div className="px-6 py-12 text-center">
                <div className="text-3xl mb-3">✅</div>
                <p className="font-semibold" style={{ color: "var(--text)" }}>Saved!</p>
                <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Refresh to see changes.</p>
              </div>
            ) : fetching ? (
              <div className="px-6 py-12 text-center" style={{ color: "var(--muted)" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⏳</div>
                Loading existing data…
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                {/* Month + Year */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Month</label>
                    <select value={month} onChange={(e) => setMonth(e.target.value)} style={inputStyle}>
                      {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Year</label>
                    <input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      min={2020}
                      max={2099}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Dynamic fields grouped by section */}
                {(() => {
                  const elements: React.ReactNode[] = [];
                  let currentGroup = "";
                  const groupFields: { def: FieldDef; idx: number }[] = [];

                  const flushGroup = () => {
                    if (groupFields.length === 0) return;
                    const cols = groupFields.length === 1 ? "grid-cols-1" : groupFields.length === 2 ? "grid-cols-2" : "grid-cols-3";
                    elements.push(
                      <div key={currentGroup}>
                        {currentGroup && (
                          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--accent)", borderBottom: "1px solid var(--border)", paddingBottom: "4px" }}>
                            {currentGroup}
                          </div>
                        )}
                        <div className={`grid ${cols} gap-3`}>
                          {groupFields.map(({ def, idx }) => (
                            <div key={idx}>
                              <label style={labelStyle}>{def.label}</label>
                              <input
                                type="number"
                                step="any"
                                value={fieldValues[idx]}
                                onChange={(e) => updateField(idx, e.target.value)}
                                placeholder="0"
                                style={inputStyle}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                    groupFields.length = 0;
                  };

                  schema.fields.forEach((def, idx) => {
                    if (def.group && def.group !== currentGroup) {
                      flushGroup();
                      currentGroup = def.group;
                    }
                    groupFields.push({ def, idx });
                  });
                  flushGroup();

                  return elements;
                })()}

                {submitError && (
                  <p className="text-sm" style={{ color: "#dc2626" }}>{submitError}</p>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      background: submitting ? "var(--muted)" : "var(--accent)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "0.5rem",
                      padding: "0.625rem",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      cursor: submitting ? "not-allowed" : "pointer",
                      width: "100%",
                    }}
                  >
                    {submitting ? "Saving…" : "Update Entry"}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.875rem", padding: "0.375rem" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="p-5 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-2xl font-bold mb-0.5" style={{ color: "var(--text)" }}>{value}</div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>{sub}</div>
    </div>
  );
}
