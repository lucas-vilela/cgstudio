"use client";

import { useActionState } from "react";
import { saveMember, type SaveState } from "@/app/dashboard/actions";
import { formatPhone, type Member } from "@/app/dashboard/members";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";

const initial: SaveState = { ok: false };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function MemberForm({ member }: { member: Member | null }) {
  const [state, action, pending] = useActionState(saveMember, initial);
  const e = state.errors ?? {};

  if (!member)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cadastro não encontrado</CardTitle>
          <CardDescription>
            Não localizamos seu registro de aluno. Fale com a recepção.
          </CardDescription>
        </CardHeader>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seus dados</CardTitle>
        <CardDescription>
          Mantenha seu nome e telefone atualizados. Plano e status são alterados pela recepção.
        </CardDescription>
      </CardHeader>
      <form action={action} noValidate>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nome" className="text-sm font-medium">Nome completo</label>
            <Input id="nome" name="nome" autoComplete="name" required maxLength={100}
              defaultValue={member.nome ?? ""} aria-invalid={!!e.nome}
              aria-describedby={e.nome ? "nome-error" : undefined} />
            <FieldError id="nome-error" message={e.nome} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="telefone" className="text-sm font-medium">Telefone</label>
            <Input id="telefone" name="telefone" type="tel" autoComplete="tel" required
              placeholder="(11) 91234-5678" defaultValue={formatPhone(member.telefone)}
              aria-invalid={!!e.telefone}
              aria-describedby={e.telefone ? "telefone-error" : undefined} />
            <FieldError id="telefone-error" message={e.telefone} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">E-mail</label>
            <Input id="email" value={member.email ?? ""} readOnly disabled />
          </div>
        </CardContent>
        <CardFooter className="gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
            {pending ? "Salvando…" : "Salvar alterações"}
          </Button>
          {state.message && (
            <p role="status" className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
              {state.message}
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
