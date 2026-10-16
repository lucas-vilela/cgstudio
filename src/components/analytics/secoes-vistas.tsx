"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

// `secao_vista` uma vez por seção da home, quando boa parte dela entra na tela.
export function SecoesVistas() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          track("secao_vista", { secao: e.target.id });
          io.unobserve(e.target);
        }
      },
      { threshold: 0.3 },
    );
    document.querySelectorAll("main section[id], footer[id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
