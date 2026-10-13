"use client";

import type { DepoimentoAdmin, Plan, SiteConfigRow, Treino } from "@/app/dashboard/admin/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DepoimentosModeracao } from "./depoimentos-moderacao";
import { PlanosEditor } from "./planos-editor";
import { TextosEditor } from "./textos-editor";
import { TreinosEditor } from "./treinos-editor";

export function ConteudoTabs({
  planos, treinos, depoimentos, config, padrao,
}: {
  planos: Plan[];
  treinos: Treino[];
  depoimentos: DepoimentoAdmin[];
  config: SiteConfigRow;
  padrao: Record<keyof SiteConfigRow, string>;
}) {
  const pendentes = depoimentos.filter((d) => d.status === "pendente").length;
  const trigger = "min-h-11 px-4 md:min-h-7";
  return (
    <Tabs defaultValue="planos" className="gap-4">
      <TabsList className="grid w-full grid-cols-2 group-data-horizontal/tabs:h-auto sm:flex sm:w-fit">
        <TabsTrigger value="planos" className={trigger}>Planos</TabsTrigger>
        <TabsTrigger value="treinos" className={trigger}>Treinos</TabsTrigger>
        <TabsTrigger value="depoimentos" className={trigger}>
          Depoimentos{pendentes > 0 ? ` (${pendentes})` : ""}
        </TabsTrigger>
        <TabsTrigger value="textos" className={trigger}>Textos</TabsTrigger>
      </TabsList>
      <TabsContent value="planos"><PlanosEditor planos={planos} /></TabsContent>
      <TabsContent value="treinos"><TreinosEditor treinos={treinos} /></TabsContent>
      <TabsContent value="depoimentos"><DepoimentosModeracao depoimentos={depoimentos} /></TabsContent>
      <TabsContent value="textos"><TextosEditor config={config} padrao={padrao} /></TabsContent>
    </Tabs>
  );
}
