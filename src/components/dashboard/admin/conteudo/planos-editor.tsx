"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { updatePlano } from "@/app/dashboard/admin/conteudo-actions";
import { moneyInput, parseMoney } from "@/app/dashboard/admin/format";
import type { Plan } from "@/app/dashboard/admin/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyNote, Panel } from "../section";

function PlanoCard({ plano }: { plano: Plan }) {
  const [valor, setValor] = useState(moneyInput(plano.valor_padrao));
  const [descricao, setDescricao] = useState(plano.descricao ?? "");
  const [exibir, setExibir] = useState(plano.exibir_na_home);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const parsed = parseMoney(valor);
    if (parsed === null || Number.isNaN(parsed)) return setMsg({ ok: false, text: "Informe um valor válido." });
    start(async () => {
      const res = await updatePlano({ id: plano.id, valorPadrao: parsed, descricao, exibirNaHome: exibir });
      setMsg(res.ok ? { ok: true, text: "Salvo." } : { ok: false, text: res.message });
    });
  }

  return (
    <li className="rounded-xl border border-border bg-surface-2 p-4">
      <form onSubmit={submit} className="grid gap-3" noValidate>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-3xl">{plano.nome}</h3>
          <span className="text-xs text-muted-foreground">
            {plano.vezes_semana} {plano.vezes_semana === 1 ? "aula" : "aulas"} por semana
          </span>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`pl-valor-${plano.id}`}>Valor padrão (R$)</Label>
          <Input id={`pl-valor-${plano.id}`} inputMode="decimal" value={valor}
            onChange={(e) => setValor(e.target.value)} className="h-10 md:h-8" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`pl-desc-${plano.id}`}>Descrição (opcional)</Label>
          <Input id={`pl-desc-${plano.id}`} value={descricao} maxLength={120}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={`${plano.vezes_semana} ${plano.vezes_semana === 1 ? "aula" : "aulas"} por semana`}
            className="h-10 md:h-8" />
        </div>
        <div className="flex min-h-11 items-center gap-3">
          <Switch id={`pl-home-${plano.id}`} checked={exibir} onCheckedChange={setExibir}
            aria-label={`Mostrar o plano ${plano.nome} na home`} />
          <Label htmlFor={`pl-home-${plano.id}`}>Mostrar na home</Label>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending} className="min-h-11 md:min-h-8">
            <Save data-icon="inline-start" />
            {pending ? "Salvando…" : "Salvar"}
          </Button>
          {msg && (
            <p role={msg.ok ? "status" : "alert"}
              className={msg.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
              {msg.text}
            </p>
          )}
        </div>
      </form>
    </li>
  );
}

export function PlanosEditor({ planos }: { planos: Plan[] }) {
  return (
    <Panel aria-labelledby="planos-title">
      <h2 id="planos-title" className="text-3xl">Planos</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        O valor padrão é o mesmo usado na cobrança: mudar aqui muda a home e as próximas cobranças de quem
        não tem valor acordado. Pagamentos já registrados não mudam.
      </p>
      {planos.length === 0 ? (
        <EmptyNote>Nenhum plano cadastrado.</EmptyNote>
      ) : (
        <ul className="grid gap-4 md:grid-cols-3">
          {planos.map((p) => (
            // Reinicia o formulário quando o servidor devolve dados novos.
            <PlanoCard key={`${p.id}-${p.valor_padrao}-${p.descricao}-${p.exibir_na_home}`} plano={p} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
