import type { PilotSession, Workspace } from './types';

const DATABASE = 'jadiasn-skd-studio-v2';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('workspaces', { keyPath: 'id' }); request.result.createObjectStore('pilots', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Penyimpanan browser tidak tersedia. Unduh cadangan JSON untuk menyimpan pekerjaan.'));
    request.onblocked = () => reject(new Error('Tutup tab SKD Studio lain agar penyimpanan dapat diperbarui.'));
  });
}
async function transaction<T>(store: 'workspaces' | 'pilots', mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode), request = action(tx.objectStore(store));
    let value: T;
    request.onsuccess = () => { value = request.result; };
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Gagal menyimpan data. Ruang penyimpanan mungkin penuh; unduh cadangan JSON.')); };
  });
}
let queue: Promise<unknown> = Promise.resolve();
export async function saveWorkspace(workspace: Workspace) {
  const run = queue.catch(() => undefined).then(() => transaction('workspaces', 'readwrite', (store) => store.put(workspace)));
  queue = run; await run;
}
export const listWorkspaces = () => transaction<Workspace[]>('workspaces', 'readonly', (store) => store.getAll()).then((rows) => rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
export const getWorkspace = (id: string) => transaction<Workspace | undefined>('workspaces', 'readonly', (store) => store.get(id));
export const deleteWorkspace = async (id: string) => {
  await queue.catch(() => undefined);
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['workspaces', 'pilots'], 'readwrite');
    tx.objectStore('workspaces').delete(id);
    const request = tx.objectStore('pilots').getAll();
    request.onsuccess = () => (request.result as PilotSession[]).filter((s) => s.workspaceId === id).forEach((s) => tx.objectStore('pilots').delete(s.id));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Penghapusan paket belum berhasil.')); };
  });
};
export const savePilot = (session: PilotSession) => transaction('pilots', 'readwrite', (store) => store.put(session));
export const listPilots = () => transaction<PilotSession[]>('pilots', 'readonly', (store) => store.getAll());
