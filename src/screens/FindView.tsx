// Svaret på ét billede eller spørgsmål.
import { useEffect, useRef, useState } from 'react';
import { MODES } from '../lib/ai';
import { runAsk, runIdentify, runMore } from '../lib/actions';
import { allFinds, deleteFind, getFind, getPhoto, type Find } from '../lib/db';
import { baseName, seenBefore } from '../lib/seen';
import { canListen, canSpeak, listen, speak, stopSpeaking } from '../lib/device';
import { getSettings, krText } from '../lib/settings';
import { FindRow, Icon, go, time, useData } from '../ui';

function spoken(f: Find): string {
  const parts: string[] = [];
  if (f.answer) parts.push(`${f.answer.navn}. ${f.answer.svar}`);
  if (f.more) parts.push(f.more.text);
  const last = f.chat.at(-1);
  if (last?.role === 'assistant') parts.splice(0, parts.length, last.text);
  return parts.join(' ');
}

/** Fjerner markdown-tegn, så teksten kan vises og læses op pænt. */
const plain = (s: string) => s.replace(/\*\*|__|^#+\s*/gm, '');

export function FindView({ id }: { id: string }) {
  const f = useData(() => getFind(id).then((x) => x ?? null), [id]);
  const photo = useData(() => getPhoto(id), [id]);
  const all = useData(allFinds, []);
  const [talking, setTalking] = useState(false);
  const [q, setQ] = useState('');
  const [listening, setListening] = useState(false);
  const stop = useRef<() => void>(() => {});
  const spokenFor = useRef('');
  const wasBusy = useRef(false);

  useEffect(() => () => stopSpeaking(), []);

  // Læs automatisk op, når et nyt svar kommer (hvis slået til). Gamle fund læses ikke op af sig selv.
  useEffect(() => {
    if (!f) return;
    if (f.busy) { wasBusy.current = true; return; }
    if (!wasBusy.current || !getSettings().autoSpeak || !canSpeak()) return;
    wasBusy.current = false;
    const text = spoken(f);
    if (text && text !== spokenFor.current) {
      spokenFor.current = text;
      setTalking(true);
      stop.current = speak(plain(text), () => setTalking(false));
    }
  }, [f]);

  if (f === undefined) return <main className="page" />;
  if (f === null) return <main className="page"><p>Fundet findes ikke længere.</p><a href="#/">Til Kik</a></main>;

  const toggleSpeak = () => {
    if (talking) { stop.current(); setTalking(false); return; }
    const text = spoken(f);
    if (!text) return;
    spokenFor.current = text;
    setTalking(true);
    stop.current = speak(plain(text), () => setTalking(false));
  };

  function ask(text: string) {
    if (!text.trim()) return;
    setQ('');
    void runAsk(id, text);
  }

  function talk() {
    stopSpeaking();
    setTalking(false);
    setListening(true);
    let said = '';
    listen((t) => { said = t; setQ(t); }, () => {
      setListening(false);
      if (said) ask(said);
    });
  }

  async function remove() {
    if (!confirm('Slet dette fund?')) return;
    await deleteFind(id);
    go('/');
  }

  const a = f.answer;
  const mapUrl = a?.sted
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.navn)}`
    : f.lat != null ? `https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lon}` : null;
  const turns = f.chat;

  return (
    <main className="page">
      <header className="top">
        <button className="round" onClick={() => history.length > 1 ? history.back() : go('/')} aria-label="Tilbage"><Icon name="back" /></button>
        <span className="muted small">{time(f.createdAt)}{f.usd > 0 ? ` · ca. ${krText(f.usd)}` : ''}</span>
        <button className="round" onClick={remove} aria-label="Slet"><Icon name="trash" /></button>
      </header>

      {f.hasPhoto && (photo ? <img className="photo" src={`data:${photo.mime};base64,${photo.data}`} alt="" /> : <div className="photo" />)}

      {f.busy === 'kigger' && (
        <div className="card answer loading"><span className="dot-pulse" /> Kigger …</div>
      )}

      {a && (
        <article className="card answer">
          <div className="kicker">{a.kategori}{f.mode !== 'hvad' ? ` · ${MODES[f.mode].label}` : ''}</div>
          <h2>{a.navn}</h2>
          <p className="pre">{plain(a.svar)}</p>
          {!a.sikker && a.bedOm && (
            <p className="hint">Ikke helt sikker. {a.bedOm}</p>
          )}
        </article>
      )}

      {a && <SeenBefore f={f} all={all ?? []} />}

      {f.question && <div className="bubble me">{f.question}</div>}

      {f.more && (
        <article className="card answer">
          <div className="kicker">Mere</div>
          <p className="pre">{plain(f.more.text)}</p>
          {!!f.more.links.length && (
            <div className="links">
              {f.more.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.title || new URL(l.url).hostname}</a>)}
            </div>
          )}
        </article>
      )}
      {f.busy === 'mere' && <div className="card answer loading"><span className="dot-pulse" /> Slår op …</div>}

      {turns.slice(f.question ? 1 : 0).map((t, i) => (
        <div key={i} className={`bubble ${t.role === 'user' ? 'me' : 'it'}`}>{plain(t.text)}</div>
      ))}
      {f.busy === 'svarer' && <div className="bubble it loading"><span className="dot-pulse" /> Tænker …</div>}

      {f.error && (
        <div className="card error-card">
          <span className="grow">{f.error}</span>
          {!a && f.hasPhoto && <button className="btn tonal small" onClick={() => void runIdentify(id)}><Icon name="refresh" /> Prøv igen</button>}
          {f.question && !f.chat.length && <button className="btn tonal small" onClick={() => void runAsk(id, f.question!)}><Icon name="refresh" /> Prøv igen</button>}
        </div>
      )}

      {!f.busy && (a || f.chat.length > 0) && (
        <div className="actions">
          {canSpeak() && (
            <button className="btn filled" onClick={toggleSpeak}><Icon name={talking ? 'stop' : 'speaker'} /> {talking ? 'Stop' : 'Læs op'}</button>
          )}
          {a && !f.more && <button className="btn tonal" onClick={() => void runMore(id)}><Icon name="spark" /> Fortæl mere</button>}
          {mapUrl && <a className="btn tonal" href={mapUrl} target="_blank" rel="noreferrer"><Icon name="route" /> Vis vej</a>}
        </div>
      )}

      {!f.busy && (a || f.chat.length > 0) && (
        <form className="askbar" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          {canListen() && (
            <button type="button" className={`round ${listening ? 'live' : ''}`} onClick={talk} disabled={listening} aria-label="Spørg med stemmen">
              <Icon name="mic" />
            </button>
          )}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={listening ? 'Jeg lytter …' : 'Spørg videre …'} enterKeyHint="send" />
          {q.trim() && <button className="round filled" aria-label="Send"><Icon name="send" /></button>}
        </form>
      )}
    </main>
  );
}

/** "Set før · 7 gange" med de to seneste og et link til resten. */
function SeenBefore({ f, all }: { f: Find; all: Find[] }) {
  const seen = seenBefore(f, all);
  if (!seen.length) return null;
  return (
    <section className="card answer seen">
      <div className="kicker">Set før · {seen.length} {seen.length === 1 ? 'gang' : 'gange'}</div>
      {seen.slice(0, 2).map((g) => <FindRow key={g.id} f={g} />)}
      {seen.length > 2 && (
        <div className="center"><a className="btn text small" href={`#/soeg/${encodeURIComponent(baseName(f.answer!.navn))}`}>Se alle {seen.length} ›</a></div>
      )}
    </section>
  );
}
