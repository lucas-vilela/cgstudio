import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CalendarioAluno } from "@/components/dashboard/calendario-aluno";
import { MemberForm } from "@/components/dashboard/member-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { agendarExperimental, cancelarExperimental, entrarSlot, sairSlot, vagasNaData } from "./calendario-actions";
import { getDadosCalendario } from "./calendario-data";
import { hojeSaoPaulo } from "./calendario-lib";
import { getCurrentUser, getOwnMember, isAdmin } from "./data";
import { STATUSES } from "./members";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  // Dados dependem da sessão (cookies): precisam ficar dentro de Suspense.
  return (
    <Suspense fallback={<Loading />}>
      <DashboardContent />
    </Suspense>
  );
}

function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 text-sm text-muted-foreground" aria-busy>
      Carregando…
    </main>
  );
}

async function DashboardContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [member, admin] = await Promise.all([getOwnMember(user.id), isAdmin(user.id)]);
  const status = STATUSES.find((s) => s.value === member?.status);
  const calendario = member ? await getDadosCalendario(member.id) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl">Meu painel</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <Badge variant={member?.status === "ativo" ? "default" : "secondary"}>
              {status.label}
            </Badge>
          )}
          <SignOutButton />
          {admin && (
            <Link href="/dashboard/admin" className={buttonVariants({ variant: "outline" })}>
              <LayoutDashboard data-icon="inline-start" />
              Painel admin
            </Link>
          )}
        </div>
      </header>
      {member &&
        (calendario ? (
          <CalendarioAluno
            {...calendario}
            hoje={hojeSaoPaulo()}
            acoes={{ entrar: entrarSlot, sair: sairSlot, agendarExperimental, cancelarExperimental, vagasNaData }}
          />
        ) : (
          <p role="status" className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
            O calendário não está disponível no momento. Tente novamente em instantes.
          </p>
        ))}
      <div className="w-full max-w-2xl">
        <MemberForm member={member} />
      </div>
    </main>
  );
}
