"use client";

import { navegar } from "@/lib/offline/navegacao";
import { fichaHref } from "@/lib/offline/secoes";
import { cn } from "@/lib/utils";

// Nome do aluno levando à ficha dele (dentro do app offline: só pushState).
export function LinkAluno({
  id, aba, className, children,
}: { id: string; aba?: "anamnese" | "medidas"; className?: string; children: React.ReactNode }) {
  const href = fichaHref(id, aba);
  return (
    <a href={href} onClick={(e) => navegar(e, href)}
      className={cn("rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring", className)}>
      {children}
    </a>
  );
}
