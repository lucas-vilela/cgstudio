"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CloudOff, FileSpreadsheet, Loader2, RefreshCw, Wifi } from "lucide-react";
import { exportarPlanilha } from "@/lib/offline/backup";
import { Button } from "@/components/ui/button";
import { atualizar, sincronizar } from "@/lib/offline/store";
import { useAdminEstado } from "@/lib/offline/use-admin";
import type { Visao } from "@/lib/offline/visao";

const hora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Selo fixo: conexão, fila e idade dos dados.
export function StatusConexao({ visao }: { visao: Visao | null }) {
  const e = useAdminEstado();
  const [exportando, setExportando] = useState(false);

  async function exportar() {
    if (!visao) return;
    setExportando(true);
    try {
      await exportarPlanilha(visao, e.fila);
      toast.success("Planilha exportada.");
    } catch (err) {
      console.error("[backup]", err);
      toast.error("Não foi possível gerar a planilha.");
    } finally {
      setExportando(false);
    }
  }
  const aguardando = e.fila.filter((i) => i.status === "pendente").length;
  const comErro = e.fila.filter((i) => i.status === "erro").length;

  return (
    <div role="status" aria-live="polite"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm">
      <span className="inline-flex items-center gap-1.5 font-semibold">
        {e.online ? <Wifi aria-hidden className="size-4" /> : <CloudOff aria-hidden className="size-4 text-accent" />}
        {e.online ? "Online" : "Offline"}
      </span>
      {e.snapshot && (
        <span className="text-muted-foreground">Dados de {hora(e.snapshot.gerado_em)}</span>
      )}
      {(aguardando > 0 || e.sincronizando) && (
        <span className="inline-flex items-center gap-1.5">
          {e.sincronizando && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {aguardando} {aguardando === 1 ? "registro aguardando envio" : "registros aguardando envio"}
        </span>
      )}
      {comErro > 0 && (
        <a href="#pendencias" className="font-semibold text-accent underline-offset-4 hover:underline">
          {comErro} com erro
        </a>
      )}
      <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
      <Button size="sm" variant="outline" className="min-h-11 md:min-h-7" disabled={!visao || exportando}
        onClick={() => void exportar()}>
        <FileSpreadsheet data-icon="inline-start" />
        {exportando ? "Gerando…" : "Exportar planilha"}
      </Button>
      {e.online && (
        <Button size="sm" variant="ghost" className="min-h-11 md:min-h-7"
          disabled={e.sincronizando || e.atualizando}
          onClick={() => void sincronizar().then(() => atualizar())}>
          <RefreshCw data-icon="inline-start" className={e.atualizando ? "animate-spin" : undefined} />
          Atualizar
        </Button>
      )}
      </div>
      {e.precisaLogin && (
        <p className="basis-full text-accent">
          Sua sessão expirou. <Link href="/" className="font-semibold underline">Entre novamente</Link> para enviar os registros
          guardados; nada foi perdido.
        </p>
      )}
      {e.filaDeOutraConta && (
        <p className="basis-full text-muted-foreground">
          Há registros de outra conta guardados neste aparelho. Eles só são enviados quando essa conta entrar.
        </p>
      )}
    </div>
  );
}
