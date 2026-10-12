// Halter da marca como máscara: herda a cor do texto (branco sobre o vermelho do "seu horário").
export function Halter({ className = "" }: { className?: string }) {
  const mask = "url(/brand/halter-limpo.svg) center / contain no-repeat";
  return (
    <span
      aria-hidden
      className={`inline-block h-[13px] w-[9px] shrink-0 bg-current ${className}`}
      style={{ mask, WebkitMask: mask }}
    />
  );
}
