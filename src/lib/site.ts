// URL pública do site. Na Vercel vem do domínio de produção do projeto (muda sozinha se
// um domínio próprio for configurado); fora dela, cai no endereço local.
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

// Mesmo endereço do Perfil da Empresa no Google: manter os dois idênticos ajuda a busca local.
export const ENDERECO = {
  logradouro: "Vila Nova, 7º distrito",
  bairro: "Quilombo",
  cidade: "Pelotas",
  uf: "RS",
  cep: "96145-000",
} as const;

export const MAPA_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `CG Studio, ${ENDERECO.logradouro}, ${ENDERECO.bairro}, ${ENDERECO.cidade} - ${ENDERECO.uf}`,
)}`;
