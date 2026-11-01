// Kik: peg på noget, og spørg.
import { useEffect, useRef, useState } from 'react';
import { MODES } from '../lib/ai';
import { newPhoto, newQuestion } from '../lib/actions';
import { dayFinds, dayOf, type Mode } from '../lib/db';
import { canListen, listen } from '../lib/device';
import { getApiKey } from '../lib/settings';
import { getTrack, onTrack, stopTrack, trackKm } from '../lib/track';
import { Icon, go, time, useData } from '../ui';

const MODE_KEY = 'kik.mode';

export function Home() {
  const [mode, setMode] = useState<Mode>(() => {
    try { return (localStorage.getItem(MODE_KEY) as Mode) || 'hvad'; } catch { return 'hvad'; }
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [listening, setListening] = useState(false);
  const cam = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [todayId] = useState(() => dayOf(Date.now()));
  const today = useData(() => dayFinds(todayId), [todayId]);
  const hasKey = !!getApiKey();

  const pick = (m: Mode) => {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* ingen lagring */ }
  };

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const id = await newPhoto(file, mode);
      go(`/fund/${id}`);
    } catch {
      setErr('Billedet kunne ikke læses. Prøv igen.');
    } finally {
      setBusy(false);
    }
  }

  async function ask(text: string) {
    if (!text.trim()) return;
    setBusy(true);
    const id = await newQuestion(text);
    setBusy(false);
    go(`/fund/${id}`);
  }

  function talk() {
    setListening(true);
    let said = '';
    listen((t) => { said = t; setQ(t); }, (e) => {
      setListening(false);
      if (e) setErr(e);
      else if (said) void ask(said);
    });
  }

  return (
    <main className="page">
      <header className="top">
        <h1>Kik</h1>
      </header>
      <p className="sub">Peg på noget, og spørg.</p>

      {!hasKey && (
        <a className="card notice" href="#/mere">
          <b>Tilføj din Claude-nøgle</b>
          <span>Kik bruger din egen nøgle. Tryk her.</span>
        </a>
      )}

      <TrackCard />

      <div className="chips" role="radiogroup" aria-label="Hvad vil du vide?">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button key={m} role="radio" aria-checked={mode === m} className={`chip ${mode === m ? 'on' : ''}`} onClick={() => pick(m)}>
            {MODES[m].label}
          </button>
        ))}
      </div>

      <button className="shoot" onClick={() => cam.current?.click()} disabled={busy} aria-label="Tag billede">
        <Icon name="camera" size={44} />
        <span>{busy ? 'Øjeblik …' : 'Tag billede'}</span>
      </button>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="center">
        <button className="btn text" onClick={() => gallery.current?.click()} disabled={busy}><Icon name="image" /> Vælg et billede</button>
      </div>

      <form className="askbar" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
        {canListen() && (
          <button type="button" className={`round ${listening ? 'live' : ''}`} onClick={talk} disabled={busy || listening} aria-label="Spørg med stemmen">
            <Icon name="mic" />
          </button>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={listening ? 'Jeg lytter …' : '… eller spørg om stedet'} enterKeyHint="send" />
        {q.trim() && <button className="round filled" aria-label="Send"><Icon name="send" /></button>}
      </form>
      {err && <p className="error">{err}</p>}

      {!!today?.length && (
        <>
          <a className="sec-link" href={`#/dag/${todayId}`}>I dag · {today.length} ting ›</a>
          {[...today].reverse().slice(0, 3).map((f) => (
            <a key={f.id} className="row" href={`#/fund/${f.id}`}>
              {f.thumb ? <img className="thumb" src={f.thumb} alt="" /> : <span className="thumb q"><Icon name="mic" /></span>}
              <span className="grow">
                <b>{f.answer?.navn ?? f.question ?? (f.busy ? 'Kigger …' : 'Uden svar')}</b>
                <span>{f.answer?.kategori ?? 'Spørgsmål'} · {time(f.createdAt)}</span>
              </span>
            </a>
          ))}
        </>
      )}
    </main>
  );
}

/** Kort og spor: en knap, eller et kort, mens sporet kører. */
function TrackCard() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const off = onTrack(() => setNow(Date.now()));
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => { off(); clearInterval(t); };
  }, []);
  const t = getTrack();

  if (!t) {
    return <div className="center"><a className="btn tonal" href="#/kort"><Icon name="map" /> Kort</a></div>;
  }
  const min = Math.max(0, Math.round((now - t.startedAt) / 60_000));
  const dur = min < 60 ? `${min} min` : `${Math.floor(min / 60)} t ${min % 60} min`;
  const d = trackKm(t);
  return (
    <section className="card track">
      <div className="live-label"><span className="rec" /> Spor kører</div>
      <div className="big">{d < 1 ? `${Math.round(d * 1000)} m` : `${d.toLocaleString('da-DK', { maximumFractionDigits: 1 })} km`} · {dur}</div>
      <div className="small">Startede kl. {time(t.startedAt)}</div>
      <div className="actions">
        <a className="btn on-pri" href="#/kort"><Icon name="map" /> Kort</a>
        <button className="btn ghost" onClick={() => { if (confirm('Stop sporet? Vejen tilbage glemmes.')) stopTrack(); }}>Stop</button>
      </div>
    </section>
  );
}
