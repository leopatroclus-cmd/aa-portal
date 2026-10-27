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

const MONTH_NAME_MAP: Record<string, string> = {
  "Apr":"April","May":"May","Jun":"June","Jul":"July",
  "Aug":"Aug","Sep":"Sep","Oct":"Oct","Nov":"Nov",
  "Dec":"Dec","Jan":"Jan","Feb":"Feb","Mar":"Mar",
};

// ─── Entry Form State ─────────────────────────────────────────────────────────

// Flat field order (maps to spreadsheet columns C onwards):
// [0]  exportAF_shipments
// [1]  exportAF_ownSales
// [2]  exportAF_routedAgents
// [3]  exportAF_weight
// [4]  exportAF_profit
// [5]  importAF_shipments
// [6]  importAF_ownSales
// [7]  importAF_routedAgents
// [8]  importAF_weight
// [9]  importAF_profit
// [10] gsa_shipments
// [11] gsa_weight
// [12] gsa_profit
// [13] exportFCL_shipments
// [14] exportFCL_ownSales
// [15] exportFCL_routedAgents
// [16] exportFCL_teus
// [17] exportFCL_profit
// [18] importFCL_shipments
// [19] importFCL_ownSales
// [20] importFCL_routedAgents
// [21] importFCL_teus
// [22] importFCL_profit
// [23] exportLCL_shipments
// [24] exportLCL_ownSales
// [25] exportLCL_routedAgents
// [26] exportLCL_cbms
// [27] exportLCL_profit
// [28] importLCL_shipments
// [29] importLCL_ownSales
// [30] importLCL_routedAgents
// [31] importLCL_cbms
// [32] importLCL_profit
// [33] specialFiles
// [34] specialProfit
// [35] multimodalShipments
// [36] multimodalProfit
// [37] totalProfit
// [38] staff
// [39] exportsImportsSummary
// [40] activeAgents
// [41] newCustomers
// [42] lostCustomers
// [43] vendorIssues
// [44] noOfQuotes
// [45] newProducts
// [46] noteworthyShipments
// [47] paymentIssues
// [48] staffIssues
const TOTAL_FIELDS = 49;

function emptyFields(): string[] {
  return Array(TOTAL_FIELDS).fill("");
}

