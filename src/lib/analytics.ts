// Eventos personalizados do GA4. Nunca enviar dados pessoais (nome, e-mail, id do aluno).
type Params = Record<string, string | number>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Sem o GA carregado (dev, ou antes do script) não faz nada. */
export function track(evento: string, params?: Params) {
  window.gtag?.("event", evento, params);
}
