"use client";

import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { contarFila, limparUsuario } from "@/lib/offline/db";
import { encerrar } from "@/lib/offline/store";

// Para admin (`limparDadosDe` = id do usuário): o logout apaga os dados do app offline guardados
// no aparelho. Se ainda houver registros não enviados, pede confirmação antes.
async function limparAparelho(userId: string) {
  encerrar();
  await limparUsuario(userId);
  navigator.serviceWorker?.controller?.postMessage("limpar-cache");
  const reg = await navigator.serviceWorker?.getRegistration("/dashboard/admin");
  reg?.active?.postMessage("limpar-cache");
}

export function SignOutButton({
  children = "Sair",
  variant = "outline",
  limparDadosDe,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type" | "onClick"> & { limparDadosDe?: string }) {
  const form = useRef<HTMLFormElement>(null);
  const liberado = useRef(false);
  const [naoEnviados, setNaoEnviados] = useState(0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!limparDadosDe || liberado.current) return;
    e.preventDefault();
    const n = await contarFila(limparDadosDe).catch(() => 0);
    if (n > 0) return setNaoEnviados(n);
    await sair();
  }

  async function sair() {
    if (limparDadosDe) await limparAparelho(limparDadosDe).catch(() => undefined);
    liberado.current = true;
    form.current?.requestSubmit();
  }

  return (
    <>
      <form ref={form} action={signOut} onSubmit={onSubmit}>
        <Button type="submit" variant={variant} {...props}>
          <LogOut data-icon="inline-start" />
          {children}
        </Button>
      </form>
      <Dialog open={naoEnviados > 0} onOpenChange={(o) => !o && setNaoEnviados(0)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Sair mesmo assim?</DialogTitle>
            <DialogDescription>
              {naoEnviados} {naoEnviados === 1 ? "registro ainda não foi enviado" : "registros ainda não foram enviados"} ao
              servidor. Ao sair, {naoEnviados === 1 ? "ele será apagado" : "eles serão apagados"} deste aparelho e não
              chegarão ao sistema. Se puder, conecte-se à internet e espere o envio antes de sair.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNaoEnviados(0)} className="min-h-11 md:min-h-8">Ficar</Button>
            <Button variant="destructive" onClick={() => void sair()} className="min-h-11 md:min-h-8">
              Sair e apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
