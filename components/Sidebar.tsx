"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const nav = [
  { href: "/agent-network", label: "Agent Network", icon: "🌍" },
  { href: "/bu-report", label: "BU Report", icon: "📊" },
];

export default function Sidebar() {
  const path = usePathname();

  // Start closed on mobile, open on desktop — resolved after hydration
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOpen(window.innerWidth >= 768);
    setHydrated(true);
  }, []);

  const isMobile = hydrated && window.innerWidth < 768;

  return (
    <>
      {/* ── Toggle button — visible when sidebar is closed ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="fixed top-4 left-4 z-50 flex items-center justify-center w-9 h-9 rounded-lg"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: "1.1rem",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          ☰
        </button>
      )}

      {/* ── Mobile backdrop ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-30"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar panel ──
          Mobile: fixed overlay, slides in/out
          Desktop: inline, collapses width to 0
      ── */}
      <aside
        style={{
          background: "var(--surface)",
          borderRight: open ? "1px solid var(--border)" : "none",
        }}
        className={[
          "flex-shrink-0 flex flex-col z-40",
          "overflow-hidden",
          "transition-all duration-300 ease-in-out",
          // Mobile: fixed overlay
          "fixed top-0 left-0 h-full w-56",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: inline, toggle via width
          "md:relative md:translate-x-0 md:h-auto",
          open ? "md:w-56" : "md:w-0",
        ].join(" ")}
      >
        {/* Header */}
        <div
          className="px-5 py-5 border-b flex items-center justify-between flex-shrink-0"
          style={{ borderColor: "var(--border)", minWidth: "14rem" }}
        >
          <div>
            <div
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: "var(--muted)" }}
            >
              Aero Africa
            </div>
            <div className="text-lg font-bold mt-0.5" style={{ color: "var(--text)" }}>
              AA Portal
            </div>
          </div>
          {/* Collapse button */}
          <button
            onClick={() => setOpen(false)}
            aria-label="Collapse menu"
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav
          className="flex-1 py-4 px-3 space-y-1 flex-shrink-0"
          style={{ minWidth: "14rem" }}
        >
          {nav.map((item) => {
            const active = path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => { if (isMobile) setOpen(false); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: active ? "#fff7ed" : "transparent",
                  color: active ? "var(--accent)" : "var(--muted)",
                  borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className="px-5 py-4 text-xs flex-shrink-0"
          style={{ color: "var(--muted)", borderTop: "1px solid var(--border)", minWidth: "14rem" }}
        >
          FYE 2026
        </div>
      </aside>
    </>
  );
}
