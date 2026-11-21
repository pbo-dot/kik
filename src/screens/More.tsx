// Mere: nøgle, model, oplæsning, udseende og forbrug.
import { langChanged, t } from '../lib/i18n';
import { useState } from 'react';
import { AIError, testKey } from '../lib/ai';
import { deleteAll } from '../lib/db';
import { MODELS, getApiKey, getSettings, krText, monthUsage, saveSettings, setApiKey, type Settings } from '../lib/settings';

export function More() {
  const [s, setS] = useState<Settings>(getSettings);
  const [key, setKey] = useState(getApiKey);
  const [msg, setMsg] = useState('');
  const set = (patch: Partial<Settings>) => { const n = { ...s, ...patch }; setS(n); saveSettings(n); };

  async function test() {
    setApiKey(key);
    setMsg(t('Tester …'));
    try { await testKey(); setMsg(t('Nøglen virker.')); } catch (e) { setMsg(e instanceof AIError ? e.message : t('Noget gik galt.')); }
  }

  return (
    <main className="page">
      <header className="top"><h1>{t('Mere')}</h1></header>

      <section className="card form">
        <h3>{t('Sprog / Language')}</h3>
        <div className="seg">
          {([['da', 'Dansk'], ['en', 'English']] as const).map(([v, l]) => (
            <button key={v} className={s.lang === v ? 'on' : ''} onClick={() => { set({ lang: v }); langChanged(); }}>{l}</button>
          ))}
        </div>
        <p className="muted small">{t('Knapper og svar på det valgte sprog.')}</p>
      </section>

      <section className="card form">
        <h3>{t('Claude-nøgle')}</h3>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} onBlur={() => setApiKey(key)} placeholder="sk-ant-…" autoComplete="off" />
        <div className="actions">
          <button className="btn filled" onClick={test} disabled={!key.trim()}>{t('Test nøgle')}</button>
          {key && <button className="btn text" onClick={() => { setKey(''); setApiKey(''); setMsg(t('Nøglen er slettet.')); }}>{t('Slet nøgle')}</button>}
        </div>
        {msg && <p className="muted small">{msg}</p>}
        <p className="muted small">{t('Nøglen ligger kun på denne telefon.')}</p>
      </section>

      <section className="card form">
        <h3>{t('Model')}</h3>
        {MODELS.map((m) => (
          <label key={m.id} className="radio">
            <input type="radio" name="model" checked={s.model === m.id} onChange={() => set({ model: m.id })} /> {t(m.label)}
          </label>
        ))}
      </section>

      <section className="card form">
        <label className="switch">
          <span className="grow">{t('Læs svaret op med det samme')}</span>
          <input type="checkbox" checked={s.autoSpeak} onChange={(e) => set({ autoSpeak: e.target.checked })} />
        </label>
      </section>

      <section className="card form">
        <h3>{t('Udseende')}</h3>
        <div className="seg">
          {([['auto', t('Auto')], ['light', t('Lys')], ['dark', t('Mørk')]] as const).map(([v, l]) => (
            <button key={v} className={s.theme === v ? 'on' : ''} onClick={() => set({ theme: v })}>{l}</button>
          ))}
        </div>
      </section>

      <section className="card form">
        <h3>{t('Forbrug')}</h3>
        <p>{t('Denne måned: ca. {kr}', { kr: krText(monthUsage()) })}</p>
        <p className="muted small">{t('Et skøn ud fra listepriserne.')}</p>
      </section>

      <div className="center">
        <button className="btn text danger" onClick={async () => { if (confirm(t('Slet alle billeder og svar på telefonen?'))) await deleteAll(); }}>{t('Slet alle fund')}</button>
        <p className="muted small">{t('Version {v}', { v: __BUILD__ })}</p>
      </div>
    </main>
  );
}
