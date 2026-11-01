import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, getSettings } from './lib/settings'
import { fixInterrupted } from './lib/actions'
import { resumeTrack } from './lib/track'

applyTheme(getSettings().theme)
void fixInterrupted().catch(() => undefined)
resumeTrack()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
