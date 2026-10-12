export function SectionTitle({
  label,
  children,
  note,
}: {
  label: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="mb-10">
      <p className="cg-label">{label}</p>
      <h2 className="mt-3 text-4xl md:text-5xl">{children}</h2>
      {note && <p className="mt-3 max-w-[60ch] text-muted-foreground">{note}</p>}
    </div>
  );
}
