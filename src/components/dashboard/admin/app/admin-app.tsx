"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { iniciar } from "@/lib/offline/store";
import { useAdminEstado, useVisao } from "@/lib/offline/use-admin";
import { PageLoading } from "../page-loading";
import { AlunosSecao } from "./alunos-secao";
import { CalendarioSecao } from "./calendario-secao";
import { FinanceiroSecao } from "./financeiro-secao";
import { Pendencias } from "./pendencias";
import { StatusConexao } from "./status-conexao";

// Seções do admin que funcionam offline. As três rotas renderizam este mesmo componente; a troca
// entre elas usa history.pushState (ver AdminNav), sem buscar nada no servidor.
export const SECOES_OFFLINE = ["/dashboard/admin", "/dashboard/admin/financeiro", "/dashboard/admin/calendario"];

export function AdminApp({ userId }: { userId: string }) {
  const pathname = usePathname();
  const estado = useAdminEstado();
  const visao = useVisao();

  useEffect(() => {
    void iniciar(userId);
  }, [userId]);

  let conteudo: React.ReactNode;
  if (!visao) {
    conteudo =
      estado.carregado && !estado.online ? (
        <p role="status" className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          Ainda não há dados salvos neste aparelho. Conecte-se à internet uma vez para baixar.
        </p>
      ) : (
        <PageLoading />
      );
  } else if (pathname.startsWith("/dashboard/admin/financeiro")) {
    conteudo = <FinanceiroSecao visao={visao} />;
  } else if (pathname.startsWith("/dashboard/admin/calendario")) {
    conteudo = <CalendarioSecao visao={visao} />;
  } else {
    conteudo = <AlunosSecao visao={visao} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <StatusConexao visao={visao} />
      {visao && <Pendencias visao={visao} />}
      {conteudo}
    </div>
  );
}
