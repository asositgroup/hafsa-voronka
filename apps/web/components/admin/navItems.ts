import type { ComponentType } from "react";
import { ChartIcon, ChatIcon, PlayIcon, SettingsIcon, TableIcon, TextIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: "results" | "bot" | "footer";
  mobile: "bar" | "more";
};

export const navItems: NavItem[] = [
  { href: "/admin", label: adminUz.nav.stats, icon: ChartIcon, group: "results", mobile: "bar" },
  { href: "/admin/reports", label: adminUz.nav.reports, icon: TableIcon, group: "results", mobile: "bar" },
  { href: "/admin/messages", label: adminUz.nav.messages, icon: ChatIcon, group: "bot", mobile: "bar" },
  { href: "/admin/videos", label: adminUz.nav.videos, icon: PlayIcon, group: "bot", mobile: "bar" },
  { href: "/admin/bot", label: adminUz.nav.botTexts, icon: TextIcon, group: "bot", mobile: "more" },
  { href: "/admin/settings", label: adminUz.nav.settings, icon: SettingsIcon, group: "footer", mobile: "more" },
];

export function isNavActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
