import { Suspense } from "react";
import { AdminsManager } from "@/components/dashboard/admin/admins-manager";
import { PageLoading } from "@/components/dashboard/admin/page-loading";
import { requireAdmin } from "../guard";
import { getAdminsAndCandidates } from "../queries";

export default function AdminsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminsContent />
    </Suspense>
  );
}

async function AdminsContent() {
  const user = await requireAdmin();
  const { admins, candidatos } = await getAdminsAndCandidates();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl">Admins</h1>
      <AdminsManager admins={admins} candidatos={candidatos} currentUserId={user.id} />
    </div>
  );
}
