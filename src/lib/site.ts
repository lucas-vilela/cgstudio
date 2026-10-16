// URL pública do site. Na Vercel vem do domínio de produção do projeto (muda sozinha se
// um domínio próprio for configurado); fora dela, cai no endereço local.
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";
