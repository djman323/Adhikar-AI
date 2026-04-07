"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/chat", label: "Chat" },
];

export default function TopTabs() {
  const pathname = usePathname();

  return (
    <nav className="top-tabs-wrap" aria-label="Primary navigation">
      <div className="top-tabs">
        {TABS.map((tab) => {
          const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`top-tab ${isActive ? "top-tab--active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}