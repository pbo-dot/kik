// Detaljeret log til fejlfinding på telefonen (ejerens regel: "se før du retter").
// Hvert trin skrives her: Claude-kald, kamera, sted, tale, oplæsning, spor, kompas og deling.
// De seneste MAX linjer gemmes i localStorage (overlever genstart) og deles som én fil med
// "Del log med Claude" under Mere. Nøglen og billederne kommer aldrig med.
import { allFinds } from './db';
import { getApiKey, getSettings } from './settings';

export type Level = 'info' | 'ok' | 'warn' | 'fejl';
export interface LogLine { t: number; l: Level; m: string }

const KEY = 'kik.log';
const MAX = 1500;

let lines: LogLine[] = load();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function load(): LogLine[] {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as LogLine[]).slice(-MAX); } catch { return []; }
}

function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { lines = lines.slice(-MAX / 2); }
}

/** Skriver én linje i loggen. */
export function log(m: string, l: Level = 'info') {
  lines.push({ t: Date.now(), l, m: m.slice(0, 600) });
  if (lines.length > MAX) lines = lines.slice(-MAX);
  saveTimer ??= setTimeout(flush, 800);
  listeners.forEach((f) => f());
}

/** Kort tekst for en fejl (navn og besked, aldrig nøglen). */
export function errText(e: unknown): string {
  const s = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return s.replace(/sk-ant-[\w-]+/g, 'sk-ant-…').slice(0, 400);
}

export const getLog = () => lines;
export function clearLog() { lines = []; flush(); listeners.forEach((f) => f()); }
export function onLog(f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; }

/** Linjen som tekst: "14:03:22.512 ok  Claude …". */
export function lineText(x: LogLine): string {
  const d = new Date(x.t);
  const p2 = (n: number) => String(n).padStart(2, '0');
  const tt = `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  return `${tt} ${x.l.padEnd(4)} ${x.m}`;
}

// Gem, når appen skjules eller lukkes, så de sidste linjer ikke går tabt
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
}

/** Tilladelser, som Chrome kender (sted, mikrofon, kamera). */
async function permissions(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const name of ['geolocation', 'microphone', 'camera']) {
    try { out[name] = (await navigator.permissions.query({ name: name as PermissionName })).state; } catch { out[name] = 'ukendt'; }
  }
  return out;
}

/** Samler loggen og en oversigt (uden nøgle og billeder) i én fil. */
export async function logBundle(): Promise<{ name: string; json: string }> {
  flush();
  const s = getSettings();
  const finds = (await allFinds()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 40).map((f) => ({
    tid: new Date(f.createdAt).toISOString(), mode: f.mode, billede: f.hasPhoto, spg: f.question,
    sted: f.lat != null ? `${f.lat.toFixed(4)},${f.lon?.toFixed(4)}` : null,
    svar: f.answer ? `${f.answer.kategori}: ${f.answer.navn}${f.answer.sikker ? '' : ' (usikker)'}` : null,
    mere: !!f.more, chat: f.chat.length, kr: Math.round(f.usd * 6.9 * 100) / 100, travl: f.busy ?? null, fejl: f.error ?? null,
  }));
  let track: unknown = null;
  try {
    const tr = JSON.parse(localStorage.getItem('kik.track') ?? 'null') as { startedAt: number; pts: [number, number, number][] } | null;
    if (tr) track = { start: new Date(tr.startedAt).toISOString(), punkter: tr.pts.length, sidste: tr.pts.length ? new Date(tr.pts[tr.pts.length - 1][2]).toISOString() : null };
  } catch { /* intet spor */ }
  const voices = 'speechSynthesis' in window ? speechSynthesis.getVoices().map((v) => `${v.lang}${v.localService ? '' : ' (net)'}`) : [];
  const bundle = {
    app: 'kik', kind: 'log', made: new Date().toISOString(), version: __BUILD__,
    phone: navigator.userAgent, screen: `${screen.width}x${screen.height}@${devicePixelRatio}`,
    online: navigator.onLine, installed: matchMedia('(display-mode: standalone)').matches,
    settings: { ...s }, hasKey: !!getApiKey(),
    permissions: await permissions(),
    can: { share: !!navigator.share, wakeLock: 'wakeLock' in navigator, speak: 'speechSynthesis' in window, listen: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window, compass: 'ondeviceorientationabsolute' in window },
    voices: [...new Set(voices)].slice(0, 60),
    track, finds,
    log: lines.map(lineText),
  };
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const name = `kik-log-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.json`;
  return { name, json: JSON.stringify(bundle, null, 1) };
}

/** Del loggen som fil (vælg Drev). Kan telefonen ikke dele filer, hentes den i stedet. Giver "delt", "hentet" eller "afbrudt". */
export async function shareLog(): Promise<'delt' | 'hentet' | 'afbrudt'> {
  const { name, json } = await logBundle();
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      log(`log delt (${lines.length} linjer)`, 'ok');
      return 'delt';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'afbrudt';
      log(`deling af log fejlede: ${errText(e)}`, 'warn');
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'hentet';
}
