// Telefonens funktioner: billede, sted, tale og oplæsning.
import { speechLang, t } from './i18n';
import { errText, log } from './log';

/** Gør billedet mindre (lang side højst `max` px) og giver base64 JPEG uden "data:"-start. */
export async function shrink(file: Blob, max: number, quality = 0.82): Promise<string> {
  const t0 = performance.now();
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch((e) => {
    log(`billede: kunne ikke læses (${file.type || 'ukendt type'}, ${Math.round(file.size / 1024)} KB) · ${errText(e)}`, 'fejl');
    throw e;
  });
  const orig = `${bmp.width}×${bmp.height}`;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Kunne ikke læse billedet');
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const data = c.toDataURL('image/jpeg', quality).split(',')[1];
  log(`billede: ${orig} → ${c.width}×${c.height}, ${Math.round(data.length * 0.75 / 1024)} KB på ${Math.round(performance.now() - t0)} ms`);
  return data;
}

export interface Place { lat: number; lon: number; acc: number }

/** Hvor er telefonen? null, hvis det ikke er tilladt eller tager for lang tid. */
const GEO_ERR: Record<number, string> = { 1: 'ikke tilladt', 2: 'ikke tilgængeligt', 3: 'tog for lang tid' };

export function where(timeoutMs = 8000): Promise<Place | null> {
  if (!('geolocation' in navigator)) { log('sted: telefonen har ingen geolocation', 'warn'); return Promise.resolve(null); }
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  return new Promise((res) => {
    const t = setTimeout(() => { log(`sted: intet svar efter ${ms()} ms`, 'warn'); res(null); }, timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(t);
        log(`sted: ±${Math.round(p.coords.accuracy)} m på ${ms()} ms${Date.now() - p.timestamp > 5000 ? ` (gemt måling, ${Math.round((Date.now() - p.timestamp) / 1000)} s gammel)` : ''}`, 'ok');
        res({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy });
      },
      (e) => { clearTimeout(t); log(`sted: fejl ${e.code} (${GEO_ERR[e.code] ?? e.message}) efter ${ms()} ms`, 'warn'); res(null); },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/** Afstand i km mellem to punkter. */
export function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// ---------- Oplæsning ----------

export const canSpeak = () => 'speechSynthesis' in window;

/** Læser teksten højt. Giver en stop-funktion. */
export function speak(text: string, onEnd: () => void): () => void {
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = speechLang();
  const voices = synth.getVoices();
  const voice = voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(u.lang.slice(0, 2).toLowerCase()));
  if (voice) u.voice = voice;
  u.rate = 1;
  const t0 = performance.now();
  log(`oplæsning: ${text.length} tegn, ${u.lang}, stemme ${voice ? `${voice.name} (${voice.lang}${voice.localService ? '' : ', net'})` : `ingen ${u.lang}-stemme blandt ${voices.length}`}`, voice ? 'info' : 'warn');
  u.onstart = () => log(`oplæsning: startede efter ${Math.round(performance.now() - t0)} ms`);
  u.onend = () => { log(`oplæsning: færdig efter ${Math.round((performance.now() - t0) / 1000)} s`); onEnd(); };
  u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') log(`oplæsning: fejl ${e.error}`, 'warn'); onEnd(); };
  synth.speak(u);
  return () => synth.cancel();
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

// ---------- Tale til tekst ----------

interface SpeechRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

function SpeechCtor(): (new () => SpeechRec) | undefined {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const canListen = () => !!SpeechCtor();

/** Lytter til én sætning. onText får teksten undervejs; onEnd kaldes, når der er stille. */
export function listen(onText: (text: string) => void, onEnd: (err?: string) => void): () => void {
  const Ctor = SpeechCtor();
  if (!Ctor) {
    onEnd(t('Tale virker ikke i denne browser.'));
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = speechLang();
  rec.continuous = false;
  rec.interimResults = true;
  const t0 = performance.now();
  let heard = '';
  log(`tale: lytter (${rec.lang})`);
  rec.onresult = (e) => {
    let t = '';
    for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
    heard = t.trim();
    onText(heard);
  };
  rec.onerror = (e) => {
    log(`tale: fejl ${e.error} efter ${Math.round(performance.now() - t0)} ms`, e.error === 'no-speech' || e.error === 'aborted' ? 'info' : 'warn');
    onEnd(e.error === 'not-allowed' ? t('Mikrofonen er ikke tilladt.') : undefined);
  };
  rec.onend = () => { log(`tale: slut efter ${Math.round((performance.now() - t0) / 1000)} s, hørte ${heard ? `${heard.split(/\s+/).length} ord` : 'intet'}`); onEnd(); };
  try { rec.start(); } catch (e) { log(`tale: kunne ikke starte · ${errText(e)}`, 'fejl'); onEnd(); }
  return () => rec.stop();
}

// ---------- Lommelygte ----------

let torchStream: MediaStream | null = null;

/** Tænder eller slukker lommelygten (kameraets lys). Giver false, hvis telefonen ikke tillader det. */
export async function torch(on: boolean): Promise<boolean> {
  if (!on) {
    torchStream?.getTracks().forEach((t) => t.stop());
    torchStream = null;
    return true;
  }
  try {
    torchStream ??= await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const t = torchStream.getVideoTracks()[0];
    const caps = (t.getCapabilities?.() ?? {}) as { torch?: boolean };
    if (!caps.torch) throw new Error('kameraet har ingen lygte');
    await t.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] });
    log('lygte: tændt', 'ok');
    return true;
  } catch (e) {
    log(`lygte: kunne ikke tændes · ${errText(e)}`, 'warn');
    torchStream?.getTracks().forEach((t) => t.stop());
    torchStream = null;
    return false;
  }
}
