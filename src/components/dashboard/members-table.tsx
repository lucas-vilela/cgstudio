"use client";

import { useState, useTransition } from "react";
import { updateMemberAdmin } from "@/app/dashboard/actions";
import { PLANS, STATUSES, formatPhone, type Member } from "@/app/dashboard/members";

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

function FieldSelect({
  member, field, options, onError,
}: {
  member: Member;
  field: "plano" | "status";
  options: readonly { value: string; label: string }[];
  onError: (m: string) => void;
}) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState(member[field] ?? "");

  function change(next: string) {
    const prev = value;
    setValue(next);
    onError("");
    start(async () => {
      const res = await updateMemberAdmin(member.id, { [field]: next });
      if (!res.ok) {
        setValue(prev);
        onError(res.message ?? "Erro ao salvar.");
      }
    });
  }

  return (
    <select aria-label={`${field === "plano" ? "Plano" : "Status"} de ${member.nome ?? member.email}`}
      value={value} disabled={pending} onChange={(ev) => change(ev.target.value)} className={selectClass}>
      {field === "plano" && !value && <option value="" disabled>Sem plano</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function MembersTable({ members }: { members: Member[] }) {
  const [error, setError] = useState("");

  if (!members.length)
    return <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</p>;

  return (
    <div className="flex flex-col gap-2">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50 text-muted-foreground">
            <tr>
              {["Nome", "E-mail", "Telefone", "Plano", "Desde", "Status"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{m.nome ?? "—"}</td>
                <td className="px-3 py-2">{m.email ?? "—"}</td>
                <td className="px-3 py-2">{m.telefone ? formatPhone(m.telefone) : "—"}</td>
                <td className="px-3 py-2"><FieldSelect member={m} field="plano" options={PLANS} onError={setError} /></td>
                <td className="px-3 py-2">{new Date(m.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-3 py-2"><FieldSelect member={m} field="status" options={STATUSES} onError={setError} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
