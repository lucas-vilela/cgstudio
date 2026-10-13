"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { SECOES_OFFLINE } from "@/lib/offline/secoes";
import { cn } from "@/lib/utils";
import { CalendarDays, LayoutTemplate, ShieldCheck, Users, Wallet } from "lucide-react";

const ITEMS = [
  { href: "/dashboard/admin", label: "Alunos", icon: Users },
  { href: "/dashboard/admin/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/dashboard/admin/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/dashboard/admin/conteudo", label: "Conteúdo", icon: LayoutTemplate },
  { href: "/dashboard/admin/admins", label: "Admins", icon: ShieldCheck },
];

// Alunos, Financeiro e Calendário são o mesmo app de cliente (funciona offline): trocar entre eles
// só muda a URL com pushState, sem ir ao servidor. As outras abas precisam de conexão.

function navegar(e: React.MouseEvent<HTMLAnchorElement>, pathname: string, href: string) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  if (SECOES_OFFLINE.has(pathname) && SECOES_OFFLINE.has(href)) {
    e.preventDefault();
    window.history.pushState(null, "", href);
  } else if (!navigator.onLine) {
    e.preventDefault();
    // Vindo de uma aba online, carrega a página inteira (o service worker serve a cópia salva).
    if (SECOES_OFFLINE.has(href)) window.location.assign(href);
    else toast.warning("Esta aba precisa de conexão com a internet.");
  }
}

export function AdminNav({ pendentes = 0 }: { pendentes?: number }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  // No celular as abas não cabem: esmaece a borda direita enquanto ainda há abas para rolar.
  const [temMais, setTemMais] = useState(false);
  const medir = () => {
    const el = nav.current;
    if (el) setTemMais(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [pathname]);
  return (
    <nav ref={nav} onScroll={medir} aria-label="Painel do admin"
      className={cn(
        "-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        temMais && "[mask-image:linear-gradient(to_right,black_80%,transparent)]",
      )}>
      <ul className="flex w-max gap-2">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={(e) => navegar(e, pathname, item.href)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:min-h-9",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                <item.icon aria-hidden className="size-4" />
                {item.label}
                {item.href.endsWith("/conteudo") && pendentes > 0 && (
                  <span
                    className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold leading-5 text-accent-foreground"
                    aria-label={`${pendentes} ${pendentes === 1 ? "depoimento" : "depoimentos"} para aprovar`}
                  >
                    {pendentes}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
