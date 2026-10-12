"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Registra o service worker do painel e oferece "Instalar app" quando o navegador permite.
// Só é montado no layout do admin, então o convite nunca aparece para alunos.
export function PwaAdmin() {
  const [convite, setConvite] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/dashboard/admin" }).catch((e) => {
        console.error("[pwa] falha ao registrar o service worker", e);
      });
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setConvite(e as InstallEvent);
    };
    const onInstalado = () => setConvite(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalado);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalado);
    };
  }, []);

  if (!convite) return null;
  return (
    <Button size="sm" variant="outline" className="min-h-11 md:min-h-7"
      onClick={async () => {
        await convite.prompt();
        await convite.userChoice;
        setConvite(null);
      }}>
      <Download data-icon="inline-start" />
      Instalar app
    </Button>
  );
}
