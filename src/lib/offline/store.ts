import { toast } from "sonner";
import { abrirDB, filaDoUsuario, contarFila } from "./db";
import type { AcaoFila, AdminSnapshot, ItemFila, RespostaAcao } from "./tipos";

// Estado do app offline do admin: último snapshot do servidor + fila de ações locais.
// Lido pelas telas via useSyncExternalStore (ver use-admin.ts).

export type EstadoAdmin = {
  userId: string | null;
  carregado: boolean; // já leu o IndexedDB
  snapshot: AdminSnapshot | null;
  fila: ItemFila[];
  online: boolean;
  sincronizando: boolean;
  atualizando: boolean;
  precisaLogin: boolean;
  filaDeOutraConta: boolean;
};

let estado: EstadoAdmin = {
  userId: null,
  carregado: false,
  snapshot: null,
  fila: [],
  online: true,
  sincronizando: false,
  atualizando: false,
  precisaLogin: false,
  filaDeOutraConta: false,
};
const ouvintes = new Set<() => void>();

function set(parcial: Partial<EstadoAdmin>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((f) => f());
}

export const adminStore = {
  subscribe(f: () => void) {
    ouvintes.add(f);
    return () => ouvintes.delete(f);
  },
  get: () => estado,
};

// ---------------------------------------------------------------- início e conexão

let eventosLigados = false;
let timerRetry: ReturnType<typeof setTimeout> | null = null;
// Logout em curso: nada mais é gravado no aparelho nem enviado (uma atualização ou envio em voo
// regravaria o snapshot/fila logo depois da limpeza). Volta a valer no próximo `iniciar`.
let encerrado = false;

export function encerrar() {
  encerrado = true;
  if (timerRetry) clearTimeout(timerRetry);
}

function ligarEventos() {
  if (eventosLigados || typeof window === "undefined") return;
  eventosLigados = true;
  window.addEventListener("online", () => {
    set({ online: true });
    toast.success("Conexão de volta.");
    void sincronizar().then(() => atualizar());
  });
  window.addEventListener("offline", () => {
    set({ online: false });
    toast.warning("Sem conexão. Você pode continuar registrando; envio automático quando voltar.", {
      duration: 6000,
    });
  });
  window.addEventListener("focus", () => void sincronizar());
}

// Aparelho sem nenhum admin salvo ainda: só acompanha a conexão até a checagem do servidor
// informar o usuário (offline, a tela explica que é preciso conectar uma vez).
export function iniciarSemUsuario() {
  ligarEventos();
  if (!estado.userId) set({ carregado: true, online: navigator.onLine });
}

export async function iniciar(userId: string) {
  encerrado = false;
  ligarEventos();
  if (estado.userId === userId && estado.carregado) return;
  set({ userId, carregado: false, snapshot: null, fila: [], online: navigator.onLine });

  const db = await abrirDB();
  const [snapshot, fila, total] = await Promise.all([
    db.get("snapshot", userId),
    filaDoUsuario(userId),
    contarFila(),
  ]);
  if (estado.userId !== userId) return; // trocou de usuário no meio
  set({
    carregado: true,
    snapshot: snapshot?.user_id === userId ? snapshot : null,
    fila,
    filaDeOutraConta: total > fila.length,
  });
  if (navigator.onLine) await sincronizar();
  await atualizar();
}

// ---------------------------------------------------------------- snapshot

let atualizarDeNovo = false;

