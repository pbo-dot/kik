// Find retur: et spor, der husker vejen, mens Kik er åben, så man kan gå samme vej tilbage.
// Browseren må ikke måle med slukket skærm, så skærmen holdes tændt (Wake Lock), mens sporet kører.
// Huller (fx hvis skærmen alligevel slukkes) bliver bare til lige streger, og vejen til start virker altid.
import { km, type Place } from './device';

export type Pt = [lat: number, lon: number, t: number];
export interface Track { startedAt: number; pts: Pt[] } // pts[0] er start

const KEY = 'kik.track';
const MIN_STEP_M = 8; // gem et nyt punkt, når man har flyttet sig mindst så langt
const MAX_ACC_M = 40; // spring upræcise målinger over
const WALK_KMH = 4; // gåtempo på strand og sti

let track: Track | null = load();
let here: Place | null = null;
let watchId: number | null = null;
let lock: { release(): Promise<void> } | null = null;
const listeners = new Set<() => void>();

function load(): Track | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Track | null; } catch { return null; }
}
function save() {
  try {
    if (track) localStorage.setItem(KEY, JSON.stringify(track));
    else localStorage.removeItem(KEY);
  } catch { /* fuld lagring: sporet lever videre i hukommelsen */ }
}
const changed = () => listeners.forEach((l) => l());

export function onTrack(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export const getTrack = () => track;
export const getHere = () => here;

function onPos(p: GeolocationPosition) {
  here = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
  if (track && here.acc <= MAX_ACC_M) {
    const last = track.pts.at(-1);
    if (!last || km({ lat: last[0], lon: last[1] }, here) * 1000 >= MIN_STEP_M) {
      track.pts.push([here.lat, here.lon, Date.now()]);
      save();
    }
  }
  changed();
}

async function keepAwake() {
  const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
  if (!wl || lock || document.hidden) return;
  try {
    lock = await wl.request('screen');
    (lock as unknown as EventTarget).addEventListener?.('release', () => { lock = null; });
  } catch { lock = null; }
}

// Skærmlåsen slippes, når appen skjules; tag den igen, når man kommer tilbage
document.addEventListener('visibilitychange', () => {
  if (track && !document.hidden) void keepAwake();
});

function watch() {
  if (watchId != null || !('geolocation' in navigator)) return;
  watchId = navigator.geolocation.watchPosition(onPos, () => undefined, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30_000 });
}

/** Kører der et spor fra sidst, fortsættes det, når Kik åbnes. */
export function resumeTrack() {
  if (!track) return;
  watch();
  void keepAwake();
}

/** Start et spor her (fx ved bilen). */
export function startTrack(): Promise<void> {
  if (!('geolocation' in navigator)) return Promise.reject(new Error('Telefonen kan ikke finde sted her.'));
  return new Promise((res, rej) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        track = { startedAt: Date.now(), pts: [[p.coords.latitude, p.coords.longitude, Date.now()]] };
        save();
        onPos(p);
        watch();
        void keepAwake();
        res();
      },
      (e) => rej(new Error(e.code === e.PERMISSION_DENIED ? 'Kik må ikke se, hvor du er. Tillad sted i Chrome.' : 'Kunne ikke finde dig. Prøv igen udenfor.')),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 },
    );
  });
}

export function stopTrack() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  void lock?.release().catch(() => undefined);
  lock = null;
  track = null;
  save();
  changed();
}

// ---------- Udregninger ----------

const ll = (p: Pt) => ({ lat: p[0], lon: p[1] });

/** Gået i alt, km. */
export function trackKm(t: Track): number {
  let d = 0;
  for (let i = 1; i < t.pts.length; i++) d += km(ll(t.pts[i - 1]), ll(t.pts[i]));
  return d;
}

/** Kurs i grader (0 = nord) fra a til b. */
export function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(b.lon - a.lon)) * Math.cos(r(b.lat));
  const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const WORDS = ['nord', 'nordøst', 'øst', 'sydøst', 'syd', 'sydvest', 'vest', 'nordvest'];
export const directionWord = (deg: number) => WORDS[Math.round(deg / 45) % 8];

/** Vejen tilbage ad sporet: hvor langt der er til start, og hvilket punkt man skal gå mod nu. */
export function wayBack(t: Track, me: { lat: number; lon: number }): { km: number; minutes: number; target: { lat: number; lon: number }; direct: number } {
  const pts = t.pts.map(ll);
  // nærmeste punkt på sporet
  let near = 0, best = Infinity;
  pts.forEach((p, i) => { const d = km(me, p); if (d < best) { best = d; near = i; } });
  // gå baglæns langs sporet: resten af vejen, og et punkt ca. 40 m fremme at sigte mod
  let rest = 0, target = pts[0], ahead = 0, found = false;
  for (let i = near; i > 0; i--) {
    const step = km(pts[i], pts[i - 1]);
    rest += step;
    if (!found) { ahead += step; if (ahead >= 0.04) { target = pts[i - 1]; found = true; } }
  }
  const total = best + rest;
  return { km: total, minutes: Math.max(1, Math.round((total / WALK_KMH) * 60)), target: best > 0.04 ? pts[near] : target, direct: km(me, pts[0]) };
}

// ---------- Kompas ----------

/** Hvilken vej telefonen peger (grader, 0 = nord), hvis telefonen har kompas. */
export function onHeading(cb: (deg: number) => void): () => void {
  const h = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
    if (e.webkitCompassHeading != null) cb(e.webkitCompassHeading);
    else if (e.absolute && e.alpha != null) cb((360 - e.alpha) % 360);
  };
  const ev = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(ev, h as EventListener);
  return () => window.removeEventListener(ev, h as EventListener);
}
