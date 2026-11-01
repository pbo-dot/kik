// Telefonens funktioner: billede, sted, tale og oplæsning.

/** Gør billedet mindre (lang side højst `max` px) og giver base64 JPEG uden "data:"-start. */
export async function shrink(file: Blob, max: number, quality = 0.82): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Kunne ikke læse billedet');
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL('image/jpeg', quality).split(',')[1];
}

export interface Place { lat: number; lon: number; acc: number }

/** Hvor er telefonen? null, hvis det ikke er tilladt eller tager for lang tid. */
export function where(timeoutMs = 8000): Promise<Place | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((res) => {
    const t = setTimeout(() => res(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); res({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }); },
      () => { clearTimeout(t); res(null); },
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
  u.lang = 'da-DK';
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('da'));
  if (voice) u.voice = voice;
  u.rate = 1;
  u.onend = onEnd;
  u.onerror = onEnd;
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
    onEnd('Tale virker ikke i denne browser.');
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = 'da-DK';
  rec.continuous = false;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let t = '';
    for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
    onText(t.trim());
  };
  rec.onerror = (e) => onEnd(e.error === 'not-allowed' ? 'Mikrofonen er ikke tilladt.' : undefined);
  rec.onend = () => onEnd();
  rec.start();
  return () => rec.stop();
}
