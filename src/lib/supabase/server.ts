import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente com sessão (cookies). Crie um novo por requisição; não use dentro de `use cache`.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component: ignorável, o proxy já renova a sessão.
          }
        },
      },
    },
  );
}

// Usuário autenticado verificado no servidor (valida o JWT). Retorna null se não logado.
export async function getUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}
