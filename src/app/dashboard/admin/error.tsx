"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-6">
      <h2 className="text-2xl">Não foi possível carregar</h2>
      <p className="text-sm text-muted-foreground">
        Ocorreu um erro ao buscar os dados. Tente novamente em instantes.
      </p>
      <Button onClick={reset}>Tentar de novo</Button>
    </div>
  );
}