// Se já há uma atualização em curso, agenda outra para depois dela: a que está em voo pode ter
// sido gerada antes do último envio da fila.
export async function atualizar(): Promise<void> {
  const userId = estado.userId;
  if (!userId || !navigator.onLine) return;
  if (estado.atualizando) {
    atualizarDeNovo = true;
    return;
  }
  set({ atualizando: true });
  try {
    const res = await fetch("/api/admin/snapshot", { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      set({ precisaLogin: true });
      return;
    }
    if (!res.ok) return;
    const snap = (await res.json()) as AdminSnapshot;
    if (snap.user_id !== userId || estado.userId !== userId) return;
    const db = await abrirDB();
    if (encerrado) return;
    await db.put("snapshot", snap, userId);
    set({ snapshot: snap, precisaLogin: false });
  } catch {
    // sem rede: segue com o snapshot salvo
  } finally {
    set({ atualizando: false });
    if (atualizarDeNovo) {
      atualizarDeNovo = false;
      void atualizar();
    }
  }
}

// ---------------------------------------------------------------- fila

const uuid = () => crypto.randomUUID();
export const novoId = uuid;

async function salvarItem(item: ItemFila) {
  const db = await abrirDB();
  if (encerrado) return;
  await db.put("fila", item);
}

async function removerItem(id: string) {
  await (await abrirDB()).delete("fila", id);
}

export async function enfileirar(acao: AcaoFila): Promise<ItemFila | null> {
  const userId = estado.userId;
  if (!userId) {
    toast.error("Sessão não carregada. Recarregue a página.");
    return null;
  }
  const item: ItemFila = {
    ...acao,
    id: uuid(),
    user_id: userId,
    criado_em: new Date().toISOString(),
    status: "pendente",
    tentativas: 0,
  };
  try {
    await salvarItem(item);
  } catch (e) {
    console.error("[offline] falha ao guardar na fila", e);
    return null; // quem chamou mostra o erro e mantém o formulário aberto
  }
  set({ fila: [...estado.fila, item] });
  if (navigator.onLine) void sincronizar();
  return item;
}

const membroDe = (item: ItemFila) =>
  "member_id" in item.payload ? (item.payload as { member_id: string }).member_id : null;

// Cadastro com erro bloqueia as ações seguintes do mesmo aluno (pagamento, horário…).
function bloqueadoPor(item: ItemFila, fila: ItemFila[]) {
  if (item.tipo === "aluno_criar") return null;
  const mid = membroDe(item);
  return fila.find((o) => o.tipo === "aluno_criar" && o.status === "erro" && o.payload.member_id === mid) ?? null;
}

let emCurso: Promise<void> | null = null;

export function sincronizar(): Promise<void> {
  emCurso ??= rodarSync().then((completa) => {
    emCurso = null;
    // Item enfileirado no instante em que a rodada terminava. Só quando a rodada foi até o fim:
    // se parou por falta de rede ou sessão, quem volta é o retry/evento (sem laço apertado).
    const sobrou = estado.fila.some((i) => i.status === "pendente" && i.tentativas === 0);
    if (completa && sobrou && navigator.onLine && !estado.precisaLogin) void sincronizar();
  }, () => {
    emCurso = null;
  });
  return emCurso;
}

// Falha do servidor (resposta 500) vira pendência depois de algumas tentativas, para não travar
// a fila inteira atrás de um item problemático. Falta de rede tenta para sempre.
const MAX_FALHAS_SERVIDOR = 3;

// Devolve true se percorreu a fila até o fim; false se parou (sem rede, sessão, erro local).
async function rodarSync(): Promise<boolean> {
  const userId = estado.userId;
  if (encerrado || !userId || !navigator.onLine || !estado.fila.some((i) => i.status === "pendente")) return true;
  set({ sincronizando: true });
  let enviados = 0;
  const falhas: string[] = [];
  const tentados = new Set<string>();

  try {
    // Pega o próximo pendente a cada volta: itens enfileirados durante o envio também vão.
    for (;;) {
      const item = estado.fila.find((i) => i.status === "pendente" && !tentados.has(i.id));
      if (!item) break;
      tentados.add(item.id);

      const bloqueio = bloqueadoPor(item, estado.fila);
      if (bloqueio) {
        const nome = bloqueio.tipo === "aluno_criar" ? bloqueio.payload.nome : "aluno";
        await marcarErro(item, `Aguardando o cadastro de ${nome}, que falhou. Corrija o cadastro primeiro.`);
        continue;
      }

      let r: RespostaAcao;
      let respondeu = false;
      try {
        const res = await fetch("/api/admin/acoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id, tipo: item.tipo, payload: item.payload }),
        });
        respondeu = true;
        r = (await res.json()) as RespostaAcao;
      } catch {
        r = { ok: false, tipo: "temporario", mensagem: "Sem conexão com o servidor." };
      }

      if (r.ok) {
        await removerItem(item.id);
        set({ fila: estado.fila.filter((i) => i.id !== item.id) });
        enviados++;
      } else if (r.tipo === "regra") {
        await marcarErro(item, r.mensagem);
        falhas.push(r.mensagem);
      } else if (r.tipo === "sessao") {
        set({ precisaLogin: true });
        toast.error("Sua sessão expirou. Entre novamente para enviar os registros guardados.");
        return false;
      } else if (respondeu && item.tentativas + 1 >= MAX_FALHAS_SERVIDOR) {
        const msg = "O servidor não conseguiu processar este registro. Tente de novo mais tarde ou descarte.";
        await marcarErro(item, msg);
        falhas.push(msg);
      } else {
        const atualizado = { ...item, tentativas: item.tentativas + 1 };
        await salvarItem(atualizado);
        set({ fila: estado.fila.map((i) => (i.id === item.id ? atualizado : i)) });
        agendarRetry(Math.min(60_000, 5_000 * 2 ** Math.min(atualizado.tentativas, 4)));
        return false;
      }
    }
    return true;
  } finally {
    set({ sincronizando: false });
    if (enviados) toast.success(`${enviados} ${enviados === 1 ? "registro enviado" : "registros enviados"}.`);
    if (falhas.length)
      toast.error(
        `${falhas.length} ${falhas.length === 1 ? "registro não foi aceito" : "registros não foram aceitos"} pelo servidor. Veja em Pendências.`,
        { duration: 8000 },
      );
    if (enviados) void atualizar();
  }
}

