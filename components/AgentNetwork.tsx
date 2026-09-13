"use client";
import { useState, useMemo } from "react";
import type { Agent } from "@/lib/sheets";

interface Props {
  globalAgents: Agent[];
  africaAgents: Agent[];
}

type Tab = "Global" | "Africa";

interface FormData {
  tab: Tab;
  country: string;
  city: string;
  company: string;
  network: string;
  contactManager: string;
  isPrimary: boolean;
  emails: string[];
}

const emptyForm = (tab: Tab): FormData => ({
  tab,
  country: "",
  city: "",
  company: "",
  network: "",
  contactManager: "",
  isPrimary: false,
  emails: [""],
});

export default function AgentNetwork({ globalAgents, africaAgents }: Props) {
  const [tab, setTab] = useState<Tab>("Global");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [network, setNetwork] = useState("");
  const [company, setCompany] = useState("");
  const [contactManager, setContactManager] = useState("");
  const [primaryOnly, setPrimaryOnly] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm("Global"));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const agents = tab === "Global" ? globalAgents : africaAgents;

  const countries = useMemo(
    () => Array.from(new Set(agents.map((a) => a.country).filter(Boolean))).sort(),
    [agents]
  );
  const cities = useMemo(
    () =>
      Array.from(
        new Set(
          agents
            .filter((a) => !country || a.country === country)
            .map((a) => a.city)
            .filter(Boolean)
        )
      ).sort(),
    [agents, country]
  );
  const networks = useMemo(
    () => Array.from(new Set(agents.map((a) => a.network).filter(Boolean))).sort(),
    [agents]
  );

  const filtered = useMemo(() => {
    const companyQ = company.toLowerCase().trim();
    const managerQ = contactManager.toLowerCase().trim();
    return agents.filter(
      (a) =>
        (!country       || a.country === country) &&
        (!city          || a.city === city) &&
        (!network       || a.network === network) &&
        (!companyQ      || a.company.toLowerCase().includes(companyQ)) &&
        (!managerQ      || a.contactManager.toLowerCase().includes(managerQ)) &&
        (!primaryOnly   || a.isPrimary)
    );
  }, [agents, country, city, network, company, contactManager, primaryOnly]);

  const hasFilters = !!(country || city || network || company || contactManager || primaryOnly);

  const resetFilters = () => {
    setCountry(""); setCity(""); setNetwork("");
    setCompany(""); setContactManager(""); setPrimaryOnly(false);
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    resetFilters();
  };

  const openModal = () => {
    setForm(emptyForm(tab));
    setSubmitError("");
    setSubmitSuccess(false);
    setShowModal(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    setSubmitError("");
    setSubmitSuccess(false);
  };

  const updateEmail = (i: number, val: string) => {
    setForm((f) => {
      const emails = [...f.emails];
      emails[i] = val;
      return { ...f, emails };
    });
  };

  const addEmail = () => {
    if (form.emails.length < 8) {
      setForm((f) => ({ ...f, emails: [...f.emails, ""] }));
    }
  };

  const removeEmail = (i: number) => {
    setForm((f) => ({ ...f, emails: f.emails.filter((_, idx) => idx !== i) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          emails: form.emails.filter(Boolean),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 503) {
          setSubmitError("Write access not configured. Contact admin.");
        } else {
          setSubmitError(data.error || "Something went wrong. Try again.");
        }
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

  const inputStyle = {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem",
    width: "100%",
    fontSize: "0.875rem",
    outline: "none",
  };

  const labelStyle = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "var(--muted)",
    marginBottom: "0.25rem",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            Agent Network
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {filtered.length} agent{filtered.length !== 1 ? "s" : ""}
            {tab === "Africa" ? " in Africa" : " globally"}
          </p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + Add Agent
        </button>
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
      <div className="rounded-xl p-4 mb-6 space-y-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
        {/* Row 1: Location */}
        <div className="flex flex-wrap gap-3">
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

          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
          >
            <option value="">All Networks</option>
            {networks.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Row 2: Text search + Primary */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Search company…"
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", minWidth: "180px" }}
          />
          <input
            type="text"
            value={contactManager}
            onChange={(e) => setContactManager(e.target.value)}
            placeholder="Search contact manager…"
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", minWidth: "200px" }}
          />
          <label
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: primaryOnly ? "var(--accent)" : "var(--muted)" }}
          >
            <input type="checkbox" checked={primaryOnly} onChange={(e) => setPrimaryOnly(e.target.checked)} className="accent-blue-500" />
            Primary only
          </label>

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--accent)", cursor: "pointer" }}
            >
              Reset
            </button>
          )}

          <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>
            {filtered.length} agent{filtered.length !== 1 ? "s" : ""}
            {hasFilters && " (filtered)"}
          </span>
        </div>
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

      {/* Add Agent Modal */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[60] p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "90vh", overflowY: "auto" }}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>
                Add New Agent
              </h2>
              <button
                onClick={closeModal}
                className="text-xl leading-none"
                style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {submitSuccess ? (
              <div className="px-6 py-12 text-center">
                <div className="text-3xl mb-3">✅</div>
                <p className="font-semibold" style={{ color: "var(--text)" }}>
                  Agent added!
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                  Refresh the page to see changes.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {/* Tab selector */}
                <div>
                  <label style={labelStyle}>Sheet Tab</label>
                  <div className="flex gap-4">
                    {(["Global", "Africa"] as Tab[]).map((t) => (
                      <label
                        key={t}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                        style={{ color: "var(--text)" }}
                      >
                        <input
                          type="radio"
                          name="tab"
                          value={t}
                          checked={form.tab === t}
                          onChange={() => setForm((f) => ({ ...f, tab: t }))}
                          className="accent-blue-500"
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Country + City */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Country *</label>
                    <input
                      required
                      type="text"
                      value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                      placeholder="e.g. United Kingdom"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>City *</label>
                    <input
                      required
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="e.g. London"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Company */}
                <div>
                  <label style={labelStyle}>Company *</label>
                  <input
                    required
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    placeholder="Company name"
                    style={inputStyle}
                  />
                </div>

                {/* Network + Contact Manager */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Network</label>
                    <input
                      type="text"
                      value={form.network}
                      onChange={(e) => setForm((f) => ({ ...f, network: e.target.value }))}
                      placeholder="e.g. AA Standard"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Contact Manager</label>
                    <input
                      type="text"
                      value={form.contactManager}
                      onChange={(e) => setForm((f) => ({ ...f, contactManager: e.target.value }))}
                      placeholder="Name"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Primary Agent */}
                <label
                  className="flex items-center gap-2 text-sm cursor-pointer"
                  style={{ color: "var(--text)" }}
                >
                  <input
                    type="checkbox"
                    checked={form.isPrimary}
                    onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                    className="accent-blue-500"
                  />
                  Primary Agent
                </label>

                {/* Emails */}
                <div>
                  <label style={labelStyle}>Emails</label>
                  <div className="space-y-2">
                    {form.emails.map((email, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => updateEmail(i, e.target.value)}
                          placeholder={`Email ${i + 1}`}
                          style={{ ...inputStyle, width: "auto", flex: 1 }}
                        />
                        {form.emails.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEmail(i)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--muted)",
                              cursor: "pointer",
                              fontSize: "1rem",
                              padding: "0 0.25rem",
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    {form.emails.length < 8 && (
                      <button
                        type="button"
                        onClick={addEmail}
                        className="text-xs underline"
                        style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0 }}
                      >
                        + Add Email
                      </button>
                    )}
                  </div>
                </div>

                {/* Error */}
                {submitError && (
                  <p className="text-sm" style={{ color: "#dc2626" }}>
                    {submitError}
                  </p>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2">
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
                    {submitting ? "Adding…" : "Add Agent"}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      padding: "0.375rem",
                    }}
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
