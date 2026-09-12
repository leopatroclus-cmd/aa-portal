"use client";
import { useState, useMemo } from "react";
import type { Agent } from "@/lib/sheets";

interface Props {
  globalAgents: Agent[];
  africaAgents: Agent[];
}

type Tab = "Global" | "Africa";

export default function AgentNetwork({ globalAgents, africaAgents }: Props) {
  const [tab, setTab] = useState<Tab>("Global");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [primaryOnly, setPrimaryOnly] = useState(false);

  const agents = tab === "Global" ? globalAgents : africaAgents;

  const countries = useMemo(
    () => Array.from(new Set(agents.map((a) => a.country))).sort(),
    [agents]
  );
  const cities = useMemo(
    () =>
      Array.from(
        new Set(agents.filter((a) => !country || a.country === country).map((a) => a.city))
      ).sort(),
    [agents, country]
  );

  const filtered = useMemo(
    () =>
      agents.filter(
        (a) =>
          (!country || a.country === country) &&
          (!city || a.city === city) &&
          (!primaryOnly || a.isPrimary)
      ),
    [agents, country, city, primaryOnly]
  );

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setCountry("");
    setCity("");
    setPrimaryOnly(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          Agent Network
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {filtered.length} agent{filtered.length !== 1 ? "s" : ""}
          {tab === "Africa" ? " in Africa" : " globally"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(["Global", "Africa"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className="px-5 py-2 rounded-full text-sm font-medium transition-colors"
            style={{
              background: tab === t ? "var(--accent)" : "var(--surface2)",
              color: tab === t ? "#fff" : "var(--muted)",
              border: "1px solid",
              borderColor: tab === t ? "var(--accent)" : "var(--border)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={country}
          onChange={(e) => { setCountry(e.target.value); setCity(""); }}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
        >
          <option value="">All Countries</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
        >
          <option value="">All Cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <label
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: primaryOnly ? "var(--accent)" : "var(--muted)" }}
        >
          <input
            type="checkbox"
            checked={primaryOnly}
            onChange={(e) => setPrimaryOnly(e.target.checked)}
            className="accent-blue-500"
          />
          Primary agents only
        </label>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="text-left px-4 py-3 font-medium">Country</th>
              <th className="text-left px-4 py-3 font-medium">City</th>
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Network</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Contact</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((agent, i) => (
              <tr
                key={i}
                style={{
                  borderTop: "1px solid var(--border)",
                  background: i % 2 === 0 ? "var(--surface)" : "transparent",
                }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: "var(--text)" }}>
                  {agent.country}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                  {agent.city}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--text)" }}>
                  {agent.company}
                </td>
                <td className="px-4 py-3">
                  {agent.network && (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: "#fff7ed", color: "var(--accent)", border: "1px solid #fed7aa" }}
                    >
                      {agent.network}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {agent.isPrimary && (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: "#111", color: "#fff" }}
                    >
                      Primary
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {agent.emails.slice(0, 2).map((e, j) => (
                      <a
                        key={j}
                        href={`mailto:${e}`}
                        className="text-xs underline"
                        style={{ color: "var(--muted)" }}
                      >
                        {e}
                      </a>
                    ))}
                    {agent.emails.length > 2 && (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        +{agent.emails.length - 2}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12" style={{ color: "var(--muted)" }}>
                  No agents found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
