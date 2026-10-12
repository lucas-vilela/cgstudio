import Link from "next/link";
import { AdminNav } from "@/components/dashboard/admin/admin-nav";
import { UserRound } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:py-10">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="cg-label">Painel do admin</p>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            <UserRound aria-hidden className="size-4" />
            Meu cadastro
          </Link>
        </div>
        <AdminNav />
      </header>
      {children}
    </main>
  );
}
