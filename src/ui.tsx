// Fælles: ikoner, navigation og små hjælpere til skærmene.
import { useEffect, useState, type ReactNode } from 'react';
import { dayOf, onChange, type Find } from './lib/db';

/** Den aktuelle side ud fra #/… */
export function useRoute(): string[] {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [r, setR] = useState(read);
  useEffect(() => {
    const h = () => { setR(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return r;
}

export const go = (path: string) => { location.hash = path; };

/** Henter data igen, hver gang noget i lageret ændres. */
export function useData<T>(load: () => Promise<T>, deps: unknown[]): T | undefined {
  const [v, setV] = useState<T>();
  useEffect(() => {
    let alive = true;
    const run = () => load().then((x) => { if (alive) setV(x); });
    run();
    const off = onChange(run);
    return () => { alive = false; off(); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

// Streg-ikoner (24×24)
const paths: Record<string, ReactNode> = {
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  image: <><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M20 16l-5-5-8 8" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  speaker: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  back: <path d="M15 5l-7 7 7 7" />,
  route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" /></>,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /></>,
  trash: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  days: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  more: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  send: <path d="M4 12l16-8-6 16-2-6z" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  locate: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  up: <path d="M12 20V4M5 11l7-7 7 7" />,
  retur: <><path d="M9 5L4 10l5 5" /><path d="M4 10h10a6 6 0 0 1 0 12h-3" /></>,
  light: <><path d="M8 3h8l-1 6H9z" /><path d="M9 9v10a3 3 0 0 0 6 0V9M12 13v2" /></>,
  pin: <><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>,
};

export function Icon({ name, size = 22 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function TabBar({ active }: { active: string }) {
  const tabs = [
    { id: '', label: 'Kik', icon: 'eye' },
    { id: 'dage', label: 'Dage', icon: 'days' },
    { id: 'mere', label: 'Mere', icon: 'more' },
  ];
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <a key={t.id} href={`#/${t.id}`} className={active === t.id ? 'on' : ''}>
          <span className="pill"><Icon name={t.icon} /></span>
          {t.label}
        </a>
      ))}
    </nav>
  );
}

export function time(ms: number): string {
  return new Date(ms).toLocaleTimeString('da-DK', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit' });
}

/** "Lørdag 1. november" */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  const s = d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
  return s[0].toUpperCase() + s.slice(1);
}

/** "I dag · Tisvilde Strand" eller "14. oktober · 16.42" */
export function findMeta(f: Find): string {
  const d = f.day === dayOf(Date.now()) ? 'I dag' : new Date(`${f.day}T12:00:00`).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });
  return `${d} · ${f.answer?.hvor || time(f.createdAt)}`;
}

/** Ét fund i en liste. */
export function FindRow({ f, meta }: { f: Find; meta?: string }) {
  return (
    <a className="row" href={`#/fund/${f.id}`}>
      {f.thumb ? <img className="thumb" src={f.thumb} alt="" /> : <span className="thumb q"><Icon name="mic" /></span>}
      <span className="grow">
        <b>{f.answer?.navn ?? f.question ?? (f.busy ? 'Kigger …' : 'Uden svar')}</b>
        <span>{meta ?? findMeta(f)}</span>
      </span>
    </a>
  );
}
