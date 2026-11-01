// Dage: alt, du har kigget på, samlet pr. dag, med rute og "Del → Dagbog".
import { useState } from 'react';
import { writeDay, AIError } from '../lib/ai';
import { allFinds, dayFinds, type Find } from '../lib/db';
import { km } from '../lib/device';
import { searchFinds } from '../lib/seen';
import { krText } from '../lib/settings';
import { FindRow, Icon, dayLabel, time, useData } from '../ui';

export function Days({ q: start = '' }: { q?: string }) {
  const finds = useData(allFinds, []);
  const [q, setQ] = useState(start);
  const hits = q.trim() ? searchFinds(finds ?? [], q) : null;
  const days = new Map<string, Find[]>();
  for (const f of finds ?? []) days.set(f.day, [...(days.get(f.day) ?? []), f]);
  const list = [...days].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  return (
    <main className="page">
      <header className="top"><h1>Dage</h1></header>
      {!!finds?.length && (
        <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); }}>
          <Icon name="search" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søg i dine fund" aria-label="Søg i dine fund" enterKeyHint="search" />
          {q && <button type="button" className="round clear" onClick={() => setQ('')} aria-label="Ryd"><Icon name="close" /></button>}
        </form>
      )}
      {finds && !list.length && <p className="sub">Når du har kigget på noget, samles det her.</p>}
      {hits && (
        <>
          <div className="sec">{hits.length ? `${hits.length} fund` : 'Ingen fund'}</div>
          {hits.map((f) => <FindRow key={f.id} f={f} />)}
        </>
      )}
      {!hits && list.map(([day, fs]) => (
        <a key={day} className="row" href={`#/dag/${day}`}>
          <span className="stack">
            {fs.filter((f) => f.thumb).slice(0, 3).map((f) => <img key={f.id} className="thumb" src={f.thumb} alt="" />)}
          </span>
          <span className="grow">
            <b>{dayLabel(day)}</b>
            <span>{fs.length} ting · {fs.map((f) => f.answer?.navn).filter(Boolean).slice(0, 3).join(', ')}</span>
          </span>
        </a>
      ))}
    </main>
  );
}

/** Ruten tegnet som prikker (ingen kortbaggrund). */
function Route({ finds }: { finds: Find[] }) {
  const pts = finds.filter((f) => f.lat != null && f.lon != null) as Array<Find & { lat: number; lon: number }>;
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += km(pts[i - 1], pts[i]);
  if (pts.length < 2 || len < 0.05) return null; // stod du stille, er der ingen rute at vise
  const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = lons.map((l) => l * kx);
  const w = Math.max(...xs) - Math.min(...xs) || 1e-6, h = Math.max(...lats) - Math.min(...lats) || 1e-6;
  const W = 340, H = 140, pad = 16;
  const s = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h);
  const ox = (W - w * s) / 2, oy = (H - h * s) / 2;
  const P = pts.map((p, i) => [ox + (xs[i] - Math.min(...xs)) * s, H - (oy + (p.lat - Math.min(...lats)) * s)]);
  return (
    <svg className="route card" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Dagens rute">
      <polyline points={P.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--pri)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 10" />
      {P.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === 0 || i === P.length - 1 ? 8 : 6} fill="var(--pri)" />)}
    </svg>
  );
}

function plainList(finds: Find[], label: string): string {
  const lines = finds.map((f) => `• ${time(f.createdAt)} ${f.answer ? `${f.answer.navn} (${f.answer.kategori.toLowerCase()})` : f.question ?? ''}`);
  return `${label} – det så jeg med Kik:\n${lines.join('\n')}`;
}

async function share(text: string): Promise<string> {
  if (navigator.share) {
    try { await navigator.share({ text }); return ''; } catch (e) { if ((e as Error).name === 'AbortError') return ''; }
  }
  try { await navigator.clipboard.writeText(text); return 'Kopieret. Sæt den ind i Dagbog.'; } catch { return 'Kunne ikke dele.'; }
}

export function Day({ day }: { day: string }) {
  const finds = useData(() => dayFinds(day), [day]);
  const [story, setStory] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!finds) return <main className="page" />;
  const label = dayLabel(day);
  const pts = finds.filter((f) => f.lat != null) as Array<Find & { lat: number; lon: number }>;
  let dist = 0;
  for (let i = 1; i < pts.length; i++) dist += km(pts[i - 1], pts[i]);

  async function write() {
    setBusy(true);
    setMsg('');
    try {
      const { text, usd } = await writeDay(finds!, label);
      setStory(text);
      setMsg(`ca. ${krText(usd)}`);
    } catch (e) {
      setMsg(e instanceof AIError ? e.message : 'Noget gik galt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header className="top">
        <button className="round" onClick={() => history.back()} aria-label="Tilbage"><Icon name="back" /></button>
        <h1 className="h-small grow">{label}</h1>
      </header>
      <Route finds={finds} />
      <div className="sec">{finds.length} ting{dist >= 0.1 ? ` · ${dist.toLocaleString('da-DK', { maximumFractionDigits: 1 })} km` : ''}</div>
      {finds.map((f) => (
        <a key={f.id} className="row" href={`#/fund/${f.id}`}>
          {f.thumb ? <img className="thumb" src={f.thumb} alt="" /> : <span className="thumb q"><Icon name="mic" /></span>}
          <span className="grow">
            <b>{f.answer?.navn ?? f.question ?? 'Uden svar'}</b>
            <span>{f.answer?.kategori ?? 'Spørgsmål'} · {time(f.createdAt)}</span>
          </span>
        </a>
      ))}
      {story && <article className="card answer"><div className="kicker">Dagen</div><p className="pre">{story}</p></article>}
      {!!finds.length && (
        <div className="actions">
          <button className="btn filled" onClick={async () => setMsg(await share(story || plainList(finds, label)))}><Icon name="share" /> Del → Dagbog</button>
          {!story && <button className="btn tonal" onClick={write} disabled={busy}><Icon name="spark" /> {busy ? 'Skriver …' : 'Skriv dagen'}</button>}
        </div>
      )}
      {msg && <p className="muted small center">{msg}</p>}
    </main>
  );
}
