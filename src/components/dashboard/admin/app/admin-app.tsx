"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { iniciar, iniciarSemUsuario } from "@/lib/offline/store";
import { useAdminEstado, useVisao } from "@/lib/offline/use-admin";
import { PageLoading } from "../page-loading";
import { AlunosSecao } from "./alunos-secao";
import { CalendarioSecao } from "./calendario-secao";
import { FinanceiroSecao } from "./financeiro-secao";
import { Pendencias } from "./pendencias";
import { StatusConexao } from "./status-conexao";

// Alunos, Financeiro e Calendário (SECOES_OFFLINE): as três rotas renderizam este componente,
// que lê os dados do aparelho e sincroniza com o servidor.
const ULTIMO_USUARIO = "cg-admin-ultimo-usuario";

function lerUltimoUsuario() {
  try {
    return localStorage.getItem(ULTIMO_USUARIO);
  } catch {
    return null;
  }
}

// Chamado pela checagem de admin do servidor (UsuarioDoServidor) com o usuário confirmado.
export function definirUsuario(id: string) {
  try {
    localStorage.setItem(ULTIMO_USUARIO, id);
  } catch {
    // armazenamento indisponível
  }
  void iniciar(id);
}

// Fica na casca fixa da página (fora do Suspense do servidor) para abrir na hora, também offline.
// Começa com o último admin deste aparelho; a checagem do servidor confirma (ou troca) o usuário.
// Nada aqui chama o login do Supabase no navegador: renovar o token em dois lugares ao mesmo
// tempo pode derrubar a sessão.
export function AdminApp() {
  const pathname = usePathname();
  const estado = useAdminEstado();
  const visao = useVisao();

  useEffect(() => {
    const id = lerUltimoUsuario();
    if (id) void iniciar(id);
    else iniciarSemUsuario();
  }, []);

  let conteudo: React.ReactNode;
  if (!visao) {
    const semDados = estado.carregado && !estado.online;
    conteudo =
      semDados ? (
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
