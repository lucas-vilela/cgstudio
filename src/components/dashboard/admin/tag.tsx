import { cn } from "@/lib/utils";

// Pílula com borda. `hot` (vermelho) só para prazos urgentes.
export function Tag({
  hot,
  className,
  ...props
}: React.ComponentProps<"span"> & { hot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold",
        hot ? "border-accent bg-accent text-accent-foreground" : "border-border text-foreground",
        className,
      )}
      {...props}
    />
  );
}
