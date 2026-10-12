"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { adminUz } from "@/lib/i18n/admin";

const tabs = [
  { href: "/admin", label: adminUz.nav.stats },
  { href: "/admin/bot", label: adminUz.nav.botTexts },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between gap-4">
      <div className="flex rounded-[12px] bg-white p-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-[9px] px-4 py-2 text-sm font-semibold no-underline transition-colors ${
                active ? "bg-siyoh text-varaq" : "text-qalam hover:text-siyoh"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <LogoutButton />
    </nav>
  );
}