function agendarRetry(ms: number) {
  if (timerRetry) clearTimeout(timerRetry);
  timerRetry = setTimeout(() => void sincronizar(), ms);
}

async function marcarErro(item: ItemFila, erro: string) {
  const atualizado: ItemFila = { ...item, status: "erro", erro };
  await salvarItem(atualizado);
  set({ fila: estado.fila.map((i) => (i.id === item.id ? atualizado : i)) });
}

// ---------------------------------------------------------------- pendências com erro

export async function descartar(id: string) {
  await removerItem(id);
  set({ fila: estado.fila.filter((i) => i.id !== id) });
}

// Reenvia; num cadastro, também libera as ações do mesmo aluno que esperavam por ele.
export async function tentarDeNovo(id: string) {
  const alvo = estado.fila.find((i) => i.id === id);
  if (!alvo) return;
  const liberar = (i: ItemFila) =>
    i.id === id ||
    (alvo.tipo === "aluno_criar" && i.status === "erro" && membroDe(i) === alvo.payload.member_id);
  const fila = estado.fila.map((i) => (liberar(i) ? { ...i, status: "pendente" as const, erro: undefined } : i));
  for (const i of fila) if (liberar(i)) await salvarItem({ ...i, tentativas: 0 });
  set({ fila: fila.map((i) => (liberar(i) ? { ...i, tentativas: 0 } : i)) });
  void sincronizar().then(() => sincronizar());
}

// Corrige o conteúdo (ex.: telefone) mantendo o mesmo id (idempotência) e reenvia.
export async function corrigir(id: string, payload: AcaoFila["payload"]): Promise<boolean> {
  const alvo = estado.fila.find((i) => i.id === id);
  if (!alvo) return false;
  const corrigido = { ...alvo, payload, status: "pendente", erro: undefined } as ItemFila;
  try {
    await salvarItem(corrigido);
  } catch (e) {
    console.error("[offline] falha ao guardar a correção", e);
    return false;
  }
  set({ fila: estado.fila.map((i) => (i.id === id ? corrigido : i)) });
  await tentarDeNovo(id);
  return true;
}
