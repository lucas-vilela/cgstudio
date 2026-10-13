"use client";

import { useEffect } from "react";
import { definirUsuario } from "./admin-app";

// Renderizado pela checagem de admin do servidor: passa o usuário confirmado para o app offline.
export function UsuarioDoServidor({ id }: { id: string }) {
  useEffect(() => {
    definirUsuario(id);
  }, [id]);
  return null;
}
