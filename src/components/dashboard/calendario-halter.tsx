// Halter da marca como máscara: herda a cor do texto (no "seu horário" recebe text-accent).
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
