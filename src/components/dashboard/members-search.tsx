import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// GET form: a busca vira ?q= e a página (server component) refaz a consulta.
export function MembersSearch({ defaultValue }: { defaultValue: string }) {
  return (
    <form method="get" className="flex gap-2" role="search">
      <Input name="q" type="search" defaultValue={defaultValue}
        placeholder="Buscar por nome, e-mail ou telefone" aria-label="Buscar alunos" />
      <Button type="submit" variant="secondary">
        <Search data-icon="inline-start" />
        Buscar
      </Button>
    </form>
  );
}
