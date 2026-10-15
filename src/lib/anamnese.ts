// Anamnese e medidas do aluno (migration 0013). Usado no cliente (ficha, app offline) e no
// servidor (validação da fila). As perguntas seguem a ficha em papel do studio.

export type Anamnese = {
  member_id: string;
  data_nascimento: string | null;
  endereco: string | null;
  doenca_cronica: boolean | null;
  doenca_cronica_quais: string | null;
  medicacao_continua: boolean | null;
  medicacao_quais: string | null;
  restricao_medica: boolean | null;
  restricao_detalhe: string | null;
  praticou_exercicio: boolean | null;
  modalidades_anteriores: string | null;
  tempo_pratica: string | null;
  objetivos: string | null;
  autoriza_imagem: boolean | null;
  autoriza_imagem_data: string | null;
  consentimento_saude: boolean | null;
  consentimento_saude_data: string | null;
  cuidados_treino: string | null;
  observacoes: string | null;
  updated_at: string;
  updated_by_nome: string | null;
};

export type CamposAnamnese = Partial<Omit<Anamnese, "member_id" | "updated_at" | "updated_by_nome">>;
export type CampoAnamnese = keyof CamposAnamnese;

export const CAMPOS_TEXTO = {
  endereco: 300,
  doenca_cronica_quais: 1000,
  medicacao_quais: 1000,
  restricao_detalhe: 1000,
  modalidades_anteriores: 500,
  tempo_pratica: 200,
  objetivos: 2000,
  cuidados_treino: 2000,
  observacoes: 2000,
} as const satisfies Partial<Record<CampoAnamnese, number>>;

export const CAMPOS_SIM_NAO = [
  "doenca_cronica", "medicacao_continua", "restricao_medica", "praticou_exercicio",
  "autoriza_imagem", "consentimento_saude",
] as const satisfies readonly CampoAnamnese[];

export const CAMPOS_DATA = [
  "data_nascimento", "autoriza_imagem_data", "consentimento_saude_data",
] as const satisfies readonly CampoAnamnese[];

// Campo que só vale com um "Sim": desmarcar limpa, e os dois sempre vão juntos na fila.
export const DEPENDENTES: Partial<Record<(typeof CAMPOS_SIM_NAO)[number], CampoAnamnese[]>> = {
  doenca_cronica: ["doenca_cronica_quais"],
  medicacao_continua: ["medicacao_quais"],
  restricao_medica: ["restricao_detalhe"],
  praticou_exercicio: ["modalidades_anteriores", "tempo_pratica"],
  autoriza_imagem: ["autoriza_imagem_data"],
  consentimento_saude: ["consentimento_saude_data"],
};

// Textos da folha (também os cabeçalhos da planilha).
export const PERGUNTAS = {
  data_nascimento: "Data de nascimento",
  endereco: "Endereço",
  doenca_cronica:
    "Possui alguma doença crônica não transmissível (ex.: hipertensão, diabetes, obesidade, problemas cardíacos, coluna, tireoide etc.)?",
  doenca_cronica_quais: "Se sim, qual(is)?",
  medicacao_continua: "Está em uso de medicação contínua?",
  medicacao_quais: "Qual(is)?",
  restricao_medica: "Possui recomendação ou restrição médica para atividades físicas?",
  restricao_detalhe: "Detalhar",
  praticou_exercicio: "Já praticou exercícios físicos anteriormente?",
  modalidades_anteriores: "Quais modalidades?",
  tempo_pratica: "Há quanto tempo?",
  objetivos: "Objetivos",
  autoriza_imagem:
    "Autoriza o uso de fotos e vídeos feitos durante as aulas e eventos do Studio Clarice Geiger para divulgação em redes sociais e materiais promocionais do estúdio?",
  autoriza_imagem_data: "Data da assinatura",
  consentimento_saude:
    "Autoriza o studio a guardar estas informações de saúde para orientar o treino?",
  consentimento_saude_data: "Data da autorização",
  cuidados_treino: "Cuidados no treino",
  observacoes: "Observações",
} as const satisfies Record<CampoAnamnese, string>;

export const ANAMNESE_VAZIA = (memberId: string): Anamnese => ({
  member_id: memberId,
  data_nascimento: null, endereco: null,
  doenca_cronica: null, doenca_cronica_quais: null,
  medicacao_continua: null, medicacao_quais: null,
  restricao_medica: null, restricao_detalhe: null,
  praticou_exercicio: null, modalidades_anteriores: null, tempo_pratica: null,
  objetivos: null,
  autoriza_imagem: null, autoriza_imagem_data: null,
  consentimento_saude: null, consentimento_saude_data: null,
  cuidados_treino: null, observacoes: null,
  updated_at: "", updated_by_nome: null,
});

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (s: string) => DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const TODOS = Object.keys(PERGUNTAS) as CampoAnamnese[];

// Formato, limites e datas (não futuras). `hoje` em AAAA-MM-DD (São Paulo).
export function validarCamposAnamnese(
  c: unknown,
  hoje: string,
): { data: CamposAnamnese } | { error: string } {
  if (typeof c !== "object" || c === null || Array.isArray(c)) return { error: "Anamnese inválida." };
  const entrada = c as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entrada)) {
    if (!TODOS.includes(k as CampoAnamnese)) return { error: "Anamnese inválida." };
    if (v === null) {
      out[k] = null;
    } else if (k in CAMPOS_TEXTO) {
      if (typeof v !== "string") return { error: "Anamnese inválida." };
      const t = v.trim();
      const max = CAMPOS_TEXTO[k as keyof typeof CAMPOS_TEXTO];
      if (t.length > max) return { error: `“${PERGUNTAS[k as CampoAnamnese]}”: até ${max} caracteres.` };
      out[k] = t || null;
    } else if ((CAMPOS_SIM_NAO as readonly string[]).includes(k)) {
      if (typeof v !== "boolean") return { error: "Anamnese inválida." };
      out[k] = v;
    } else if ((CAMPOS_DATA as readonly string[]).includes(k)) {
      if (typeof v !== "string" || !dataValida(v)) return { error: "Data inválida." };
      if (v > hoje) return { error: `“${PERGUNTAS[k as CampoAnamnese]}” não pode ser no futuro.` };
      if (v < "1900-01-01") return { error: "Data inválida." };
      out[k] = v;
    }
  }
  return { data: out as CamposAnamnese };
}

