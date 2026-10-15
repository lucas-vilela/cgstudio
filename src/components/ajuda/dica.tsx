"use client";

import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Dica curta ao lado de uma funcionalidade do painel. Abre ao passar o mouse e também ao tocar
// (no celular não existe hover), e fecha com Esc ou tocando fora.
export function Dica({
  titulo,
  children,
  className,
}: {
  /** Nome da funcionalidade: vira o rótulo do botão para leitores de tela. */
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        aria-label={`Dica: ${titulo}`}
        className={cn(
          "inline-grid size-8 shrink-0 place-items-center rounded-full align-middle text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:text-accent md:size-6",
          className,
        )}
      >
        <CircleHelp aria-hidden className="size-4" />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 max-w-[calc(100vw-2rem)] gap-1 font-sans text-sm leading-relaxed">
        <p className="font-semibold text-foreground">{titulo}</p>
        <div className="text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
