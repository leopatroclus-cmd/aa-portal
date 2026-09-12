"use client";
import { useState } from "react";
import type { BUData } from "@/lib/sheets";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
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

export default function BUDashboard({ buSheets }: Props) {
  const [selected, setSelected] = useState(0);
  const bu = buSheets[selected];
  const d = bu.data;

  const chartData = d.months.map((m, i) => ({
    month: m,
    profit: d.totalProfit[i],
    shipments: d.shipments[i],
    weight: Math.round(d.weight[i]),
  }));

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
          <button
            key={b.name}
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
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPICard label="Total Profit" value={fmtUSD(d.totals.totalProfit)} sub="FY combined" />
        <KPICard label="Air Freight Shipments" value={fmt(d.totals.shipments)} sub="Total files" />
        <KPICard label="Chargeable Weight" value={fmt(d.totals.weight, "") + " kg"} sub="Air freight" />
        <KPICard label="Staff" value={String(d.staff || "—")} sub="incl. managers" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Profit Bar Chart */}
        <div className="p-5 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--muted)" }}>
            Monthly Total Profit (USD)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmt(v, "$")}
              />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                labelStyle={{ color: "var(--text)", fontWeight: 600 }}
                formatter={(v) => [fmtUSD(Number(v)), "Profit"]}
              />
              <Bar dataKey="profit" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Shipments Line Chart */}
        <div className="p-5 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--muted)" }}>
            Monthly Shipments
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmt(v)}
              />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                labelStyle={{ color: "var(--text)", fontWeight: 600 }}
                formatter={(v) => [Number(v).toLocaleString(), "Shipments"]}
              />
              <Line
                type="monotone"
                dataKey="shipments"
                stroke="var(--accent)"
                strokeWidth={2.5}
                dot={{ fill: "var(--accent)", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
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
              {d.months.map((m, i) => (
                <tr
                  key={m}
                  style={{
                    borderTop: "1px solid var(--border)",
                    background: i % 2 === 0 ? "var(--surface)" : "transparent",
                  }}
                >
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text)" }}>{m}</td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                    {d.shipments[i] ? d.shipments[i].toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                    {d.weight[i] ? Math.round(d.weight[i]).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium" style={{ color: d.totalProfit[i] > 0 ? "var(--accent)" : d.totalProfit[i] < 0 ? "#dc2626" : "var(--muted)" }}>
                    {d.totalProfit[i] ? fmtUSD(d.totalProfit[i]) : "—"}
                  </td>
                </tr>
              ))}
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
    </div>
  );
}

function KPICard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      className="p-5 rounded-xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="text-2xl font-bold mb-0.5" style={{ color: "var(--text)" }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {sub}
      </div>
    </div>
  );
}
