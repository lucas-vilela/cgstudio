import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser, isAdmin } from "../data";

// Use no início de cada página de admin (dentro de Suspense). Retorna o usuário admin.
export async function requireAdmin() {
  // Páginas de admin são sempre por request; sem isto o cliente do Supabase usa Date.now() no prerender.
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!(await isAdmin(user.id))) notFound();
  return user;
}