const temTexto = (s: string | null) => !!s?.trim();

// Regra fechada do alerta de saúde (design): doença crônica, medicação, restrição médica ou
// cuidados no treino. Devolve os motivos para mostrar.
export function motivosAlerta(a: Anamnese | null | undefined): string[] {
  if (!a) return [];
  const m: string[] = [];
  const com = (rotulo: string, detalhe: string | null) => (temTexto(detalhe) ? `${rotulo}: ${detalhe!.trim()}` : rotulo);
  if (a.doenca_cronica) m.push(com("Doença crônica", a.doenca_cronica_quais));
  if (a.medicacao_continua) m.push(com("Medicação contínua", a.medicacao_quais));
  if (a.restricao_medica) m.push(com("Restrição médica", a.restricao_detalhe));
  if (temTexto(a.cuidados_treino)) m.push(`Cuidados: ${a.cuidados_treino!.trim()}`);
  return m;
}

// Algo preenchido além dos carimbos?
export function anamnesePreenchida(a: Anamnese | null | undefined) {
  return !!a && TODOS.some((k) => a[k] != null && a[k] !== "");
}

export function idade(nascimento: string | null, hoje: string) {
  if (!nascimento) return null;
  const [y, m, d] = nascimento.split("-").map(Number);
  const [hy, hm, hd] = hoje.split("-").map(Number);
  return hy - y - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

// ---------------------------------------------------------------- medidas

export type Avaliacao = {
  id: string;
  member_id: string;
  data: string;
  peso_kg: number | null;
  cintura_cm: number | null;
  quadril_cm: number | null;
  coxa_cm: number | null;
  peito_cm: number | null;
  braco_cm: number | null;
  observacao: string | null;
  /** O que o aluno sente que melhorou ou piorou e não dá para medir. Ausente em dados antigos do aparelho. */
  percepcoes: string | null;
};

export const MEDIDAS = [
  { campo: "peso_kg", rotulo: "Peso", unidade: "kg", min: 20, max: 300 },
  { campo: "cintura_cm", rotulo: "Cintura", unidade: "cm", min: 10, max: 250 },
  { campo: "quadril_cm", rotulo: "Quadril", unidade: "cm", min: 10, max: 250 },
  { campo: "coxa_cm", rotulo: "Coxas / pernas", unidade: "cm", min: 10, max: 250 },
  { campo: "peito_cm", rotulo: "Peito / tórax", unidade: "cm", min: 10, max: 250 },
  { campo: "braco_cm", rotulo: "Braço", unidade: "cm", min: 10, max: 250 },
] as const;
export type CampoMedida = (typeof MEDIDAS)[number]["campo"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarAvaliacao(a: unknown, hoje: string): { data: Avaliacao } | { error: string } {
  if (typeof a !== "object" || a === null) return { error: "Medidas inválidas." };
  const p = a as Record<string, unknown>;
  if (typeof p.id !== "string" || !UUID.test(p.id) || typeof p.member_id !== "string" || !UUID.test(p.member_id))
    return { error: "Medidas inválidas." };
  if (typeof p.data !== "string" || !dataValida(p.data)) return { error: "Data inválida." };
  if (p.data > hoje) return { error: "A data da avaliação não pode ser no futuro." };
  const out: Avaliacao = {
    id: p.id, member_id: p.member_id, data: p.data,
    peso_kg: null, cintura_cm: null, quadril_cm: null, coxa_cm: null, peito_cm: null, braco_cm: null,
    observacao: null, percepcoes: null,
  };
  let alguma = false;
  for (const m of MEDIDAS) {
    const v = p[m.campo];
    if (v == null) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) return { error: `${m.rotulo}: valor inválido.` };
    if (v < m.min || v > m.max) return { error: `${m.rotulo}: entre ${m.min} e ${m.max} ${m.unidade}.` };
    out[m.campo] = Math.round(v * 10) / 10;
    alguma = true;
  }
  if (!alguma) return { error: "Informe pelo menos uma medida." };
  if (p.observacao != null) {
    if (typeof p.observacao !== "string") return { error: "Medidas inválidas." };
    const t = p.observacao.trim();
    if (t.length > 500) return { error: "Observação: até 500 caracteres." };
    out.observacao = t || null;
  }
  if (p.percepcoes != null) {
    if (typeof p.percepcoes !== "string") return { error: "Medidas inválidas." };
    const t = p.percepcoes.trim();
    if (t.length > 1000) return { error: "Percepções do aluno: até 1000 caracteres." };
    out.percepcoes = t || null;
  }
  return { data: out };
}

// "78,5" ou "78.5" -> 78.5. Vazio -> null. Inválido -> NaN.
export function parseMedida(raw: string) {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  return /^\d{1,3}(\.\d)?$/.test(s) ? Number(s) : NaN;
}

export const medidaInput = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));
export const medidaLabel = (n: number | null, unidade: string) =>
  n == null ? "—" : `${String(n).replace(".", ",")} ${unidade}`;
