"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save, Trash2, Undo2 } from "lucide-react";
import { apagarAnamnese } from "@/app/dashboard/admin/actions";
import { todayISO } from "@/app/dashboard/admin/format";
import {
  ANAMNESE_VAZIA, anamnesePreenchida, CAMPOS_TEXTO, DEPENDENTES, idade, PERGUNTAS, validarCamposAnamnese,
  type CampoAnamnese, type CamposAnamnese,
} from "@/lib/anamnese";
import { apagarRascunho, guardarRascunho, lerRascunho } from "@/lib/offline/rascunhos";
import { atualizar, descartar, enfileirar } from "@/lib/offline/store";
import { msgGuardado, useAdminEstado } from "@/lib/offline/use-admin";
import type { AnamneseVisao } from "@/lib/offline/visao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Panel } from "../section";
import { Tag } from "../tag";

type Valor = string | boolean | null;

// Texto vazio = sem resposta (null); textos sem espaços nas pontas.
const norm = (v: Valor | undefined): Valor => (typeof v === "string" ? v.trim() || null : (v ?? null));

const quando = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

// Sim / Não; tocar de novo na opção marcada volta para "sem resposta".
function SimNao({
  id, valor, onChange,
}: { id: string; valor: boolean | null; onChange: (v: boolean | null) => void }) {
  const opcao = (v: boolean, rotulo: string) => (
    <button type="button" role="radio" aria-checked={valor === v}
      onClick={() => onChange(valor === v ? null : v)}
      className={cn(
        "min-h-11 min-w-16 rounded-full border px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:min-h-8",
        valor === v
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}>
      {rotulo}
    </button>
  );
  return (
    <div role="radiogroup" aria-labelledby={id} className="flex gap-2">
      {opcao(true, "Sim")}
      {opcao(false, "Não")}
    </div>
  );
}

export function AnamneseForm({ memberId, anamnese }: { memberId: string; anamnese: AnamneseVisao | undefined }) {
  const { online, fila } = useAdminEstado();
  const base = anamnese ?? ANAMNESE_VAZIA(memberId);
  // Só o que o admin mexeu (vale sobre a versão mais recente que chegou do servidor/fila).
  const [rascunho, setRascunho] = useState<CamposAnamnese>(() => lerRascunho(memberId) ?? {});
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const hoje = todayISO();

  const valor = <K extends CampoAnamnese>(k: K): Valor =>
    (k in rascunho ? rascunho[k] : base[k]) as Valor;
  const texto = (k: CampoAnamnese) => (valor(k) as string | null) ?? "";
  const alterados = (Object.keys(rascunho) as CampoAnamnese[]).filter(
    (k) => norm(rascunho[k] as Valor) !== norm(base[k] as Valor),
  );
  const sujo = alterados.length > 0;

  function mudar(mudancas: Partial<Record<CampoAnamnese, Valor>>) {
    const novo = { ...rascunho, ...mudancas } as CamposAnamnese;
    for (const k of Object.keys(novo) as CampoAnamnese[])
      if (norm(novo[k] as Valor) === norm(base[k] as Valor)) delete novo[k];
    setRascunho(novo);
    guardarRascunho(memberId, novo);
    setErro("");
  }

  // Sim/Não com campos que só valem no "Sim": desmarcar limpa os dependentes.
  function mudarSimNao(k: keyof typeof DEPENDENTES | "praticou_exercicio", v: boolean | null) {
    const limpar = v === true ? {} : Object.fromEntries((DEPENDENTES[k] ?? []).map((d) => [d, null]));
    mudar({ [k]: v, ...limpar });
  }

  function descartarAlteracoes() {
    setRascunho({});
    apagarRascunho(memberId);
    setErro("");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!sujo) return;
    const campos: Record<string, Valor> = {};
    for (const k of alterados) campos[k] = norm(rascunho[k] as Valor);
    // Pares sempre juntos (Sim/Não + detalhe): a outra metade pode ter sido mudada por outro admin.
    for (const [pai, deps] of Object.entries(DEPENDENTES) as [CampoAnamnese, CampoAnamnese[]][]) {
      if ([pai, ...deps].some((k) => k in campos))
        for (const k of [pai, ...deps]) campos[k] = norm(valor(k));
    }
    const v = validarCamposAnamnese(campos, hoje);
    if ("error" in v) return setErro(v.error);

    setSalvando(true);
    const item = await enfileirar({ tipo: "anamnese_salvar", payload: { member_id: memberId, campos: v.data } });
    setSalvando(false);
    if (!item) return setErro("Não foi possível guardar neste aparelho. Tente de novo; se continuar, recarregue a página.");
    descartarAlteracoes();
    toast.success(msgGuardado(online, "Anamnese salva"));
  }

  async function apagar() {
    if (!online) return setErro("Apagar a anamnese precisa de conexão.");
    if (!confirmarApagar) return setConfirmarApagar(true);
    setSalvando(true);
    // Itens desta anamnese ainda na fila recriariam a linha depois de apagada.
    for (const i of fila) if (i.tipo === "anamnese_salvar" && i.payload.member_id === memberId) await descartar(i.id);
    const res = await apagarAnamnese(memberId);
    setSalvando(false);
    setConfirmarApagar(false);
    if (!res.ok) return setErro(res.message);
    descartarAlteracoes();
    toast.success("Anamnese apagada.");
    await atualizar();
  }

  const campoTexto = (k: keyof typeof CAMPOS_TEXTO, opts: { longo?: boolean; rotulo?: string; dica?: string } = {}) => {
    const id = `an-${k}`;
    const Comp = opts.longo ? Textarea : Input;
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{opts.rotulo ?? PERGUNTAS[k]}</Label>
        <Comp id={id} value={texto(k)} maxLength={CAMPOS_TEXTO[k]} autoComplete="off"
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => mudar({ [k]: e.target.value })}
          className={opts.longo ? "min-h-20" : "h-10 md:h-8"} />
        {opts.dica && <p className="text-xs text-muted-foreground">{opts.dica}</p>}
      </div>
    );
  };

  const campoData = (k: "data_nascimento" | "autoriza_imagem_data" | "consentimento_saude_data", rotulo?: string) => {
    const id = `an-${k}`;
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{rotulo ?? PERGUNTAS[k]}</Label>
        <Input id={id} type="date" max={hoje} min="1900-01-01" value={texto(k)}
          onChange={(e) => mudar({ [k]: e.target.value || null })} className="h-10 w-full sm:w-48 md:h-8" />
      </div>
    );
  };

  // Pergunta Sim/Não; com "Sim", os campos de detalhe aparecem logo abaixo.
  const pergunta = (k: keyof typeof DEPENDENTES, detalhes: React.ReactNode) => {
    const id = `an-${k}`;
    return (
      <div className="grid gap-2">
        <p id={id} className="text-sm font-medium">{PERGUNTAS[k]}</p>
        <SimNao id={id} valor={valor(k) as boolean | null} onChange={(v) => mudarSimNao(k, v)} />
        {valor(k) === true && <div className="grid gap-3 border-l-2 border-border pl-3">{detalhes}</div>}
      </div>
    );
  };

  const bloco = (titulo: string, children: React.ReactNode, className?: string) => (
    <Panel className={className}>
      <fieldset className="grid gap-4">
        <legend className="mb-1 font-display text-2xl">{titulo}</legend>
        {children}
      </fieldset>
    </Panel>
  );

  const nasc = valor("data_nascimento") as string | null;
  const anos = idade(nasc, hoje);

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {anamnesePreenchida(anamnese) && anamnese?.updated_at ? (
          <span>
            Atualizada em {quando(anamnese.updated_at)}
            {anamnese.updated_by_nome ? ` por ${anamnese.updated_by_nome}` : ""}
          </span>
        ) : !anamnese ? (
          <span>Ainda não preenchida. Tudo é opcional: dá para salvar por partes.</span>
        ) : null}
        {anamnese?.erro ? (
          <Tag hot title={anamnese.erro}>Erro no envio</Tag>
        ) : anamnese?.pendente ? (
          <Tag>Aguardando envio</Tag>
        ) : null}
      </div>

      {bloco("Dados pessoais", (
        <>
          <div className="flex flex-wrap items-end gap-3">
            {campoData("data_nascimento")}
            {anos != null && <p className="pb-2 text-sm text-muted-foreground">{anos} anos</p>}
          </div>
          {campoTexto("endereco")}
        </>
      ))}

      {bloco("Histórico de saúde", (
        <>
          {pergunta("doenca_cronica", campoTexto("doenca_cronica_quais", { longo: true }))}
          {pergunta("medicacao_continua", campoTexto("medicacao_quais", { longo: true }))}
          {pergunta("restricao_medica", campoTexto("restricao_detalhe", { longo: true }))}
        </>
      ))}

      {bloco("Histórico de atividade física", (
        pergunta("praticou_exercicio", (
          <>
            {campoTexto("modalidades_anteriores")}
            {campoTexto("tempo_pratica")}
          </>
        ))
      ))}

      {bloco("Objetivos", campoTexto("objetivos", { longo: true, rotulo: "O que busca com o treino" }))}

      {bloco("Cuidados no treino", (
        campoTexto("cuidados_treino", {
          longo: true,
          rotulo: "O que a professora precisa saber na aula",
          dica: "Ex.: evitar impacto; medir a pressão antes. Aparece em destaque no resumo da ficha.",
        })
      ), "border-accent/70")}

      {bloco("Autorizações", (
        <>
          {pergunta("autoriza_imagem", campoData("autoriza_imagem_data"))}
          {pergunta("consentimento_saude", campoData("consentimento_saude_data"))}
          <p className="text-xs text-muted-foreground">Marque conforme o que foi assinado no papel.</p>
        </>
      ))}

      {bloco("Observações", campoTexto("observacoes", { longo: true, rotulo: "Outras anotações" }))}

      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

      {anamnese && !anamnese.pendente && !anamnese.erro && (
        <div>
          <Button type="button" variant="destructive" disabled={salvando} onClick={() => void apagar()}
            onBlur={() => setConfirmarApagar(false)} className="min-h-11 md:min-h-8">
            <Trash2 data-icon="inline-start" />
            {confirmarApagar ? "Confirmar: apagar anamnese" : "Apagar anamnese"}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            Para atender um pedido de exclusão dos dados de saúde. Não apaga o cadastro nem as medidas.
          </p>
        </div>
      )}

      {/* Barra de salvar: fica presa no rodapé enquanto há alterações. */}
      {sujo && (
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
          <p className="text-sm text-muted-foreground">
            {alterados.length} {alterados.length === 1 ? "alteração não salva" : "alterações não salvas"}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={descartarAlteracoes} className="min-h-11 md:min-h-8">
              <Undo2 data-icon="inline-start" />Desfazer
            </Button>
            <Button type="submit" disabled={salvando} className="min-h-11 md:min-h-8">
              <Save data-icon="inline-start" />{salvando ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