function p(val: string): number {
  const n = parseFloat(val.replace(/[$,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

// ─── Entry Modal ──────────────────────────────────────────────────────────────

type ToggleCategory = "gsa" | "fcl" | "lcl" | "special" | "multimodal";

interface EntryModalProps {
  buEntry: BUEntry;
  onClose: () => void;
  prefillMonth?: string;
  prefillYear?: number;
  newTab: string;
}

function EntryModal({ buEntry, onClose, prefillMonth, prefillYear, newTab }: EntryModalProps) {
  const [editMonth, setEditMonth] = useState(prefillMonth ?? "April");
  const [editYear, setEditYear]   = useState(prefillYear ?? new Date().getFullYear());
  const [fields, setFields]       = useState<string[]>(emptyFields);
  const [toggled, setToggled]     = useState<Set<ToggleCategory>>(new Set());
  const [fetching, setFetching]   = useState(!!prefillMonth);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Pre-fill on mount if editing existing row
  useMemo(() => {
    if (!prefillMonth) return;
    setFetching(true);
    fetch(`/api/bu-entries?tab=${encodeURIComponent(newTab)}&month=${encodeURIComponent(prefillMonth)}&year=${prefillYear ?? new Date().getFullYear()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.found && data.fields.length > 0) {
          const filled = emptyFields();
          data.fields.forEach((v: string, i: number) => { if (i < TOTAL_FIELDS) filled[i] = v; });
          setFields(filled);
          // Auto-open categories that have data
          const auto = new Set<ToggleCategory>();
          if (p(filled[10]) || p(filled[11]) || p(filled[12])) auto.add("gsa");
          if (p(filled[13]) || p(filled[18])) auto.add("fcl");
          if (p(filled[23]) || p(filled[28])) auto.add("lcl");
          if (p(filled[33]) || p(filled[34])) auto.add("special");
          if (p(filled[35]) || p(filled[36])) auto.add("multimodal");
          setToggled(auto);
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (idx: number) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFields((prev) => { const next = [...prev]; next[idx] = e.target.value; return next; });
  };

  const toggle = (cat: ToggleCategory) => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // ── Live KPIs ──────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const f = fields.map(p);
    const exportAF_shipments = f[0], exportAF_weight = f[3], exportAF_profit = f[4];
    const importAF_shipments = f[5], importAF_weight = f[8], importAF_profit = f[9];
    const gsa_shipments = f[10];
    const exportFCL_shipments = f[13], exportFCL_profit = f[17];
    const importFCL_shipments = f[18], importFCL_profit = f[22];
    const exportLCL_shipments = f[23], exportLCL_profit = f[27];
    const importLCL_shipments = f[28], importLCL_profit = f[32];
    const specialFiles = f[33], specialProfit = f[34];
    const multimodalShipments = f[35], multimodalProfit = f[36];
    const staff = f[38];

    const totalAFShipments = exportAF_shipments + importAF_shipments;
    const totalAFWeight    = exportAF_weight + importAF_weight;
    const totalAFProfit    = exportAF_profit + importAF_profit;
    const totalSeaShipments = exportFCL_shipments + importFCL_shipments + exportLCL_shipments + importLCL_shipments;
    const totalSeaProfit    = exportFCL_profit + importFCL_profit + exportLCL_profit + importLCL_profit;
    const totalTransactions = totalAFShipments + gsa_shipments + totalSeaShipments + specialFiles + multimodalShipments;
    const totalWeight       = totalAFWeight;

    return {
      totalWeight,
      totalTransactions,
      profitPerAF: totalAFShipments > 0 ? totalAFProfit / totalAFShipments : 0,
      profitPerSea: totalSeaShipments > 0 ? totalSeaProfit / totalSeaShipments : 0,
      profitPerAFkg: totalAFWeight > 0 ? totalAFProfit / totalAFWeight : 0,
      profitPerSpecial: specialFiles > 0 ? specialProfit / specialFiles : 0,
      profitPerMultimodal: multimodalShipments > 0 ? multimodalProfit / multimodalShipments : 0,
      profitPerStaff: staff > 0 ? (totalAFProfit + totalSeaProfit + specialProfit + multimodalProfit) / staff : 0,
    };
  }, [fields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/bu-entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: newTab, month: editMonth, year: editYear, fields }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || "Something went wrong."); return; }
      setSubmitSuccess(true);
      setTimeout(() => { onClose(); }, 2000);
    } catch { setSubmitError("Network error. Please try again."); }
    finally  { setSubmitting(false); }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: "var(--surface2)", border: "1px solid var(--border)",
    color: "var(--text)", borderRadius: "0.5rem",
    padding: "0.45rem 0.75rem", width: "100%", fontSize: "0.875rem", outline: "none",
  };
  const textareaStyle: React.CSSProperties = {
    ...inputStyle, resize: "vertical", minHeight: "60px", fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "0.72rem", fontWeight: 500,
    color: "var(--muted)", marginBottom: "0.2rem",
    textTransform: "uppercase", letterSpacing: "0.04em",
  };
  const selectStyle: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)",
    color: "var(--text)", borderRadius: "0.5rem",
    padding: "0.375rem 0.625rem", fontSize: "0.875rem", outline: "none",
  };

  const sectionHeaderStyle = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0.5rem 0.75rem", borderRadius: "0.5rem", marginBottom: active ? "0.75rem" : 0,
    background: "var(--surface2)", border: "1px solid var(--border)", cursor: "pointer",
  });

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    width: "26px", height: "26px", borderRadius: "0.375rem",
    background: active ? "var(--accent)" : "var(--surface)",
    color: active ? "#fff" : "var(--accent)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    cursor: "pointer", fontWeight: 700, fontSize: "1rem",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  });

  const alwaysHeaderStyle: React.CSSProperties = {
    fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.06em", color: "var(--accent)",
    borderBottom: "1px solid var(--border)", paddingBottom: "0.375rem", marginBottom: "0.75rem",
  };

  const subHeaderStyle: React.CSSProperties = {
    fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.05em", color: "var(--muted)", marginBottom: "0.5rem",
  };

  const Field = ({ label, idx, type = "number" }: { label: string; idx: number; type?: string }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} step="any" value={fields[idx]}
        onChange={set(idx)} placeholder="0" style={inputStyle} />
    </div>
  );

  const CommentField = ({ label, idx }: { label: string; idx: number }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <textarea value={fields[idx]} onChange={set(idx)} style={textareaStyle} />
    </div>
  );

  // ── KPI Card (inline) ──────────────────────────────────────────────────────
  const KPI = ({ label, value }: { label: string; value: string }) => (
    <div style={{
      padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
      background: "var(--surface)", border: "1px solid var(--border)",
    }}>
      <div style={{ fontSize: "0.65rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: "0.15rem" }}>{label}</div>
      <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent)" }}>{value}</div>
    </div>
  );

  // ── Toggle section wrapper ─────────────────────────────────────────────────
  const ToggleSection = ({ cat, label, children }: { cat: ToggleCategory; label: string; children: React.ReactNode }) => {
    const open = toggled.has(cat);
    return (
      <div>
        <div style={sectionHeaderStyle(open)} onClick={() => toggle(cat)}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: open ? "var(--text)" : "var(--muted)" }}>
            {label}
          </span>
          <button type="button" style={toggleBtnStyle(open)}>
            {open ? "−" : "+"}
          </button>
        </div>
        {open && <div style={{ marginTop: "0.75rem" }}>{children}</div>}
      </div>
    );
  };

  if (submitSuccess) {
    return (
      <ModalShell buEntry={buEntry} onClose={onClose}>
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✅</div>
          <p style={{ fontWeight: 600, color: "var(--text)" }}>Saved!</p>
          <p style={{ fontSize: "0.875rem", marginTop: "0.25rem", color: "var(--muted)" }}>Refresh to see changes.</p>
        </div>
      </ModalShell>
    );
  }

  if (fetching) {
    return (
      <ModalShell buEntry={buEntry} onClose={onClose}>
        <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⏳</div>
          Loading existing data…
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell buEntry={buEntry} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Month / Year */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label style={labelStyle}>Month</label>
            <select value={editMonth} onChange={(e) => setEditMonth(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
              {FY_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Year</label>
            <input type="number" value={editYear} onChange={(e) => setEditYear(Number(e.target.value))}
              min={2020} max={2099} style={inputStyle} />
          </div>
        </div>

        {/* ── Live KPIs ── */}
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: "0.5rem" }}>Live KPIs</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
            <KPI label="Total Chargeable Weight" value={kpis.totalWeight > 0 ? `${Math.round(kpis.totalWeight).toLocaleString()} kg` : "—"} />
            <KPI label="Total Transactions" value={kpis.totalTransactions > 0 ? kpis.totalTransactions.toLocaleString() : "—"} />
            <KPI label="Profit / AF Shipment" value={kpis.profitPerAF > 0 ? fmtUSD(kpis.profitPerAF) : "—"} />
            <KPI label="Profit / Sea Shipment" value={kpis.profitPerSea > 0 ? fmtUSD(kpis.profitPerSea) : "—"} />
            <KPI label="Profit / AF kg" value={kpis.profitPerAFkg > 0 ? `$${kpis.profitPerAFkg.toFixed(2)}` : "—"} />
            <KPI label="Profit / Special File" value={kpis.profitPerSpecial > 0 ? fmtUSD(kpis.profitPerSpecial) : "—"} />
            <KPI label="Profit / Multimodal" value={kpis.profitPerMultimodal > 0 ? fmtUSD(kpis.profitPerMultimodal) : "—"} />
            <KPI label="Profit / Staff" value={kpis.profitPerStaff > 0 ? fmtUSD(kpis.profitPerStaff) : "—"} />
          </div>
        </div>

        {/* ── AIRFREIGHT (always visible) ── */}
        <div>
          <div style={alwaysHeaderStyle}>Airfreight</div>

          {/* Export */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={subHeaderStyle}>Export Airfreight</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem" }}>
              <Field label="Total # of export shipments" idx={0} />
              <Field label="Own Sales" idx={1} />
              <Field label="Routed from agents" idx={2} />
              <Field label="Total chargeable weight (kg)" idx={3} />
              <Field label="Total file profit (USD)" idx={4} />
            </div>
          </div>

          {/* Import */}
          <div>
            <div style={subHeaderStyle}>Import Airfreight</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem" }}>
              <Field label="Total # of import shipments" idx={5} />
              <Field label="Own Sales" idx={6} />
              <Field label="Routed from agents" idx={7} />
              <Field label="Total chargeable weight (kg)" idx={8} />
              <Field label="Total file profit (USD)" idx={9} />
            </div>
          </div>
        </div>

        {/* ── GSA/CSA EXPORT (toggle) ── */}
        <ToggleSection cat="gsa" label="GSA / CSA Export">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem" }}>
            <Field label="Total # of GSA/CSA export shipments" idx={10} />
            <Field label="Total chargeable weight (kg)" idx={11} />
            <Field label="Total file profit (USD)" idx={12} />
          </div>
        </ToggleSection>

        {/* ── OCEAN FCL (toggle) ── */}
        <ToggleSection cat="fcl" label="Ocean Freight — FCL">
          <div style={{ marginBottom: "1rem" }}>
            <div style={subHeaderStyle}>Export FCL</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem" }}>
              <Field label="Total # of export FCL shipments" idx={13} />
              <Field label="Own Sales" idx={14} />
              <Field label="Routed from agents" idx={15} />
              <Field label="Total TEUs" idx={16} />
              <Field label="Total file profit (USD)" idx={17} />
            </div>
          </div>
          <div>
            <div style={subHeaderStyle}>Import FCL</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem" }}>
              <Field label="Total # of import FCL shipments" idx={18} />
              <Field label="Own Sales" idx={19} />
              <Field label="Routed from agents" idx={20} />
              <Field label="Total TEUs" idx={21} />
              <Field label="Total file profit (USD)" idx={22} />
            </div>
          </div>
        </ToggleSection>

        {/* ── OCEAN LCL (toggle) ── */}
        <ToggleSection cat="lcl" label="Ocean Freight — LCL">
          <div style={{ marginBottom: "1rem" }}>
            <div style={subHeaderStyle}>Export LCL</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem" }}>
              <Field label="Total # of export LCL shipments" idx={23} />
              <Field label="Own Sales" idx={24} />
              <Field label="Routed from agents" idx={25} />
              <Field label="Total CBMs" idx={26} />
              <Field label="Total file profit (USD)" idx={27} />
            </div>
          </div>
          <div>
            <div style={subHeaderStyle}>Import LCL</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem" }}>
              <Field label="Total # of import LCL shipments" idx={28} />
              <Field label="Own Sales" idx={29} />
              <Field label="Routed from agents" idx={30} />
              <Field label="Total CBMs" idx={31} />
              <Field label="Total file profit (USD)" idx={32} />
            </div>
          </div>
        </ToggleSection>

        {/* ── SPECIAL SERVICES (toggle) ── */}
        <ToggleSection cat="special" label="Special Services">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem" }}>
            <Field label="Total of Special Services Files" idx={33} />
            <Field label="Total file profit (USD)" idx={34} />
          </div>
        </ToggleSection>

        {/* ── MULTIMODAL / ROAD FREIGHT (toggle) ── */}
        <ToggleSection cat="multimodal" label="Multimodal / Road Freight">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem" }}>
            <Field label="Total shipments" idx={35} />
            <Field label="Total file profit (USD)" idx={36} />
          </div>
        </ToggleSection>

        {/* ── GENERAL INFO ── */}
        <div>
          <div style={alwaysHeaderStyle}>General</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem", marginBottom: "1.25rem" }}>
            <Field label="Total file profit (USD) — must match sum above" idx={37} />
            <Field label="Number of staff incl. managers" idx={38} />
          </div>

          {/* Comments */}
          <div style={{ ...subHeaderStyle, marginBottom: "0.75rem" }}>Comments</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <CommentField label="Exports / Imports summary" idx={39} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem" }}>
              <Field label="Active agents / offices" idx={40} type="text" />
              <Field label="New customers" idx={41} type="text" />
              <Field label="Lost customers" idx={42} type="text" />
              <Field label="Vendor issues" idx={43} type="text" />
              <Field label="No of quotes" idx={44} />
              <Field label="New products" idx={45} type="text" />
            </div>
            <CommentField label="Noteworthy shipments" idx={46} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem" }}>
              <Field label="Payment issues over 60 days" idx={47} type="text" />
              <Field label="Staff issues" idx={48} type="text" />
            </div>
          </div>
        </div>

        {submitError && (
          <p style={{ fontSize: "0.875rem", color: "#dc2626" }}>{submitError}</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button type="submit" disabled={submitting} style={{
            background: submitting ? "var(--muted)" : "var(--accent)", color: "#fff",
            border: "none", borderRadius: "0.5rem", padding: "0.625rem",
            fontWeight: 600, fontSize: "0.875rem",
            cursor: submitting ? "not-allowed" : "pointer",
          }}>
            {submitting ? "Saving…" : "Save Entry"}
          </button>
          <button type="button" onClick={onClose} style={{
            background: "none", border: "none", color: "var(--muted)",
            cursor: "pointer", fontSize: "0.875rem", padding: "0.375rem",
          }}>Cancel</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Modal shell (overlay + card) ──────────────────────────────────────────────

function ModalShell({ buEntry, onClose, children }: { buEntry: BUEntry; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 60, padding: "1rem",
        background: "rgba(0,0,0,0.5)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: "580px", borderRadius: "0.75rem",
        boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
        background: "var(--surface)", border: "1px solid var(--border)",
        maxHeight: "92vh", overflowY: "auto",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0, background: "var(--surface)", zIndex: 1,
        }}>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>Add / Edit Entry</h2>
            <p style={{ fontSize: "0.75rem", marginTop: "0.125rem", color: "var(--muted)" }}>{buEntry.label}</p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--muted)",
            cursor: "pointer", fontSize: "1.25rem", lineHeight: 1,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── BU Tab lookup for newTab ─────────────────────────────────────────────────

const BU_NEW_TABS: Record<string, string> = {
  "CONSOLIDATED OPS": "CONSOLIDATED OPS_new",
  "AASA":             "AASA_new",
  "AAINT ":           "AAINT_new",
  "AAEA":             "AAEA_new",
  "AAWN":             "AAWN_new",
  "AACN ":            "AACN_new",
  "AAMA ":            "AAMA_new",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BUDashboard({ buSheets }: Props) {
  const [selected, setSelected] = useState(0);
  const [modal, setModal] = useState<{ buEntry: BUEntry; prefillMonth?: string; prefillYear?: number } | null>(null);

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
            {BU_NEW_TABS[b.name] && (
              <button
                onClick={() => setModal({ buEntry: b })}
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

        <div className="flex items-center gap-1.5">
          <select value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} style={selectStyle}>
            {FY_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))} style={selectStyle}>
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <span style={{ color: "var(--muted)", fontSize: "0.875rem" }}>→</span>

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
                const hasTab = !!BU_NEW_TABS[bu.name];
                const tabMonth = MONTH_NAME_MAP[r.month] ?? r.month;
                return (
                  <tr
                    key={`${r.month}-${r.year}`}
                    onClick={() => hasTab && setModal({ buEntry: bu, prefillMonth: tabMonth, prefillYear: r.year })}
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: i % 2 === 0 ? "var(--surface)" : "transparent",
                      cursor: hasTab ? "pointer" : "default",
                    }}
                    className={hasTab ? "hover:opacity-80 transition-opacity" : ""}
                  >
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text)" }}>
                      <span className="flex items-center gap-1.5">
                        {r.month} {r.year}
                        {hasTab && <span style={{ fontSize: "0.65rem", color: "var(--accent)", opacity: 0.7 }}>✎ edit</span>}
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

      {/* Entry Modal */}
      {modal && (
        <EntryModal
          buEntry={modal.buEntry}
          newTab={BU_NEW_TABS[modal.buEntry.name] ?? ""}
          prefillMonth={modal.prefillMonth}
          prefillYear={modal.prefillYear}
          onClose={() => setModal(null)}
        />
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
