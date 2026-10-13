import { NextResponse } from "next/server";
import { todayISO } from "@/app/dashboard/admin/format";
import {
  getAdminMembers, getAnamneses, getAvaliacoes, getInadimplentes, getPagamentosDesde, getPlans, getResumo, getSlots, getTreinos,
  getVencimentosProximos,
} from "@/app/dashboard/admin/queries";
import type { AdminSnapshot } from "@/lib/offline/tipos";
import { adminDaRequisicao, semCache } from "../guard";

function fichaIndisponivel(e: unknown) {
  console.error("[api/admin/snapshot] ficha do aluno", e);
  return undefined;
}

// Tudo o que as telas offline do admin (Alunos, Financeiro, Calendário) precisam, de uma vez.
export async function GET() {
  const auth = await adminDaRequisicao();
  if (!auth.ok) return auth.resposta;

  const hoje = todayISO();
  const [ano, mes] = hoje.split("-").map(Number);
  const desde = `${ano - 2}-${String(mes).padStart(2, "0")}-01`; // últimos 24 meses

  try {
    const [members, plans, treinos, slots, resumo, vencimentos, inadimplentes, pagamentos, anamneses, avaliacoes] =
      await Promise.all([
        getAdminMembers(), getPlans(), getTreinos(), getSlots(), getResumo(),
        getVencimentosProximos(), getInadimplentes(), getPagamentosDesde(desde),
        // Ficha do aluno: se falhar (ex.: migration 0013 ainda não aplicada), o resto do painel segue.
        getAnamneses().catch(fichaIndisponivel), getAvaliacoes().catch(fichaIndisponivel),
      ]);
    const snapshot: AdminSnapshot = {
      user_id: auth.user.id,
      gerado_em: new Date().toISOString(),
      hoje,
      members, plans, treinos, slots, resumo, vencimentos, inadimplentes, pagamentos,
      anamneses, avaliacoes,
    };
    return NextResponse.json(snapshot, { headers: semCache });
  } catch (e) {
    console.error("[api/admin/snapshot]", e);
    return NextResponse.json({ erro: "falha" }, { status: 500, headers: semCache });
  }
}
