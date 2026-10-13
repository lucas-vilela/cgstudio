import { Loader2, LogIn, LogOut } from "lucide-react";
import { faixa, type SlotVaga } from "@/app/dashboard/calendario-lib";
import { Button } from "@/components/ui/button";
import { Halter } from "./calendario-halter";

type Props = {
  slot: SlotVaga;
  meu: boolean;
  /** Aula grátis marcada neste slot: data curta, ex. "14/10". */
  gratisEm?: string;
  podeEntrar: boolean;
  /** Pendente não entra em slots (usa a aula grátis): sem botão em vez de botão desabilitado. */
  semBotaoEntrar?: boolean;
  /** Mostra o horário dentro do cartão (lista mobile); na grade ele fica no cabeçalho da linha. */
  mostrarHora?: boolean;
  carregando: "entrar" | "sair" | null;
  ocupado: boolean;
  onEntrar: () => void;
  onSair: () => void;
};

export function CalendarioSlot({ slot, meu, gratisEm, podeEntrar, semBotaoEntrar, mostrarHora, carregando, ocupado, onEntrar, onSair }: Props) {
  const lotado = slot.vagas <= 0;
  const pct = Math.min(100, Math.round((slot.ocupados / Math.max(slot.capacidade, 1)) * 100));
  const vagasTxt = lotado ? "Lotado" : slot.vagas === 1 ? "1 vaga" : `${slot.vagas} vagas`;
  const desfoque = lotado && !meu;

  return (
    <div
      className={[
        "flex min-h-16 flex-col gap-2 rounded-xl border p-3 text-sm transition-colors",
        meu
          ? "border-white bg-surface-2 text-white"
          : "border-border bg-surface-2 " + (lotado ? "opacity-45" : "hover:border-accent"),
      ].join(" ")}
      data-state={meu ? "meu" : lotado ? "lotado" : "livre"}
    >
      {mostrarHora && <span className="text-[13px] font-medium opacity-80">{faixa(slot)}</span>}
      <span className="flex items-center gap-1.5 font-semibold">
        {meu ? (
          <>
            <Halter className="text-accent" /> Seu horário
          </>
        ) : (
          vagasTxt
        )}
      </span>
      {meu && <span className="text-xs opacity-90">{vagasTxt}</span>}
      {gratisEm && !meu && (
        <span className="w-fit rounded-full border border-accent px-2 py-0.5 text-xs font-medium text-accent">
          Aula grátis em {gratisEm}
        </span>
      )}
      <div
        className={`h-1 overflow-hidden rounded-full ${meu ? "bg-white/35" : "bg-white/15"}`}
        role="img"
        aria-label={`${slot.ocupados} de ${slot.capacidade} lugares ocupados`}
      >
        <i className={`block h-full ${meu ? "bg-white" : "bg-foreground"}`} style={{ width: `${pct}%` }} />
      </div>

      {meu ? (
        <Button
          variant="ghost"
          className="h-11 border-white/50 bg-white/15 text-white hover:bg-white/25 hover:text-white md:h-9"
          disabled={ocupado}
          onClick={onSair}
        >
          {carregando === "sair" ? (
            <>
              <Loader2 className="animate-spin" /> Saindo…
            </>
          ) : (
            <>
              <LogOut /> Sair
            </>
          )}
        </Button>
      ) : !desfoque && podeEntrar ? (
        <Button className="h-11 md:h-9" disabled={ocupado} onClick={onEntrar}>
          {carregando === "entrar" ? (
            <>
              <Loader2 className="animate-spin" /> Entrando…
            </>
          ) : (
            <>
              <LogIn /> Entrar
            </>
          )}
        </Button>
      ) : !desfoque && !semBotaoEntrar ? (
        <Button className="h-11 md:h-9" disabled aria-disabled>
          <LogIn /> Entrar
        </Button>
      ) : null}
    </div>
  );
}
