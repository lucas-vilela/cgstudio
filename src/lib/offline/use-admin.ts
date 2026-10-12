"use client";

import { useMemo, useSyncExternalStore } from "react";
import { adminStore } from "./store";
import { montarVisao, type Visao } from "./visao";

export function useAdminEstado() {
  return useSyncExternalStore(adminStore.subscribe, adminStore.get, adminStore.get);
}

export function useVisao(): Visao | null {
  const { snapshot, fila } = useAdminEstado();
  return useMemo(() => (snapshot ? montarVisao(snapshot, fila) : null), [snapshot, fila]);
}

// Mensagem padrão de confirmação de uma ação enfileirada.
export const msgGuardado = (online: boolean, oQue: string) =>
  online ? `${oQue}.` : `${oQue}. Será enviado quando a conexão voltar.`;
