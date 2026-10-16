"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

// Cliques em elementos com `data-track="evento"` viram eventos do GA4. Atributos
// `data-track-<param>` viram parâmetros. Assim server components rastreiam sem virar client.
export function RastreioCliques() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-track]");
      if (!el?.dataset.track) return;
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(el.dataset)) {
        if (k.startsWith("track") && k !== "track" && v) params[k.slice(5).toLowerCase()] = v;
      }
      track(el.dataset.track, params);
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
