export function PageLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy role="status">
      <span className="sr-only">Carregando…</span>
      <div className="h-10 w-48 rounded-lg bg-surface motion-safe:animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-surface motion-safe:animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-surface motion-safe:animate-pulse" />
    </div>
  );
}
