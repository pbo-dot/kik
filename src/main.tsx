import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, getSettings } from './lib/settings'
import { fixInterrupted } from './lib/actions'
import { resumeTrack } from './lib/track'
import { errText, log } from './lib/log'

// Loggen: start, fejl der ikke blev fanget, net og skjult/vist
{
  const s = getSettings()
  const ua = navigator.userAgent.match(/Android [\d.]+|iPhone OS [\d_]+|Chrome\/[\d]+/g)?.join(' · ') ?? ''
  log(`Kik starter · version ${__BUILD__} · ${ua} · ${s.lang} · ${s.model}${matchMedia('(display-mode: standalone)').matches ? ' · installeret' : ' · i browser'}${navigator.onLine ? '' : ' · OFFLINE'}`)
  window.addEventListener('error', (e) => log(`fejl i appen: ${e.message} (${(e.filename ?? '').split('/').pop()}:${e.lineno})`, 'fejl'))
  window.addEventListener('unhandledrejection', (e) => log(`fejl i appen: ${errText(e.reason)}`, 'fejl'))
  window.addEventListener('online', () => log('net: online'))
  window.addEventListener('offline', () => log('net: offline', 'warn'))
  document.addEventListener('visibilitychange', () => log(document.hidden ? 'Kik skjult' : 'Kik vist'))
}

applyTheme(getSettings().theme)
void fixInterrupted().catch(() => undefined)
resumeTrack()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
