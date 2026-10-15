"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { setUserRole } from "@/app/dashboard/admin/actions";
import type { AdminUser } from "@/app/dashboard/admin/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyNote, Panel } from "./section";
import { Tag } from "./tag";
import { UserMinus, UserPlus } from "lucide-react";
import { Dica } from "@/components/ajuda/dica";

function Person({ u }: { u: AdminUser }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{u.nome ?? u.email ?? "Usuário sem cadastro"}</p>
      {u.nome && <p className="truncate text-xs text-muted-foreground">{u.email}</p>}
    </div>
  );
}

export function AdminsManager({
  admins,
  candidatos,
  currentUserId,
}: {
  admins: AdminUser[];
  candidatos: AdminUser[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return candidatos
      .filter((c) => `${c.nome ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, candidatos]);

  function change(userId: string, role: "admin" | "member") {
    setError("");
    setBusy(userId);
    start(async () => {
      const res = await setUserRole(userId, role);
      if (!res.ok) setError(res.message);
      else {
        toast.success(role === "admin" ? "Aluno promovido a admin." : "Admin rebaixado a aluno.");
        if (role === "admin") setQuery("");
      }
      setBusy(null);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel aria-labelledby="adm-list">
        <h2 id="adm-list" className="mb-3 text-3xl">Admins</h2>
        {admins.length === 0 ? (
          <EmptyNote>Nenhum admin encontrado.</EmptyNote>
        ) : (
          <ul className="flex flex-col gap-2">
            {admins.map((a) => {
              const self = a.user_id === currentUserId;
              return (
                <li key={a.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
                  <Person u={a} />
                  <div className="flex shrink-0 items-center gap-2">
                    {self && <Tag>Você</Tag>}
                    <Button size="sm" variant="outline" disabled={self || busy === a.user_id}
                      title={self ? "Você não pode rebaixar a si mesmo" : undefined}
                      onClick={() => change(a.user_id, "member")} className="min-h-11 md:min-h-7"
                      aria-label={`Rebaixar ${a.nome ?? a.email ?? "admin"}`}>
                      <UserMinus data-icon="inline-start" />
                      Rebaixar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel aria-labelledby="adm-add">
        <div className="mb-3 flex items-center gap-1">
          <h2 id="adm-add" className="text-3xl">Promover aluno</h2>
          <Dica titulo="Promover aluno">
            Só aparece quem já entrou no site com o Google. Depois de promovida, a pessoa passa a entrar direto
            neste painel.
          </Dica>
        </div>
        <Label htmlFor="adm-busca">Buscar por nome ou e-mail</Label>
        <Input id="adm-busca" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Digite para buscar" autoComplete="off" className="mt-1.5 h-10 md:h-8" />
        {query.trim() && (
          matches.length === 0 ? (
            <EmptyNote>Nenhum aluno encontrado.</EmptyNote>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {matches.map((c) => (
                <li key={c.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
                  <Person u={c} />
                  <Button size="sm" disabled={busy === c.user_id} onClick={() => change(c.user_id, "admin")}
                    className="min-h-11 shrink-0 md:min-h-7" aria-label={`Promover ${c.nome ?? c.email} a admin`}>
                    <UserPlus data-icon="inline-start" />
                    Promover
                  </Button>
                </li>
              ))}
            </ul>
          )
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Admins têm acesso total: alunos, pagamentos, calendário e outros admins.
        </p>
      </Panel>
      {error && <p role="alert" className="text-sm text-destructive lg:col-span-2">{error}</p>}
    </div>
  );
}
