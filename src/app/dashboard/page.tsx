import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberForm } from "@/components/dashboard/member-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser, getOwnMember, isAdmin } from "./data";
import { STATUSES } from "./members";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [member, admin] = await Promise.all([getOwnMember(user.id), isAdmin(user.id)]);
  const status = STATUSES.find((s) => s.value === member?.status);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Meu cadastro</h1>
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
              Painel admin
            </Link>
          )}
        </div>
      </header>
      <MemberForm member={member} />
    </main>
  );
}
