export function SectionTitle({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="mb-12">
      <p className="mb-3 text-sm font-medium tracking-[0.2em] text-[var(--cg-signal)] uppercase">{kicker}</p>
      <h2 className="cg-display text-5xl md:text-7xl">{children}</h2>
    </div>
  );
}
