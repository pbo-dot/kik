// Kort: hvor du er, og hvor du har gået. Kortet følger dig, og "Find retur" viser vejen tilbage til start.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { torch } from '../lib/device';
import { bearing, directionWord, follow, getHere, getTrack, onHeading, onTrack, startTrack, stopTrack, trackKm, wayBack } from '../lib/track';
import { Icon, go } from '../ui';

const kmText = (v: number) => (v < 1 ? `${Math.round(v * 100) * 10} m` : `${v.toLocaleString('da-DK', { maximumFractionDigits: 1 })} km`);
const durText = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} t ${min % 60} min`);

export default function Kort({ back: startBack = false }: { back?: boolean }) {
  const [, tick] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<{ m: L.Map; line: L.Polyline; start: L.CircleMarker; me: L.CircleMarker; placed: boolean } | null>(null);
  const [following, setFollowing] = useState(true);
  const followRef = useRef(true);
  const [showBack, setShowBack] = useState(startBack);
  const [heading, setHeading] = useState<number | null>(null);
  const [light, setLight] = useState(false);
  const [msg, setMsg] = useState('');
  const [starting, setStarting] = useState(false);
  const track = getTrack();
  const here = getHere();

  useEffect(() => {
    const off = onTrack(() => { tick((n) => n + 1); setNow(Date.now()); });
    const stop = follow();
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => { off(); stop(); clearInterval(t); };
  }, []);
  useEffect(() => onHeading((d) => setHeading(Math.round(d))), []);
  useEffect(() => () => { void torch(false); }, []);

  // Kortet laves én gang
  useEffect(() => {
    if (!box.current) return;
    const first = getTrack()?.pts[0] ?? getHere();
    const c: [number, number] = first ? ('lat' in first ? [first.lat, first.lon] : [first[0], first[1]]) : [56.0, 11.0];
    const m = L.map(box.current, { zoomControl: false, attributionControl: true }).setView(c, first ? 16 : 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap', referrerPolicy: 'strict-origin-when-cross-origin' }).addTo(m);
    m.attributionControl.setPrefix(false);
    const line = L.polyline([], { className: 'trk', weight: 6, lineCap: 'round', dashArray: '1 12' }).addTo(m);
    const start = L.circleMarker(c, { className: 'start-dot', radius: 11, weight: 3 })
      .bindTooltip('Start', { permanent: true, direction: 'top', offset: [0, -10], className: 'map-label' });
    const me = L.circleMarker(c, { className: 'me-dot', radius: 9, weight: 3 });
    // Flytter man selv kortet, holder det op med at følge
    m.on('dragstart', () => { followRef.current = false; setFollowing(false); });
    map.current = { m, line, start, me, placed: false };
    return () => { m.remove(); map.current = null; };
  }, []);

  // Opdatér spor, start og prik; følg med, når man går
  useEffect(() => {
    const k = map.current;
    if (!k) return;
    const pts = (track?.pts ?? []).map((p) => [p[0], p[1]] as [number, number]);
    k.line.setLatLngs(pts);
    if (track) { k.start.setLatLng(pts[0]); if (!k.m.hasLayer(k.start)) k.start.addTo(k.m); }
    else if (k.m.hasLayer(k.start)) k.start.remove();
    if (!here) return;
    k.me.setLatLng([here.lat, here.lon]);
    if (!k.m.hasLayer(k.me)) k.me.addTo(k.m);
    if (!k.placed) {
      // Første gang: vis hele sporet, eller zoom ind på dig
      if (pts.length > 1) k.m.fitBounds(L.latLngBounds([...pts, [here.lat, here.lon]]), { padding: [40, 40], maxZoom: 17 });
      else k.m.setView([here.lat, here.lon], 17);
      k.placed = true;
    } else if (followRef.current) {
      k.m.panTo([here.lat, here.lon], { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches });
    }
  }, [track, here]);

  // Find retur: vis hele vejen tilbage (dig og start) på én gang
  function showWayBack() {
    setShowBack(true);
    const k = map.current, t = getTrack(), h = getHere();
    if (!k || !t || !h) return;
    followRef.current = false;
    setFollowing(false);
    k.m.fitBounds(L.latLngBounds([...t.pts.map((p) => [p[0], p[1]] as [number, number]), [h.lat, h.lon]]), { padding: [40, 40], maxZoom: 17 });
  }

  function recenter() {
    followRef.current = true;
    setFollowing(true);
    if (here) map.current?.m.setView([here.lat, here.lon], Math.max(map.current.m.getZoom(), 16));
  }

  async function start() {
    setStarting(true);
    setMsg('');
    try { await startTrack(); } catch (e) { setMsg((e as Error).message); } finally { setStarting(false); }
  }

  function stop() {
    if (!confirm('Stop sporet? Vejen tilbage glemmes.')) return;
    void torch(false);
    setLight(false);
    setShowBack(false);
    stopTrack();
  }

  async function toggleLight() {
    const ok = await torch(!light);
    if (ok) setLight(!light);
    else setMsg('Lommelygten kan ikke tændes herfra.');
  }

  const way = track && here ? wayBack(track, here) : null;
  const course = way && here ? bearing(here, way.target) : null;
  const arrow = course == null ? 0 : heading == null ? course : course - heading;
  const lightBtn = <button className={`btn ${light ? 'filled' : 'tonal'}`} onClick={toggleLight}><Icon name="light" /> {light ? 'Sluk' : 'Lygte'}</button>;

  return (
    <main className="page kort">
      <header className="top">
        <button className="round" onClick={() => go('/')} aria-label="Tilbage"><Icon name="back" /></button>
        <h1 className="h-small grow">Kort</h1>
        {track && <button className="round" onClick={stop} aria-label="Stop spor"><Icon name="stop" /></button>}
      </header>

      <div className="map-wrap">
        <div ref={box} className="map" role="img" aria-label="Kort over, hvor du er og har gået" />
        {!following && here && <button className="fab" onClick={recenter} aria-label="Følg mig"><Icon name="locate" /></button>}
      </div>

      {!here && <p className="muted center">Finder dig …</p>}

      {track && !showBack && (
        <div className="stats">
          <div className="card"><b>{kmText(trackKm(track))}</b><span>gået</span></div>
          <div className="card"><b>{durText(Math.max(0, Math.round((now - track.startedAt) / 60_000)))}</b><span>siden start</span></div>
        </div>
      )}

      {track && showBack && (
        <section className="card way">
          <span className="ring" style={{ transform: `rotate(${arrow}deg)` }} aria-hidden="true"><Icon name="up" size={40} /></span>
          <span className="grow">
            {way ? (
              <>
                <span className="big">{kmText(way.km)}</span>
                <span className="muted">til start · ca. {way.minutes} min</span>
                <span className="muted">{way.direct < 0.03 ? 'Du er ved start' : course != null ? `Gå mod ${directionWord(course)}` : ''}</span>
              </>
            ) : <span className="muted">Finder dig …</span>}
          </span>
        </section>
      )}

      <div className="actions">
        {!track && <button className="btn filled" onClick={start} disabled={starting}><Icon name="pin" /> {starting ? 'Finder dig …' : 'Start spor'}</button>}
        {track && !showBack && <button className="btn filled" onClick={showWayBack}><Icon name="retur" /> Find retur</button>}
        {track && showBack && <button className="btn tonal" onClick={() => setShowBack(false)}><Icon name="map" /> Skjul pil</button>}
        {lightBtn}
      </div>
      {msg && <p className="muted small center">{msg}</p>}
      {track && <p className="muted small center">Hold Kik åben, så sporet bliver helt.</p>}
    </main>
  );
}
