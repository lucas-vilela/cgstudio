// Telas do admin que funcionam offline: as três rotas renderizam o mesmo app de cliente (AdminApp)
// e a troca entre elas é só pushState (AdminNav).
export const SECOES_OFFLINE = new Set(["/dashboard/admin", "/dashboard/admin/financeiro", "/dashboard/admin/calendario"]);
