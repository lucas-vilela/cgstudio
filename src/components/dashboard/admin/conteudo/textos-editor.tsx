"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { saveSiteConfig } from "@/app/dashboard/admin/conteudo-actions";
import type { SiteConfigRow } from "@/app/dashboard/admin/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "../section";

type Campo = {
  key: keyof SiteConfigRow;
  label: string;
  max: number;
  longo?: boolean;
  ajuda?: string;
};

const GRUPOS: { titulo: string; campos: Campo[] }[] = [
  {
    titulo: "Topo da página",
    campos: [
      { key: "hero_titulo", label: "Título", max: 80 },
      { key: "hero_destaque", label: "Destaque (em vermelho)", max: 80 },
      { key: "hero_subtitulo", label: "Subtítulo", max: 200, longo: true },
    ],
  },
  {
    titulo: "Contato",
    campos: [
      { key: "whatsapp", label: "WhatsApp", max: 25, ajuda: "DDI + DDD + número. Ex.: 55 53 98457-3198" },
      { key: "instagram", label: "Instagram", max: 30, ajuda: "Só o usuário, sem @." },
      { key: "nota_contato", label: "Frase da seção Contato", max: 200, longo: true },
    ],
  },
  {
    titulo: "Frases de apoio das seções",
    campos: [
      { key: "nota_modalidades", label: "Modalidades", max: 200, longo: true },
      { key: "nota_planos", label: "Planos", max: 200, longo: true },
      { key: "nota_horarios", label: "Horários", max: 200, longo: true },
    ],
  },
  {
    titulo: "Google",
    campos: [
      { key: "meta_descricao", label: "Descrição do site nas buscas", max: 300, longo: true,
        ajuda: "Pode demorar alguns minutos para o Google mostrar a mudança." },
    ],
  },
];

export function TextosEditor({
  config, padrao,
}: { config: SiteConfigRow; padrao: Record<keyof SiteConfigRow, string> }) {
  const [valores, setValores] = useState<SiteConfigRow>(config);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await saveSiteConfig(valores);
      setMsg(res.ok ? { ok: true, text: "Textos salvos." } : { ok: false, text: res.message });
    });
  }

  return (
    <Panel aria-labelledby="txt-title">
      <h2 id="txt-title" className="text-3xl">Textos da home</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Campo vazio usa o texto padrão (mostrado em cinza dentro do campo).
      </p>
      <form onSubmit={submit} className="grid gap-6" noValidate>
        {GRUPOS.map((g) => (
          <fieldset key={g.titulo} className="grid gap-3 rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-semibold">{g.titulo}</legend>
            {g.campos.map((c) => {
              const id = `tx-${c.key}`;
              const comum = {
                id,
                value: valores[c.key] ?? "",
                maxLength: c.max,
                placeholder: padrao[c.key],
                onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) =>
                  setValores((v) => ({ ...v, [c.key]: e.target.value })),
              };
              return (
                <div key={c.key} className="grid gap-1.5">
                  <Label htmlFor={id}>{c.label}</Label>
                  {c.longo ? <Textarea rows={2} {...comum} /> : <Input className="h-10 md:h-8" {...comum} />}
                  {c.ajuda && <p className="text-xs text-muted-foreground">{c.ajuda}</p>}
                </div>
              );
            })}
          </fieldset>
        ))}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending} className="min-h-11 md:min-h-8">
            <Save data-icon="inline-start" />
            {pending ? "Salvando…" : "Salvar textos"}
          </Button>
          {msg && (
            <p role={msg.ok ? "status" : "alert"}
              className={msg.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
              {msg.text}
            </p>
          )}
        </div>
      </form>
    </Panel>
  );
}
