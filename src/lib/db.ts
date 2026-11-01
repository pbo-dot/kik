// Lager på telefonen (IndexedDB): ét "fund" pr. billede eller spørgsmål.
// Billederne ligger for sig, så listerne kan hentes hurtigt uden dem.

export type Mode = 'hvad' | 'oversaet' | 'pris' | 'hvordan';

export interface ChatTurn { role: 'user' | 'assistant'; text: string }
export interface Link { url: string; title: string }

export interface Answer {
  kategori: string;
  navn: string;
  svar: string;
  sikker: boolean;
  bedOm: string;
  sted: boolean;
  hvor?: string; // kort stednavn, fx "Tisvilde Strand" (mangler i de første fund)
}

export interface Find {
  id: string;
  createdAt: number;
  day: string; // ÅÅÅÅ-MM-DD (dansk tid)
  mode: Mode;
  hasPhoto: boolean;
  thumb?: string; // lille JPEG (data-url) til lister
  lat?: number;
  lon?: number;
  question?: string; // spørgsmål uden billede
  answer?: Answer;
  more?: { text: string; links: Link[] };
  chat: ChatTurn[];
  usd: number;
  busy?: 'kigger' | 'mere' | 'svarer';
  error?: string;
}

export interface Photo { id: string; data: string; mime: string } // base64 uden "data:"-start

const DB = 'kik';
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('finds', { keyPath: 'id' }).createIndex('day', 'day');
      db.createObjectStore('photos', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

function req<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then((db) => new Promise<T>((res, rej) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => res(r.result as T);
    t.onerror = () => rej(t.error);
  }));
}

// ---- Besked til skærmene, når noget ændres ----
type Listener = () => void;
const listeners = new Set<Listener>();
export function onChange(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
const changed = () => listeners.forEach((l) => l());

export async function putFind(f: Find): Promise<void> {
  await req('finds', 'readwrite', (s) => s.put(f));
  changed();
}
export const getFind = (id: string) => req<Find | undefined>('finds', 'readonly', (s) => s.get(id));
export const allFinds = () => req<Find[]>('finds', 'readonly', (s) => s.getAll()).then((l) => l.sort((a, b) => a.createdAt - b.createdAt));
export const dayFinds = (day: string) => req<Find[]>('finds', 'readonly', (s) => s.index('day').getAll(day)).then((l) => l.sort((a, b) => a.createdAt - b.createdAt));

export async function deleteFind(id: string): Promise<void> {
  await req('finds', 'readwrite', (s) => s.delete(id));
  await req('photos', 'readwrite', (s) => s.delete(id));
  changed();
}

export async function deleteAll(): Promise<void> {
  await req('finds', 'readwrite', (s) => s.clear());
  await req('photos', 'readwrite', (s) => s.clear());
  changed();
}

export const putPhoto = (p: Photo) => req('photos', 'readwrite', (s) => s.put(p));
export const getPhoto = (id: string) => req<Photo | undefined>('photos', 'readonly', (s) => s.get(id));

/** Dagens dato i dansk tid, fx "2026-11-01". */
export function dayOf(ms: number): string {
  return new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
}
