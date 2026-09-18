"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  { href: "/agent-network", label: "Agent Network", icon: "🌍" },
  { href: "/bu-report", label: "BU Report", icon: "📊" },
];

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger toggle — mobile only */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 flex items-center justify-center w-9 h-9 rounded-lg"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
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

      {/* Backdrop — mobile only, visible when open */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-30"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          "flex-shrink-0 flex flex-col w-56 h-full",
          // Mobile: fixed off-canvas overlay
          "fixed top-0 left-0 z-40",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: normal flow, always visible
          "md:relative md:translate-x-0",
        ].join(" ")}
        style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="px-5 py-5 border-b flex items-center justify-between"
          style={{ borderColor: "var(--border)" }}
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
          {/* Close button — mobile only */}
          <button
            className="md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: "1.1rem",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {nav.map((item) => {
            const active = path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
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
          className="px-5 py-4 text-xs"
          style={{ color: "var(--muted)", borderTop: "1px solid var(--border)" }}
        >
          FYE 2026
        </div>
      </aside>
    </>
  );
}
