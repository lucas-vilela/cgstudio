import { Suspense } from "react";
import { AdminApp } from "@/components/dashboard/admin/app/admin-app";
import { UsuarioDoServidor } from "@/components/dashboard/admin/app/usuario-do-servidor";
import { requireAdmin } from "./guard";

// Alunos, Financeiro e Calendário: o mesmo app de cliente, que lê os dados salvos no aparelho
// (funciona offline) e sincroniza com o servidor. Ele fica na casca fixa da página; a checagem de
// admin no servidor roda à parte e só redireciona quem não pode estar aqui.
export default function Page() {
  return (
    <>
      <Suspense fallback={null}>
        <Guarda />
      </Suspense>
      <AdminApp />
    </>
  );
}

async function Guarda() {
  const user = await requireAdmin();
  return <UsuarioDoServidor id={user.id} />;
}
