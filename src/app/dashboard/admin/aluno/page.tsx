import { PaginaAdminApp } from "../pagina-app";

// Ficha do aluno: /dashboard/admin/aluno?id=<member_id>. Rota fixa (o id vai na query) para a casca
// ser estática como as outras telas e o service worker guardar uma cópia só: o app de cliente lê o id
// do endereço, também offline.
export default function Page() {
  return <PaginaAdminApp />;
}
