import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { executarAcao } from "@/app/dashboard/admin/operacoes";
import type { AcaoFila, RespostaAcao } from "@/lib/offline/tipos";
import { adminDaRequisicao, semCache } from "../guard";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS = new Set(["pagamento", "aluno_criar", "aluno_editar", "horario_entrar", "horario_sair",
  "anamnese_salvar", "avaliacao_salvar"]);

// Recebe um item da fila do app offline. Rota estável (e não Server Action) porque o app
// instalado pode estar rodando JS de um deploy anterior.
export async function POST(req: NextRequest) {
  const auth = await adminDaRequisicao();
  if (!auth.ok) {
    const r: RespostaAcao = { ok: false, tipo: "sessao", mensagem: "Entre novamente para enviar." };
    return NextResponse.json(r, { status: auth.status, headers: semCache });
  }

  let body: { id?: unknown; tipo?: unknown; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, tipo: "regra", mensagem: "Pedido inválido." }, { status: 400 });
  }
  if (typeof body.id !== "string" || !UUID.test(body.id) || typeof body.tipo !== "string"
      || !TIPOS.has(body.tipo) || typeof body.payload !== "object" || body.payload === null) {
    return NextResponse.json({ ok: false, tipo: "regra", mensagem: "Pedido inválido." }, { status: 400 });
  }

  try {
    const r = await executarAcao(auth.supabase, body.id, { tipo: body.tipo, payload: body.payload } as AcaoFila);
    if (r.ok) revalidatePath("/dashboard/admin", "layout");
    return NextResponse.json(r, { headers: semCache });
  } catch (e) {
    console.error("[api/admin/acoes]", e);
    // Dado em formato inesperado (ex.: app instalado com versão antiga) não adianta repetir:
    // vira pendência para o admin decidir. Outras falhas o app tenta de novo.
    const r: RespostaAcao =
      e instanceof TypeError
        ? { ok: false, tipo: "regra", mensagem: "Registro em formato inválido. Descarte e registre de novo." }
        : { ok: false, tipo: "temporario", mensagem: "Falha no servidor. Vai tentar de novo." };
    return NextResponse.json(r, { status: e instanceof TypeError ? 400 : 500, headers: semCache });
  }
}
