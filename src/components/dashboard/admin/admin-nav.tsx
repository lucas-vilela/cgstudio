"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CalendarDays, ShieldCheck, Users, Wallet } from "lucide-react";

const ITEMS = [
  { href: "/dashboard/admin", label: "Alunos", icon: Users },
  { href: "/dashboard/admin/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/dashboard/admin/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/dashboard/admin/admins", label: "Admins", icon: ShieldCheck },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Painel do admin" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-2">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:min-h-9",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                <item.icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
