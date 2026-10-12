// Tipos e helpers do calendário do aluno (sem dependência de servidor: usados também no cliente).

export type SlotVaga = {
  slot_id: number;
  dia_semana: number; // 0 = domingo ... 6 = sábado
  hora_inicio: string; // "HH:MM:SS"
  hora_fim: string;
  capacidade: number;
  ativo: boolean;
  ocupados: number;
  vagas: number;
};

export type Situacao = "em_dia" | "vence_em_breve" | "em_atraso" | "sem_vencimento";

export type Financeiro = {
  status: "pendente" | "ativo" | "inativo";
  plano_nome: string | null;
  vezes_semana: number | null;
  slots_usados: number;
  valor: number | null;
  vencimento: string | null; // "YYYY-MM-DD"
  dias_para_vencer: number | null;
  situacao: Situacao;
};

export type Experimental = { id: number; slot_id: number; data: string };

export type Resultado = { ok: true } | { ok: false; message: string };
export type ResultadoVagas = { ok: true; vagas: number } | { ok: false; message: string };

export type Acoes = {
  entrar: (slotId: number) => Promise<Resultado>;
  sair: (slotId: number) => Promise<Resultado>;
  agendarExperimental: (slotId: number, data: string) => Promise<Resultado>;
  cancelarExperimental: (bookingId: number) => Promise<Resultado>;
  vagasNaData: (slotId: number, data: string) => Promise<ResultadoVagas>;
};

export const ERRO_GENERICO = "Não foi possível concluir. Tente novamente.";

const ERROS: Record<string, string> = {
  nao_autenticado: "Sua sessão expirou. Entre novamente.",
  aluno_nao_encontrado: "Não localizamos seu cadastro de aluno. Fale com o studio.",
  aluno_nao_ativo: "Sua matrícula não está ativa. Regularize o pagamento para entrar em novos horários.",
  sem_plano: "Você ainda não tem um plano definido. Fale com o studio.",
  slot_indisponivel: "Este horário não está mais disponível.",
  ja_no_slot: "Você já está neste horário.",
  limite_slots: "Você já usa todos os horários do seu plano. Saia de um para trocar.",
  slot_lotado: "Este horário acabou de lotar.",
  nao_alocado: "Você não está mais neste horário.",
  aluno_nao_pendente: "A aula grátis é só para quem ainda não é aluno.",
  experimental_ja_usada: "Você já agendou ou fez sua aula grátis.",
  data_invalida: "Escolha uma data a partir de amanhã.",
  dia_incorreto: "A data escolhida não cai no dia da semana deste horário.",
  experimental_inexistente: "Não encontramos uma aula grátis agendada.",
  experimental_passada: "A aula grátis de hoje ou de uma data passada não pode ser cancelada.",
};

export function mensagemErro(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return ERRO_GENERICO;
  if (error.code === "42501") return "Você não tem permissão para fazer isso.";
  return ERROS[(error.message ?? "").trim()] ?? ERRO_GENERICO;
}

export const DIAS = [
  { dow: 1, curto: "Seg", longo: "Segunda" },
  { dow: 2, curto: "Ter", longo: "Terça" },
  { dow: 3, curto: "Qua", longo: "Quarta" },
  { dow: 4, curto: "Qui", longo: "Quinta" },
  { dow: 5, curto: "Sex", longo: "Sexta" },
] as const;

const NOME_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const nomeDia = (dow: number) => NOME_DIA[dow] ?? "";

export const hhmm = (t: string) => t.slice(0, 5);
export const faixa = (s: Pick<SlotVaga, "hora_inicio" | "hora_fim">) =>
  `${hhmm(s.hora_inicio)}–${hhmm(s.hora_fim)}`;

/** Data de hoje em America/Sao_Paulo como "YYYY-MM-DD". Chamar no servidor e passar por prop. */
export function hojeSaoPaulo() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

const toUtc = (iso: string) => new Date(`${iso}T12:00:00Z`);

export function diaDaSemana(iso: string) {
  return toUtc(iso).getUTCDay();
}

export function addDias(iso: string, n: number) {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "14/10" */
export const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** "Terça, 14/10" */
export const dataComDia = (iso: string) => `${nomeDia(diaDaSemana(iso))}, ${dataCurta(iso)}`;

/** Próximas `n` datas (a partir de amanhã) que caem em `dow`. */
export function proximasDatas(hoje: string, dow: number, n = 4) {
  let d = addDias(hoje, 1);
  while (diaDaSemana(d) !== dow) d = addDias(d, 1);
  return Array.from({ length: n }, (_, i) => addDias(d, i * 7));
}

export type PilulaVencimento = { texto: string; urgente: boolean };

export function pilulaVencimento(f: Pick<Financeiro, "situacao" | "dias_para_vencer" | "vencimento">): PilulaVencimento {
  const dias = f.dias_para_vencer;
  const data = f.vencimento ? dataCurta(f.vencimento) : "";
  switch (f.situacao) {
    case "em_atraso": {
      const atraso = dias === null ? 0 : Math.abs(dias);
      return { texto: `Em atraso · venceu há ${atraso} ${atraso === 1 ? "dia" : "dias"} (${data})`, urgente: true };
    }
    case "vence_em_breve":
      if (dias === 0) return { texto: `Vence hoje · ${data}`, urgente: true };
      if (dias === 1) return { texto: `Vence em breve · amanhã (${data})`, urgente: true };
      return { texto: `Vence em breve · em ${dias} dias (${data})`, urgente: false };
    case "em_dia":
      return { texto: `Em dia · vence em ${dias} dias (${data})`, urgente: false };
    default:
      return { texto: "Sem vencimento registrado", urgente: false };
  }
}

export type MotivoBloqueio = { texto: string } | null;

/** Por que o aluno não pode entrar em novos horários (null = pode). */
export function bloqueioEntrar(f: Financeiro): MotivoBloqueio {
  if (f.status === "inativo")
    return { texto: "Sua matrícula está inativa. Você mantém seus horários, mas só entra em novos depois de regularizar o pagamento." };
  if (f.status === "pendente")
    return { texto: "Você ainda não é aluno matriculado. Agende uma aula grátis para conhecer o studio." };
  if (!f.vezes_semana) return { texto: "Você ainda não tem um plano definido. Fale com o studio para escolher o seu." };
  if (f.slots_usados >= f.vezes_semana)
    return { texto: `Você já usa os ${f.vezes_semana} ${f.vezes_semana === 1 ? "horário" : "horários"} do seu plano. Saia de um para trocar.` };
  return null;
}
