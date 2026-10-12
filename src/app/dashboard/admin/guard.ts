import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "../data";

// Use no início de cada página de admin (dentro de Suspense). Retorna o usuário admin.
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!(await isAdmin(user.id))) notFound();
  return user;
}
