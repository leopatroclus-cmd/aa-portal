"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/agent-network", label: "Agent Network", icon: "🌍" },
  { href: "/bu-report", label: "BU Report", icon: "📊" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside
      style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
      className="w-56 flex-shrink-0 flex flex-col"
    >
      <div className="px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--muted)" }}>
          Aero Africa
        </div>
        <div className="text-lg font-bold mt-0.5" style={{ color: "var(--text)" }}>
          AA Portal
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1">
        {nav.map((item) => {
          const active = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#fff" : "var(--muted)",
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-xs" style={{ color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
        FYE 2026
      </div>
    </aside>
  );
}
