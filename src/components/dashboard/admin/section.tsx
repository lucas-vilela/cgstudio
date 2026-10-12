import { cn } from "@/lib/utils";

// Rótulo de seção (halter + caixa alta) e cartão no estilo do painel.
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="cg-label">{children}</p>;
}

export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-xl border border-border bg-surface p-4 md:p-5", className)}
      {...props}
    />
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
