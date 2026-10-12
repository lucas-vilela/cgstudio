import { Suspense } from "react";
import { ConteudoTabs } from "@/components/dashboard/admin/conteudo/conteudo-tabs";
import { PageLoading } from "@/components/dashboard/admin/page-loading";
import { SITE_CONFIG_PADRAO } from "@/lib/cms";
import { requireAdmin } from "../guard";
import { getDepoimentosAdmin, getPlans, getSiteConfigAdmin, getTreinos } from "../queries";

export default function ConteudoPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ConteudoContent />
    </Suspense>
  );
}

async function ConteudoContent() {
  await requireAdmin();
  const [planos, treinos, depoimentos, config] = await Promise.all([
    getPlans(),
    getTreinos(),
    getDepoimentosAdmin(),
    getSiteConfigAdmin(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl">Conteúdo</h1>
        <p className="text-sm text-muted-foreground">
          Planos, treinos, depoimentos e textos que aparecem na home. As mudanças valem em poucos segundos.
        </p>
      </div>
      <ConteudoTabs
        planos={planos}
        treinos={treinos}
        depoimentos={depoimentos}
        config={config}
        padrao={SITE_CONFIG_PADRAO}
      />
    </div>
  );
}
