// Find retur: et spor, der husker vejen, mens Kik er åben, så man kan gå samme vej tilbage.
// Browseren må ikke måle med slukket skærm, så skærmen holdes tændt (Wake Lock), mens sporet kører.
// Huller (fx hvis skærmen alligevel slukkes) bliver bare til lige streger, og vejen til start virker altid.
import { km, type Place } from './device';
import { t } from './i18n';
import { errText, log } from './log';

export type Pt = [lat: number, lon: number, t: number];
export interface Track { startedAt: number; pts: Pt[] } // pts[0] er start

const KEY = 'kik.track';
const MIN_STEP_M = 8; // gem et nyt punkt, når man har flyttet sig mindst så langt
const MAX_ACC_M = 40; // spring upræcise målinger over
const WALK_KMH = 4; // gåtempo på strand og sti

let track: Track | null = load();
let here: Place | null = null;
let watchId: number | null = null;
let viewers = 0; // kortet er åbent: følg stedet, også uden spor
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

// Til loggen: målinger siden sidste opsummering, og hvornår den sidste kom
const stat = { fixes: 0, kept: 0, inexact: 0, bestAcc: Infinity, worstAcc: 0, lastFix: 0 };
const SUMMARY_EVERY = 30; // en linje pr. 30 målinger

function onPos(p: GeolocationPosition) {
  here = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
  const nowMs = Date.now();
  // Hul i målingerne (skærmen slukket, appen skjult, ingen GPS)
  if (stat.lastFix && nowMs - stat.lastFix > 30_000) log(`spor: ingen målinger i ${Math.round((nowMs - stat.lastFix) / 1000)} s${document.hidden ? ' (appen er skjult)' : ''}`, 'warn');
  stat.lastFix = nowMs;
  stat.fixes++;
  stat.bestAcc = Math.min(stat.bestAcc, here.acc);
  stat.worstAcc = Math.max(stat.worstAcc, here.acc);
  if (track && here.acc <= MAX_ACC_M) {
    const last = track.pts.at(-1);
    if (!last || km({ lat: last[0], lon: last[1] }, here) * 1000 >= MIN_STEP_M) {
      track.pts.push([here.lat, here.lon, nowMs]);
      stat.kept++;
      save();
    }
  } else if (track) stat.inexact++;
  if (stat.fixes >= SUMMARY_EVERY) summary();
  changed();
}

function summary() {
  if (!stat.fixes) return;
  log(`spor: ${stat.fixes} målinger (±${Math.round(stat.bestAcc)}–${Math.round(stat.worstAcc)} m), ${stat.kept} gemt, ${stat.inexact} for upræcise${track ? ` · i alt ${track.pts.length} punkter, ${trackKm(track).toFixed(2)} km` : ''}`);
  Object.assign(stat, { fixes: 0, kept: 0, inexact: 0, bestAcc: Infinity, worstAcc: 0 });
}

async function keepAwake() {
  const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
  if (!wl) log('skærm: telefonen kan ikke holde skærmen tændt (ingen Wake Lock)', 'warn');
  if (!wl || lock || document.hidden) return;
  try {
    lock = await wl.request('screen');
    log('skærm: holdes tændt', 'ok');
    (lock as unknown as EventTarget).addEventListener?.('release', () => { lock = null; if (track) log('skærm: må slukke igen (appen skjult eller låst)'); });
  } catch (e) { lock = null; log(`skærm: kunne ikke holdes tændt · ${errText(e)}`, 'warn'); }
}

// Skærmlåsen slippes, når appen skjules; tag den igen, når man kommer tilbage
document.addEventListener('visibilitychange', () => {
  if (track && document.hidden) summary();
  if (track && !document.hidden) void keepAwake();
});

function watch() {
  if (watchId != null || !('geolocation' in navigator)) return;
  log(`sted: følger med (${track ? 'spor' : 'kort'})`);
  watchId = navigator.geolocation.watchPosition(onPos, (e) => log(`sted: fejl ${e.code} under følg (${e.message})`, 'warn'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 30_000 });
}

/** Kører der et spor fra sidst, fortsættes det, når Kik åbnes. */
export function resumeTrack() {
  if (!track) return;
  log(`spor: fortsætter fra ${new Date(track.startedAt).toLocaleTimeString('da-DK')} (${track.pts.length} punkter)`);
  watch();
  void keepAwake();
}

/** Start et spor her (fx ved bilen). */
export function startTrack(): Promise<void> {
  if (!('geolocation' in navigator)) return Promise.reject(new Error(t('Telefonen kan ikke finde sted her.')));
  return new Promise((res, rej) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        log(`spor: startet ved ±${Math.round(p.coords.accuracy)} m`, 'ok');
        track = { startedAt: Date.now(), pts: [[p.coords.latitude, p.coords.longitude, Date.now()]] };
        save();
        onPos(p);
        watch();
        void keepAwake();
        res();
      },
      (e) => { log(`spor: kunne ikke starte, fejl ${e.code} (${e.message})`, 'warn'); rej(new Error(e.code === e.PERMISSION_DENIED ? t('Kik må ikke se, hvor du er. Tillad sted i Chrome.') : t('Kunne ikke finde dig. Prøv igen udenfor.'))); },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 },
    );
  });
}

function unwatch() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

/** Kortet viser, hvor du er, mens det er åbent, også når der ikke kører et spor. */
export function follow(): () => void {
  viewers++;
  watch();
  return () => {
    viewers = Math.max(0, viewers - 1);
    if (!track && !viewers) unwatch();
  };
}

export function stopTrack() {
  summary();
  if (track) log(`spor: stoppet efter ${Math.round((Date.now() - track.startedAt) / 60000)} min, ${track.pts.length} punkter, ${trackKm(track).toFixed(2)} km`, 'ok');
  if (!viewers) unwatch();
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
  let got = 0, raw = 0; // til loggen: målinger med og uden retning
  const h = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
    raw++;
    if (e.webkitCompassHeading != null) { got++; cb(e.webkitCompassHeading); }
    else if (e.absolute && e.alpha != null) { got++; cb((360 - e.alpha) % 360); }
  };
  const ev = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  log(`kompas: lytter (${ev})`);
  const check = setTimeout(() => log(got ? `kompas: virker (${got} retninger på 5 s)` : `kompas: ingen retning på 5 s (${raw} målinger uden nord; pilen følger så kun sporet)`, got ? 'ok' : 'warn'), 5000);
  window.addEventListener(ev, h as EventListener);
  return () => { clearTimeout(check); window.removeEventListener(ev, h as EventListener); };
}
