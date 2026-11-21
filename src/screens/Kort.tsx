// Kort: hvor du er, og hvor du har gået. Kortet følger dig, og "Find retur" viser vejen tilbage til start.
import { durText, locale, t } from '../lib/i18n';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { torch } from '../lib/device';
import { bearing, directionWord, follow, getHere, getTrack, onHeading, onTrack, startTrack, stopTrack, trackKm, wayBack } from '../lib/track';
import { Icon, go } from '../ui';
import { log } from '../lib/log';

const ROUTE_KEY = 'kik.returVej';
const kmText = (v: number) => (v < 1 ? `${Math.round(v * 100) * 10} m` : `${v.toLocaleString(locale(), { maximumFractionDigits: 1 })} km`);

export default function Kort({ back: startBack = false }: { back?: boolean }) {
  const [, tick] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<{ m: L.Map; line: L.Polyline; direct: L.Polyline; start: L.CircleMarker; me: L.CircleMarker; placed: boolean } | null>(null);
  const [following, setFollowing] = useState(true);
  const followRef = useRef(true);
  const [showBack, setShowBack] = useState(startBack);
  // Find retur: samme vej tilbage ad sporet, eller direkte mod start
  const [direct, setDirect] = useState(() => { try { return localStorage.getItem(ROUTE_KEY) === 'direkte'; } catch { return false; } });
  const pickRoute = (d: boolean) => { log(`find retur: ${d ? 'direkte' : 'samme vej'}`); setDirect(d); try { localStorage.setItem(ROUTE_KEY, d ? 'direkte' : 'samme'); } catch { /* ingen lagring */ } };
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
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap', referrerPolicy: 'strict-origin-when-cross-origin' }).addTo(m);
    // Til loggen: kortbrikker, der ikke kunne hentes (ingen dækning, blokeret)
    let tileErrors = 0;
    tiles.on('tileerror', () => { if (++tileErrors === 1 || tileErrors % 20 === 0) log(`kort: ${tileErrors} kortbrikker kunne ikke hentes${navigator.onLine ? '' : ' (offline)'}`, 'warn'); });
    log(`kort: åbnet${first ? '' : ' uden kendt sted'}${getTrack() ? ` · spor med ${getTrack()!.pts.length} punkter` : ''}`);
    m.attributionControl.setPrefix(false);
    const line = L.polyline([], { className: 'trk', weight: 6, lineCap: 'round', dashArray: '1 12' }).addTo(m);
    const start = L.circleMarker(c, { className: 'start-dot', radius: 11, weight: 3 })
      .bindTooltip(t('Start'), { permanent: true, direction: 'top', offset: [0, -10], className: 'map-label' });
    const me = L.circleMarker(c, { className: 'me-dot', radius: 9, weight: 3 });
    const direct = L.polyline([], { className: 'direct-line', weight: 5, lineCap: 'round', dashArray: '10 10' });
    // Flytter man selv kortet, holder det op med at følge
    m.on('dragstart', () => { followRef.current = false; setFollowing(false); });
    map.current = { m, line, direct, start, me, placed: false };
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
    // Direkte: en lige streg fra dig til start, og sporet tones ned
    const showDirect = !!(track && here && showBack && direct);
    if (showDirect) { k.direct.setLatLngs([[here!.lat, here!.lon], pts[0]]); if (!k.m.hasLayer(k.direct)) k.direct.addTo(k.m); }
    else if (k.m.hasLayer(k.direct)) k.direct.remove();
    k.line.getElement()?.classList.toggle('faded', showDirect);
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
  }, [track, here, showBack, direct]);

  // Find retur: vis hele vejen tilbage (dig og start) på én gang
  function showWayBack() {
    setShowBack(true);
    log('find retur: vist');
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
    if (!confirm(t('Stop sporet? Vejen tilbage glemmes.'))) return;
    void torch(false);
    setLight(false);
    setShowBack(false);
    stopTrack();
  }

  async function toggleLight() {
    const ok = await torch(!light);
    if (ok) setLight(!light);
    else setMsg(t('Lommelygten kan ikke tændes herfra.'));
  }

  const back = track && here ? wayBack(track, here) : null;
  const startPt = track ? { lat: track.pts[0][0], lon: track.pts[0][1] } : null;
  const way = back && (direct ? { ...back, km: back.direct, minutes: Math.max(1, Math.round((back.direct / 4) * 60)), target: startPt! } : back);
  const course = way && here ? bearing(here, way.target) : null;
  const arrow = course == null ? 0 : heading == null ? course : course - heading;
  const lightBtn = <button className={`btn ${light ? 'filled' : 'tonal'}`} onClick={toggleLight}><Icon name="light" /> {light ? t('Sluk') : t('Lygte')}</button>;

  return (
    <main className="page kort">
      <header className="top">
        <button className="round" onClick={() => go('/')} aria-label={t('Tilbage')}><Icon name="back" /></button>
        <h1 className="h-small grow">{t('Kort')}</h1>
        {track && <button className="round" onClick={stop} aria-label={t('Stop spor')}><Icon name="stop" /></button>}
      </header>

      {track && showBack && (
        <div className="seg" role="radiogroup" aria-label={t('Vej tilbage')}>
          <button role="radio" aria-checked={!direct} className={!direct ? 'on' : ''} onClick={() => pickRoute(false)}>{t('Samme vej')}</button>
          <button role="radio" aria-checked={direct} className={direct ? 'on' : ''} onClick={() => pickRoute(true)}>{t('Direkte')}</button>
        </div>
      )}

      <div className="map-wrap">
        <div ref={box} className="map" role="img" aria-label={t('Kort over, hvor du er og har gået')} />
        {!following && here && <button className="fab" onClick={recenter} aria-label={t('Følg mig')}><Icon name="locate" /></button>}
      </div>

      {!here && <p className="muted center">{t('Finder dig …')}</p>}

      {track && !showBack && (
        <div className="stats">
          <div className="card"><b>{kmText(trackKm(track))}</b><span>{t('gået')}</span></div>
          <div className="card"><b>{durText(Math.max(0, Math.round((now - track.startedAt) / 60_000)))}</b><span>{t('siden start')}</span></div>
        </div>
      )}

      {track && showBack && (
        <section className="card way">
          <span className="ring" style={{ transform: `rotate(${arrow}deg)` }} aria-hidden="true"><Icon name="up" size={40} /></span>
          <span className="grow">
            {way ? (
              <>
                <span className="big">{kmText(way.km)}</span>
                <span className="muted">{direct ? t('direkte til start') : t('til start')} · {t('ca. {n} min', { n: way.minutes })}</span>
                <span className="muted">{way.direct < 0.03 ? t('Du er ved start') : course != null ? t('Gå mod {dir}', { dir: t(directionWord(course)) }) : ''}</span>
              </>
            ) : <span className="muted">{t('Finder dig …')}</span>}
            {way && direct && way.km >= 0.03 && <span className="warn">{t('Direkte kan gå over hegn, vand eller privat grund.')}</span>}
          </span>
        </section>
      )}

      <div className="actions">
        {!track && <button className="btn filled" onClick={start} disabled={starting}><Icon name="pin" /> {starting ? t('Finder dig …') : t('Start spor')}</button>}
        {track && !showBack && <button className="btn filled" onClick={showWayBack}><Icon name="retur" /> {t('Find retur')}</button>}
        {track && showBack && <button className="btn tonal" onClick={() => setShowBack(false)}><Icon name="map" /> {t('Skjul pil')}</button>}
        {lightBtn}
      </div>
      {msg && <p className="muted small center">{msg}</p>}
      {track && <p className="muted small center">{t('Hold Kik åben, så sporet bliver helt.')}</p>}
    </main>
  );
}
