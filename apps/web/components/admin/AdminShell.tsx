"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreIcon } from "@/components/icons";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { isNavActive, navItems, type NavItem } from "@/components/admin/navItems";
import { Sheet } from "@/components/admin/ui/Dialog";
import { LoadingState } from "@/components/admin/ui/States";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.nav;

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-11 items-center gap-3 rounded-[10px] px-3 text-sm no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oltin ${
        active ? "bg-varaq/10 font-semibold text-varaq" : "font-medium text-kumush hover:bg-varaq/5 hover:text-varaq"
      }`}
    >
      {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-oltin" />}
      <Icon className="h-5 w-5" />
      {item.label}
    </Link>
  );
}

function BarLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: NavItem["icon"]; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-oltin ${
        active ? "text-varaq" : "text-kumush"
      }`}
    >
      {active && <span aria-hidden="true" className="absolute left-1/2 top-0 h-[3px] w-6 -translate-x-1/2 rounded-b bg-oltin" />}
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}

function groupItems(group: NavItem["group"]) {
  return navItems.filter((item) => item.group === group);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const authorized = useAdminSession();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const barItems = navItems.filter((item) => item.mobile === "bar");
  const moreItems = navItems.filter((item) => item.mobile === "more");
  const moreActive = moreItems.some((item) => isNavActive(pathname, item.href));

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-siyoh-deep text-varaq lg:flex">
        <div className="flex flex-col gap-0.5 px-5 pb-4 pt-6">
          <span className="text-lg font-bold leading-tight">{adminUz.brand.name}</span>
          <span className="text-[13px] text-kumush">{adminUz.brand.sub}</span>
        </div>
        <nav aria-label={copy.menuLabel} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-2">
          {(["results", "bot"] as const).map((group) => (
            <div key={group} className="flex flex-col gap-0.5">
              <span className="px-3 pb-1 text-[13px] text-kumush">{adminUz.navGroups[group]}</span>
              {groupItems(group).map((item) => (
                <SidebarLink key={item.href} item={item} active={isNavActive(pathname, item.href)} />
              ))}
            </div>
          ))}
        </nav>
        <div className="flex flex-col gap-0.5 border-t border-varaq/10 px-3 py-3">
          {groupItems("footer").map((item) => (
            <SidebarLink key={item.href} item={item} active={isNavActive(pathname, item.href)} />
          ))}
          <LogoutButton tone="sidebar" />
        </div>
      </aside>

      <nav
        aria-label={copy.menuLabel}
        className="fixed inset-x-0 bottom-0 z-40 flex bg-siyoh-deep pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto flex h-16 w-full max-w-xl">
          {barItems.map((item) => (
            <BarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={isNavActive(pathname, item.href)} />
          ))}
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setMoreOpen(true)}
            className={`relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-oltin ${
              moreActive ? "text-varaq" : "text-kumush"
            }`}
          >
            {moreActive && <span aria-hidden="true" className="absolute left-1/2 top-0 h-[3px] w-6 -translate-x-1/2 rounded-b bg-oltin" />}
            <MoreIcon className="h-5 w-5" />
            <span className="text-xs font-medium">{copy.more}</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={copy.more}>
        <div className="flex flex-col gap-1">
          {moreItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex h-12 items-center gap-3 rounded-[10px] px-3 text-sm no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh ${
                  active ? "bg-varaq font-semibold text-siyoh" : "font-medium text-siyoh hover:bg-varaq"
                }`}
              >
                <Icon className="h-5 w-5 text-qalam" />
                {item.label}
              </Link>
            );
          })}
          <div className="mt-2 border-t border-chiziq pt-3">
            <LogoutButton tone="sheet" />
          </div>
        </div>
      </Sheet>

      <main className="px-4 py-6 pb-[calc(64px+env(safe-area-inset-bottom)+24px)] sm:px-6 lg:pb-10 lg:pl-[272px] lg:pr-8">
        {!authorized && <LoadingState variant="page" />}
        <div hidden={!authorized}>{children}</div>
      </main>
    </div>
  );
}
