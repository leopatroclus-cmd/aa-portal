"use client";
import { useState, useMemo } from "react";
import type { BURecord } from "@/lib/sheets";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BUEntry {
  name: string;
  label: string;
  records: BURecord[];
}

interface Props {
  buSheets: BUEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, prefix = "") {
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toFixed(0)}`;
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

const sum = (records: BURecord[], key: keyof BURecord) =>
  records.reduce((acc, r) => acc + (r[key] as number), 0);

// Month display order (FY)
const FY_MONTHS = ["April","May","June","July","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

// Month → calendar number (for sortKey computation)
const MONTH_TO_CAL: Record<string, number> = {
  January:1,Jan:1, February:2,Feb:2, March:3,Mar:3,
  April:4,Apr:4,  May:5,            June:6,Jun:6,
  July:7,Jul:7,   August:8,Aug:8,   September:9,Sep:9,
  October:10,Oct:10, November:11,Nov:11, December:12,Dec:12,
};

function sortKey(month: string, year: number) {
  return year * 100 + (MONTH_TO_CAL[month] ?? 0);
}

// ─── Add/Edit BU Schema (for entry modal) ────────────────────────────────────

interface FieldDef { label: string; group?: string }
interface BUSchema  { newTab: string; fields: FieldDef[] }

const BU_SCHEMA: Record<string, BUSchema> = {
  "AASA": {
    newTab: "AASA_new",
    fields: [
      { label: "Airfreight Shipments", group: "Airfreight" },
      { label: "Airfreight Weight (kg)" }, { label: "Airfreight Profit (USD)" },
      { label: "Solution Shipments", group: "Solution" },
      { label: "Solution Weight (kg)" }, { label: "Solution Profit (USD)" },
      { label: "Staff", group: "General" },
    ],
  },
  "AAINT ": {
    newTab: "AAINT_new",
    fields: [
      { label: "Export Shipments", group: "Airfreight Export" },
      { label: "Export Weight (kg)" }, { label: "Export Profit (USD)" },
      { label: "Import Shipments", group: "Airfreight Import" },
      { label: "Import Weight (kg)" }, { label: "Import Profit (USD)" },
      { label: "Ocean Shipments", group: "Ocean Freight" },
      { label: "Ocean Weight (CBM)" }, { label: "Ocean Profit (USD)" },
      { label: "Staff", group: "General" },
    ],
  },
  "AAEA": {
    newTab: "AAEA_new",
    fields: [
      { label: "Airfreight Shipments", group: "Airfreight" },
      { label: "Airfreight Weight (kg)" }, { label: "Airfreight Profit (USD)" },
      { label: "Solution Shipments", group: "Solution" },
      { label: "Solution Weight (kg)" }, { label: "Solution Profit (USD)" },
      { label: "Gulf Air Shipments", group: "Gulf Air" },
      { label: "Gulf Air Weight (kg)" }, { label: "Gulf Air Profit (USD)" },
      { label: "Staff", group: "General" },
    ],
  },
  "AAWN": {
    newTab: "AAWN_new",
    fields: [
      { label: "Airfreight Shipments", group: "Airfreight" },
      { label: "Airfreight Weight (kg)" }, { label: "Airfreight Profit (USD)" },
      { label: "Solution Shipments", group: "Solution" },
      { label: "Solution Weight (kg)" }, { label: "Solution Profit (USD)" },
      { label: "Staff", group: "General" },
    ],
  },
  "AACN ": {
    newTab: "AACN_new",
    fields: [
      { label: "Airfreight Shipments", group: "Airfreight" },
      { label: "Airfreight Weight (kg)" }, { label: "Airfreight Profit (USD)" },
      { label: "Solution Shipments", group: "Solution" },
      { label: "Solution Weight (kg)" }, { label: "Solution Profit (USD)" },
      { label: "Staff", group: "General" },
    ],
  },
  "AAMA ": {
    newTab: "AAMA_new",
    fields: [
      { label: "Airfreight Shipments", group: "Airfreight" },
      { label: "Airfreight Weight (kg)" }, { label: "Airfreight Profit (USD)" },
      { label: "Solution Shipments", group: "Solution" },
      { label: "Solution Weight (kg)" }, { label: "Solution Profit (USD)" },
      { label: "Staff", group: "General" },
    ],
  },
};

const MONTH_NAME_MAP: Record<string, string> = {
  "Apr":"April","May":"May","Jun":"June","Jul":"July",
  "Aug":"Aug","Sep":"Sep","Oct":"Oct","Nov":"Nov",
  "Dec":"Dec","Jan":"Jan","Feb":"Feb","Mar":"Mar",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BUDashboard({ buSheets }: Props) {
  const [selected, setSelected] = useState(0);

  const bu = buSheets[selected];
  const allRecords = bu.records;

  // ── Date range filter ────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    buSheets.forEach((b) => b.records.forEach((r) => ys.add(r.year)));
    return Array.from(ys).sort();
  }, [buSheets]);

  const minYear = availableYears[0] ?? new Date().getFullYear();
  const maxYear = availableYears[availableYears.length - 1] ?? new Date().getFullYear();

  // Default from = earliest record, to = latest record
  const firstRecord = allRecords[0];
  const lastRecord  = allRecords[allRecords.length - 1];

  const [fromMonth, setFromMonth] = useState(firstRecord?.month ?? "April");
  const [fromYear,  setFromYear]  = useState(firstRecord?.year  ?? minYear);
  const [toMonth,   setToMonth]   = useState(lastRecord?.month  ?? "Mar");
  const [toYear,    setToYear]    = useState(lastRecord?.year   ?? maxYear);

  const fromKey = sortKey(fromMonth, fromYear);
  const toKey   = sortKey(toMonth,   toYear);

  const filtered = useMemo(
    () => allRecords.filter((r) => r.sortKey >= fromKey && r.sortKey <= toKey),
    [allRecords, fromKey, toKey]
  );

  const isFiltered = fromKey !== (firstRecord ? sortKey(firstRecord.month, firstRecord.year) : 0)
    || toKey !== (lastRecord ? sortKey(lastRecord.month, lastRecord.year) : 0);

  // ── Totals from filtered records ─────────────────────────────────────────
  const ft = useMemo(() => {
    const s = (key: keyof BURecord) => sum(filtered, key);
    const afShips  = s("airfreightShipments");
    const totProfit = s("totalProfit");
    return {
      airfreightShipments: afShips,
      airfreightWeight:    s("airfreightWeight"),
      airfreightProfit:    s("airfreightProfit"),
      solutionShipments:   s("solutionShipments"),
      solutionWeight:      s("solutionWeight"),
      solutionProfit:      s("solutionProfit"),
      oceanShipments:      s("oceanShipments"),
      oceanWeight:         s("oceanWeight"),
      oceanProfit:         s("oceanProfit"),
      gulfShipments:       s("gulfShipments"),
      gulfWeight:          s("gulfWeight"),
      gulfProfit:          s("gulfProfit"),
      totalProfit:         totProfit,
      profitPerShipment:   afShips > 0 ? totProfit / afShips : 0,
      staff:               filtered.length > 0 ? filtered[filtered.length - 1].staff : 0,
    };
  }, [filtered]);

  // ── Chart data ───────────────────────────────────────────────────────────
  const chartData = filtered.map((r) => ({
    month: `${r.month} ${r.year}`,
    profit: r.totalProfit,
    shipments: r.airfreightShipments,
  }));

  // ── Edit modal state ─────────────────────────────────────────────────────
  const [showModal, setShowModal]   = useState(false);
  const [modalBU,   setModalBU]     = useState<BUEntry | null>(null);
  const [editMonth, setEditMonth]   = useState("April");
  const [editYear,  setEditYear]    = useState(new Date().getFullYear());
  const [fieldValues, setFieldValues] = useState<string[]>([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [fetching,    setFetching]    = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const openModal = async (buEntry: BUEntry, prefillMonth?: string, prefillYear?: number) => {
    const schema = BU_SCHEMA[buEntry.name];
    if (!schema) return;
    const m = prefillMonth ?? "April";
    const y = prefillYear ?? new Date().getFullYear();
    setModalBU(buEntry);
    setEditMonth(m);
    setEditYear(y);
    setFieldValues(schema.fields.map(() => ""));
    setSubmitError("");
    setSubmitSuccess(false);
    setShowModal(true);
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
      } catch { /* ignore */ } finally { setFetching(false); }
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    setSubmitError("");
    setSubmitSuccess(false);
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
        body: JSON.stringify({ tab: schema.newTab, month: editMonth, year: editYear, fields: fieldValues }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || "Something went wrong."); return; }
      setSubmitSuccess(true);
      setTimeout(() => { setShowModal(false); setSubmitSuccess(false); }, 2000);
    } catch { setSubmitError("Network error. Please try again."); }
    finally  { setSubmitting(false); }
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--surface2)", border: "1px solid var(--border)",
    color: "var(--text)", borderRadius: "0.5rem",
    padding: "0.45rem 0.75rem", width: "100%", fontSize: "0.875rem", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "0.72rem", fontWeight: 500,
    color: "var(--muted)", marginBottom: "0.2rem",
    textTransform: "uppercase", letterSpacing: "0.04em",
  };
  const schema = modalBU ? BU_SCHEMA[modalBU.name] : null;

  const selectStyle: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)",
    color: "var(--text)", borderRadius: "0.5rem",
    padding: "0.375rem 0.625rem", fontSize: "0.875rem", outline: "none",
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Business Unit Report</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Aero Africa</p>
      </div>

      {/* BU Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {buSheets.map((b, i) => (
          <div key={b.name} className="flex items-center gap-1">
            <button
              onClick={() => setSelected(i)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: selected === i ? "var(--accent)" : "var(--surface2)",
                color: selected === i ? "#fff" : "var(--text)",
                border: "1px solid", borderColor: selected === i ? "var(--accent)" : "var(--border)",
              }}
            >
              {b.label}
            </button>
            {BU_SCHEMA[b.name] && (
              <button
                onClick={() => openModal(b)}
                title={`Add entry for ${b.label}`}
                style={{
                  width: "28px", height: "36px", background: "var(--surface2)",
                  color: "var(--accent)", border: "1px solid var(--border)",
                  borderRadius: "0.5rem", cursor: "pointer", fontWeight: 700, fontSize: "1rem",
                }}
              >+</button>
            )}
          </div>
        ))}
      </div>

      {/* Period Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-3 rounded-xl"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Period</span>

        {/* From */}
        <div className="flex items-center gap-1.5">
          <select value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} style={selectStyle}>
            {FY_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))} style={selectStyle}>
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <span style={{ color: "var(--muted)", fontSize: "0.875rem" }}>→</span>

        {/* To */}
        <div className="flex items-center gap-1.5">
          <select value={toMonth} onChange={(e) => setToMonth(e.target.value)} style={selectStyle}>
            {FY_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={toYear} onChange={(e) => setToYear(Number(e.target.value))} style={selectStyle}>
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {isFiltered && (
          <button
            onClick={() => {
              setFromMonth(firstRecord?.month ?? "April");
              setFromYear(firstRecord?.year   ?? minYear);
              setToMonth(lastRecord?.month ?? "Mar");
              setToYear(lastRecord?.year   ?? maxYear);
            }}
            style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              color: "var(--accent)", borderRadius: "0.5rem",
              padding: "0.375rem 0.75rem", fontSize: "0.75rem", cursor: "pointer",
            }}
          >Reset</button>
        )}

        <span className="text-xs ml-auto" style={{ color: "var(--muted)" }}>
          {filtered.length} month{filtered.length !== 1 ? "s" : ""}
          {isFiltered && ` • filtered`}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Total Profit"         value={fmtUSD(ft.totalProfit)}                                   sub="All freight types" />
          <KPICard label="Profit / Shipment"    value={ft.profitPerShipment ? fmtUSD(ft.profitPerShipment) : "—"} sub="Air freight"       />
          <KPICard label="Staff"                value={String(ft.staff || "—")}                                   sub="incl. managers"    />
          <KPICard label="AF Shipments"         value={fmt(ft.airfreightShipments)}                              sub="Total files"       />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: "var(--muted)" }}>Air Freight</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KPICard label="Shipments"         value={fmt(ft.airfreightShipments)}              sub="Total files"  />
            <KPICard label="Chargeable Weight" value={fmt(ft.airfreightWeight, "") + " kg"}      sub="Air freight"  />
            <KPICard label="Profit (USD)"      value={fmtUSD(ft.airfreightProfit)}               sub="Air freight"  />
          </div>
        </div>

        {ft.solutionShipments > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: "var(--muted)" }}>Solution</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KPICard label="Shipments"         value={fmt(ft.solutionShipments)}             sub="Solution files" />
              <KPICard label="Chargeable Weight" value={fmt(ft.solutionWeight, "") + " kg"}     sub="Solution"       />
              <KPICard label="Profit (USD)"      value={fmtUSD(ft.solutionProfit)}              sub="Solution"       />
            </div>
          </div>
        )}

        {ft.oceanShipments > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: "var(--muted)" }}>Ocean Freight</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KPICard label="Shipments"   value={fmt(ft.oceanShipments)}               sub="Ocean files"  />
              <KPICard label="Weight (CBM)" value={fmt(ft.oceanWeight, "") + " CBM"}    sub="Ocean"        />
              <KPICard label="Profit (USD)" value={fmtUSD(ft.oceanProfit)}               sub="Ocean"        />
            </div>
          </div>
        )}

        {ft.gulfShipments > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: "var(--muted)" }}>Gulf Air</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KPICard label="Shipments / AWBs"  value={fmt(ft.gulfShipments)}          sub="Gulf Air" />
              <KPICard label="Chargeable Weight" value={fmt(ft.gulfWeight, "") + " kg"} sub="Gulf Air" />
              <KPICard label="Profit (USD)"      value={fmtUSD(ft.gulfProfit)}           sub="Gulf Air" />
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="p-5 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--muted)" }}>Monthly Total Profit (USD)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
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
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--muted)" }}>Monthly Shipments</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
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

      {/* Monthly Table */}
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
              {filtered.map((r, i) => {
                const hasSchema = !!BU_SCHEMA[bu.name];
                const tabMonth  = MONTH_NAME_MAP[r.month] ?? r.month;
                return (
                  <tr
                    key={`${r.month}-${r.year}`}
                    onClick={() => hasSchema && openModal(bu, tabMonth, r.year)}
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: i % 2 === 0 ? "var(--surface)" : "transparent",
                      cursor: hasSchema ? "pointer" : "default",
                    }}
                    className={hasSchema ? "hover:opacity-80 transition-opacity" : ""}
                  >
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text)" }}>
                      <span className="flex items-center gap-1.5">
                        {r.month} {r.year}
                        {hasSchema && <span style={{ fontSize: "0.65rem", color: "var(--accent)", opacity: 0.7 }}>✎ edit</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                      {r.airfreightShipments ? r.airfreightShipments.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                      {r.airfreightWeight ? Math.round(r.airfreightWeight).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium"
                      style={{ color: r.totalProfit > 0 ? "var(--accent)" : r.totalProfit < 0 ? "#dc2626" : "var(--muted)" }}>
                      {r.totalProfit ? fmtUSD(r.totalProfit) : "—"}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center py-10" style={{ color: "var(--muted)" }}>No data for selected period</td></tr>
              )}
              <tr style={{ borderTop: "2px solid var(--accent)", background: "var(--surface2)" }}>
                <td className="px-4 py-3 font-semibold" style={{ color: "var(--text)" }}>
                  Total{isFiltered ? ` (${filtered.length} mo.)` : ""}
                </td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text)" }}>
                  {ft.airfreightShipments.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text)" }}>
                  {Math.round(ft.airfreightWeight).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--accent)" }}>
                  {fmtUSD(ft.totalProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && modalBU && schema && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[60] p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "90vh", overflowY: "auto" }}>
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Month</label>
                    <select value={editMonth} onChange={(e) => setEditMonth(e.target.value)} style={inputStyle}>
                      {FY_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Year</label>
                    <input type="number" value={editYear} onChange={(e) => setEditYear(Number(e.target.value))}
                      min={2020} max={2099} style={inputStyle} />
                  </div>
                </div>

                {(() => {
                  const elements: React.ReactNode[] = [];
                  let currentGroup = "";
                  const groupFields: { def: FieldDef; idx: number }[] = [];
                  const flushGroup = () => {
                    if (!groupFields.length) return;
                    const cols = groupFields.length === 1 ? "grid-cols-1" : groupFields.length === 2 ? "grid-cols-2" : "grid-cols-3";
                    elements.push(
                      <div key={currentGroup}>
                        {currentGroup && (
                          <div className="text-xs font-semibold uppercase tracking-wider mb-2"
                            style={{ color: "var(--accent)", borderBottom: "1px solid var(--border)", paddingBottom: "4px" }}>
                            {currentGroup}
                          </div>
                        )}
                        <div className={`grid ${cols} gap-3`}>
                          {groupFields.map(({ def, idx }) => (
                            <div key={idx}>
                              <label style={labelStyle}>{def.label}</label>
                              <input type="number" step="any" value={fieldValues[idx]}
                                onChange={(e) => {
                                  const vals = [...fieldValues];
                                  vals[idx] = e.target.value;
                                  setFieldValues(vals);
                                }}
                                placeholder="0" style={inputStyle} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                    groupFields.length = 0;
                  };
                  schema.fields.forEach((def, idx) => {
                    if (def.group && def.group !== currentGroup) { flushGroup(); currentGroup = def.group; }
                    groupFields.push({ def, idx });
                  });
                  flushGroup();
                  return elements;
                })()}

                {submitError && <p className="text-sm" style={{ color: "#dc2626" }}>{submitError}</p>}

                <div className="flex flex-col gap-2 pt-1">
                  <button type="submit" disabled={submitting} style={{
                    background: submitting ? "var(--muted)" : "var(--accent)", color: "#fff",
                    border: "none", borderRadius: "0.5rem", padding: "0.625rem",
                    fontWeight: 600, fontSize: "0.875rem",
                    cursor: submitting ? "not-allowed" : "pointer", width: "100%",
                  }}>
                    {submitting ? "Saving…" : "Update Entry"}
                  </button>
                  <button type="button" onClick={closeModal} style={{
                    background: "none", border: "none", color: "var(--muted)",
                    cursor: "pointer", fontSize: "0.875rem", padding: "0.375rem",
                  }}>Cancel</button>
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
      <div className="text-xl sm:text-2xl font-bold mb-0.5 truncate" style={{ color: "var(--text)" }}>{value}</div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>{sub}</div>
    </div>
  );
}
