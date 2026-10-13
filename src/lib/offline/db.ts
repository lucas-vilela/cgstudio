import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AdminSnapshot, ItemFila } from "./tipos";

// IndexedDB do app offline do admin. Tudo é chaveado pelo user_id de quem baixou/registrou:
// outra conta no mesmo aparelho não vê nem envia nada disso.
interface CgDB extends DBSchema {
  snapshot: { key: string; value: AdminSnapshot };
  fila: { key: string; value: ItemFila; indexes: { por_usuario: string } };
}

let dbPromise: Promise<IDBPDatabase<CgDB>> | null = null;

// Falha ao abrir ou conexão encerrada pelo navegador: esquece a promessa para tentar de novo
// na próxima chamada (sem isto, tudo falharia até recarregar a página).
export function abrirDB() {
  dbPromise ??= openDB<CgDB>("cgstudio-admin", 1, {
    upgrade(db) {
      db.createObjectStore("snapshot");
      db.createObjectStore("fila", { keyPath: "id" }).createIndex("por_usuario", "user_id");
    },
    terminated() {
      dbPromise = null;
    },
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

export async function filaDoUsuario(userId: string) {
  const db = await abrirDB();
  const itens = await db.getAllFromIndex("fila", "por_usuario", userId);
  return itens.sort((a, b) => a.criado_em.localeCompare(b.criado_em));
}

export async function contarFila(userId?: string) {
  const db = await abrirDB();
  return userId ? db.countFromIndex("fila", "por_usuario", userId) : db.count("fila");
}

// Logout: apaga o que é do usuário (snapshot e fila).
export async function limparUsuario(userId: string) {
  const db = await abrirDB();
  const tx = db.transaction(["snapshot", "fila"], "readwrite");
  await tx.objectStore("snapshot").delete(userId);
  for (const key of await tx.objectStore("fila").index("por_usuario").getAllKeys(userId)) {
    await tx.objectStore("fila").delete(key);
  }
  await tx.done;
}
