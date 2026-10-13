// Service worker do painel do admin (escopo /dashboard/admin). Ver docs/plano-pwa-offline.md.
//
// - Páginas do admin (navegação): rede primeiro; sem rede, a última cópia salva. É só a "casca":
//   os dados vêm do IndexedDB do app, nunca deste cache.
// - /_next/static e ícones: cache primeiro (arquivos com hash, não mudam).
// - API, payload RSC e qualquer outra coisa: só rede (nada de dado de admin aqui).
const VERSAO = "v1";
const PAGINAS = `cg-admin-paginas-${VERSAO}`;
const ESTATICOS = `cg-admin-estaticos-${VERSAO}`;
const INICIO = "/dashboard/admin";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGINAS).then((c) => c.add(INICIO).catch(() => undefined)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("cg-admin-") && ![PAGINAS, ESTATICOS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Logout: o app pede para apagar as páginas salvas.
self.addEventListener("message", (event) => {
  if (event.data === "limpar-cache") event.waitUntil(caches.delete(PAGINAS));
});

const ehEstatico = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa/") || url.pathname.startsWith("/brand/");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate" && url.pathname.startsWith("/dashboard/admin")) {
    event.respondWith(paginaRedePrimeiro(req, url));
    return;
  }
  if (ehEstatico(url)) {
    event.respondWith(estaticoCachePrimeiro(req));
  }
});

async function paginaRedePrimeiro(req, url) {
  const cache = await caches.open(PAGINAS);
  const chave = url.origin + url.pathname; // sem query: uma cópia por tela
  try {
    const res = await fetch(req);
    // Só guarda páginas boas do próprio admin (não redirecionamentos para o login nem erros).
    if (res.ok && !res.redirected) cache.put(chave, res.clone());
    return res;
  } catch {
    return (await cache.match(chave)) || (await cache.match(url.origin + INICIO)) || Response.error();
  }
}

// Cada deploy traz arquivos novos (nomes com hash). Mantém só os mais recentes para o cache não
// crescer para sempre e o navegador não precisar despejar o armazenamento do site (onde está a fila).
const MAX_ESTATICOS = 150;

async function estaticoCachePrimeiro(req) {
  const cache = await caches.open(ESTATICOS);
  const salvo = await cache.match(req);
  if (salvo) return salvo;
  const res = await fetch(req);
  if (res.ok) {
    await cache.put(req, res.clone());
    const chaves = await cache.keys(); // em ordem de inserção
    await Promise.all(chaves.slice(0, Math.max(0, chaves.length - MAX_ESTATICOS)).map((k) => cache.delete(k)));
  }
  return res;
}
