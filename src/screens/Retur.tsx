// Find retur: kort med dagens spor, hvor du er, og vejen tilbage til start.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { torch } from '../lib/device';
import { bearing, directionWord, getHere, getTrack, onHeading, onTrack, stopTrack, wayBack } from '../lib/track';
import { Icon, go } from '../ui';

function useTrack() {
  const [, tick] = useState(0);
  useEffect(() => onTrack(() => tick((n) => n + 1)), []);
  return { track: getTrack(), here: getHere() };
}

export default function Retur() {
  const { track, here } = useTrack();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<{ m: L.Map; line: L.Polyline; me: L.CircleMarker; fitted: boolean } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [light, setLight] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => onHeading((d) => setHeading(Math.round(d))), []);
  useEffect(() => () => { void torch(false); }, []);

  // Kortet laves én gang
  useEffect(() => {
    const t = getTrack();
    if (!box.current || !t) return;
    const start = t.pts[0];
    const m = L.map(box.current, { zoomControl: false, attributionControl: true }).setView([start[0], start[1]], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap', referrerPolicy: 'strict-origin-when-cross-origin' }).addTo(m);
    m.attributionControl.setPrefix(false);
    const line = L.polyline([], { className: 'trk', weight: 6, lineCap: 'round', dashArray: '1 12' }).addTo(m);
    L.circleMarker([start[0], start[1]], { className: 'start-dot', radius: 11, weight: 3 }).addTo(m)
      .bindTooltip('Start', { permanent: true, direction: 'top', offset: [0, -10], className: 'map-label' });
    const me = L.circleMarker([start[0], start[1]], { className: 'me-dot', radius: 9, weight: 3 }).addTo(m);
    map.current = { m, line, me, fitted: false };
    return () => { m.remove(); map.current = null; };
  }, []);

  // Opdatér spor og prik
  useEffect(() => {
    const k = map.current;
    if (!k || !track) return;
    k.line.setLatLngs(track.pts.map((p) => [p[0], p[1]] as [number, number]));
    if (here) k.me.setLatLng([here.lat, here.lon]);
    if (!k.fitted && here) {
      k.m.fitBounds(L.latLngBounds([...track.pts.map((p) => [p[0], p[1]] as [number, number]), [here.lat, here.lon]]), { padding: [40, 40], maxZoom: 17 });
      k.fitted = true;
    }
  }, [track, here]);

  if (!track) {
    return (
      <main className="page">
        <header className="top"><button className="round" onClick={() => go('/')} aria-label="Tilbage"><Icon name="back" /></button><h1 className="h-small grow">Find retur</h1></header>
        <p className="sub">Der kører ikke noget spor. Start et spor på forsiden, når du går ud.</p>
      </main>
    );
  }

  const back = here ? wayBack(track, here) : null;
  const course = back && here ? bearing(here, back.target) : null;
  const arrow = course == null ? 0 : heading == null ? course : course - heading;
  const kmText = (v: number) => (v < 1 ? `${Math.round(v * 1000 / 10) * 10} m` : `${v.toLocaleString('da-DK', { maximumFractionDigits: 1 })} km`);

  async function toggleLight() {
    const ok = await torch(!light);
    if (ok) setLight(!light);
    else setMsg('Lommelygten kan ikke tændes herfra.');
  }

  function stop() {
    if (!confirm('Stop sporet? Vejen tilbage glemmes.')) return;
    void torch(false);
    stopTrack();
    go('/');
  }

  return (
    <main className="page retur">
      <header className="top"><button className="round" onClick={() => go('/')} aria-label="Tilbage"><Icon name="back" /></button><h1 className="h-small grow">Find retur</h1></header>
      <div ref={box} className="map" role="img" aria-label="Kort med dit spor" />
      <section className="card way">
        <span className="ring" style={{ transform: `rotate(${arrow}deg)` }} aria-hidden="true"><Icon name="up" size={40} /></span>
        <span className="grow">
          {back ? (
            <>
              <span className="big">{kmText(back.km)}</span>
              <span className="muted">til start · ca. {back.minutes} min</span>
              <span className="muted">{back.km > back.direct * 1.4 && back.direct < 0.3 ? 'Start er lige i nærheden' : course != null ? `Gå mod ${directionWord(course)}` : ''}</span>
            </>
          ) : <span className="muted">Finder dig …</span>}
        </span>
      </section>
      <div className="actions">
        <button className={`btn ${light ? 'filled' : 'tonal'}`} onClick={toggleLight}><Icon name="light" /> {light ? 'Sluk lygten' : 'Lommelygte'}</button>
        <button className="btn tonal" onClick={stop}><Icon name="stop" /> Stop spor</button>
      </div>
      {msg && <p className="muted small center">{msg}</p>}
      <p className="muted small center">Hold Kik åben, så sporet bliver helt.</p>
    </main>
  );
}
