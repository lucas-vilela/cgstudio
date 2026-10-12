import { Suspense } from "react";
import { PageLoading } from "@/components/dashboard/admin/page-loading";
import { SlotsBoard } from "@/components/dashboard/admin/slots-board";
import { requireAdmin } from "../guard";
import { getSlots } from "../queries";

export default function CalendarioPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CalendarioContent />
    </Suspense>
  );
}

async function CalendarioContent() {
  await requireAdmin();
  const slots = await getSlots();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl">Calendário</h1>
        <p className="text-sm text-muted-foreground">
          Horários semanais, capacidade e alunos de cada turma.
        </p>
      </div>
      <SlotsBoard slots={slots} />
    </div>
  );
}
