// Dansk eller English. Teksterne står på dansk i koden; t() giver den engelske udgave, når den er valgt.
import { getSettings } from './settings';

export type Lang = 'da' | 'en';
export const lang = (): Lang => getSettings().lang;
export const isEn = () => lang() === 'en';
/** Datoer og tal */
export const locale = () => (isEn() ? 'en-GB' : 'da-DK');
/** Tale og oplæsning */
export const speechLang = () => (isEn() ? 'en-GB' : 'da-DK');

const EN: Record<string, string> = {
  // Faner og fælles
  'Dage': 'Days', 'Mere': 'More', 'Tilbage': 'Back', 'Slet': 'Delete', 'Send': 'Send', 'Kort': 'Map', 'Stop': 'Stop', 'Start': 'Start',
  'Kigger …': 'Looking …', 'Uden svar': 'No answer', 'Spørgsmål': 'Question', 'I dag': 'Today', 'Prøv igen': 'Try again',
  'Noget gik galt.': 'Something went wrong.', 'Noget gik galt. Prøv igen.': 'Something went wrong. Try again.',
  'Jeg lytter …': 'Listening …', 'Spørg med stemmen': 'Ask with your voice', 'Dansk / English': 'Dansk / English',
  // Tilstande
  'Hvad er det?': 'What is it?', 'Hvor er jeg?': 'Where am I?', 'Oversæt': 'Translate', 'Pris og anmeldelser': 'Price and reviews', 'Hvordan gør jeg?': 'How do I?',
  // Forsiden
  'Peg på noget, og spørg.': 'Point at something and ask.',
  'Tilføj din Claude-nøgle': 'Add your Claude key', 'Kik bruger din egen nøgle. Tryk her.': 'Kik uses your own key. Tap here.',
  'Hvad vil du vide?': 'What do you want to know?', 'Tag billede': 'Take photo', 'Åbn kamera': 'Open camera', 'Øjeblik …': 'One moment …',
  'Vælg et billede': 'Choose a photo', '… eller spørg om stedet': '… or ask about this place',
  'Billedet kunne ikke læses. Prøv igen.': 'The photo could not be read. Try again.',
  'I dag · {n} ting ›': 'Today · {n} things ›', 'Spor kører': 'Tracking', 'Startede kl. {t}': 'Started at {t}',
  'Stop sporet? Vejen tilbage glemmes.': 'Stop the track? The way back will be forgotten.',
  // Et fund
  'Slet dette fund?': 'Delete this find?', 'Fundet findes ikke længere.': 'This find no longer exists.', 'Til Kik': 'Back to Kik',
  'Ikke helt sikker.': 'Not quite sure.', 'Slår op …': 'Looking it up …', 'Tænker …': 'Thinking …', 'Læs op': 'Read aloud',
  'Fortæl mere': 'Tell me more', 'Vis vej': 'Directions', 'Spørg videre …': 'Ask a follow-up …', 'ca. {kr}': 'approx. {kr}',
  'Set før · 1 gang': 'Seen before · once', 'Set før · {n} gange': 'Seen before · {n} times', 'Se alle {n} ›': 'See all {n} ›',
  // Dage
  'Søg i dine fund': 'Search your finds', 'Ryd': 'Clear', 'Når du har kigget på noget, samles det her.': 'Things you look at are collected here.',
  '{n} fund': '{n} finds', '1 fund': '1 find', '1 ting': '1 thing', 'I dag · 1 ting ›': 'Today · 1 thing ›', 'Ingen fund': 'No finds', '{n} ting': '{n} things', 'Dagens rute': "Today's route", 'Dagen': 'The day',
  'Del → Dagbog': 'Share → Diary', 'Skriv dagen': 'Write the day', 'Skriver …': 'Writing …',
  'Kopieret. Sæt den ind i Dagbog.': 'Copied. Paste it into your diary.', 'Kunne ikke dele.': 'Could not share.',
  '{label} – det så jeg med Kik:': '{label} – what I saw with Kik:',
  // Mere
  'Claude-nøgle': 'Claude key', 'Test nøgle': 'Test key', 'Slet nøgle': 'Delete key', 'Nøglen er slettet.': 'The key has been deleted.',
  'Nøglen ligger kun på denne telefon.': 'The key is only stored on this phone.', 'Tester …': 'Testing …', 'Nøglen virker.': 'The key works.',
  'Model': 'Model', 'Sonnet 5.5 (hurtig, standard)': 'Sonnet 5.5 (fast, default)', 'Opus 5.5 (grundigere, dobbelt pris)': 'Opus 5.5 (more thorough, double price)',
  'Læs svaret op med det samme': 'Read the answer aloud right away', 'Udseende': 'Appearance', 'Auto': 'Auto', 'Lys': 'Light', 'Mørk': 'Dark',
  'Sprog / Language': 'Language / Sprog', 'Knapper og svar på det valgte sprog.': 'Buttons and answers in the chosen language.',
  'Forbrug': 'Usage', 'Denne måned: ca. {kr}': 'This month: approx. {kr}', 'Et skøn ud fra listepriserne.': 'An estimate based on list prices.',
  'Slet alle fund': 'Delete all finds', 'Slet alle billeder og svar på telefonen?': 'Delete all photos and answers on this phone?', 'Version {v}': 'Version {v}',
  'under 1 øre': 'less than 1 øre',
  // Kort og Find retur
  'Stop spor': 'Stop track', 'Følg mig': 'Follow me', 'Kort over, hvor du er og har gået': 'Map of where you are and have walked',
  'Finder dig …': 'Finding you …', 'gået': 'walked', 'siden start': 'since start', 'Samme vej': 'Same way', 'Direkte': 'Direct', 'Vej tilbage': 'Way back',
  'til start': 'to start', 'direkte til start': 'straight to start', 'ca. {n} min': 'approx. {n} min', 'Du er ved start': 'You are at the start',
  'Gå mod {dir}': 'Head {dir}', 'Direkte kan gå over hegn, vand eller privat grund.': 'The direct way may cross fences, water or private land.',
  'Start spor': 'Start track', 'Find retur': 'Find way back', 'Skjul pil': 'Hide arrow', 'Lygte': 'Torch', 'Sluk': 'Off',
  'Lommelygten kan ikke tændes herfra.': 'The torch cannot be turned on from here.', 'Hold Kik åben, så sporet bliver helt.': 'Keep Kik open so the track stays complete.',
  'nord': 'north', 'nordøst': 'north-east', 'øst': 'east', 'sydøst': 'south-east', 'syd': 'south', 'sydvest': 'south-west', 'vest': 'west', 'nordvest': 'north-west',
  'Kik må ikke se, hvor du er. Tillad sted i Chrome.': 'Kik may not see where you are. Allow location in Chrome.',
  'Kunne ikke finde dig. Prøv igen udenfor.': 'Could not find you. Try again outdoors.', 'Telefonen kan ikke finde sted her.': 'This phone cannot find its location here.',
  // Opdatering
  'Ny version klar': 'New version ready', 'Opdatér': 'Update',
  // Telefonen og Claude
  'Tale virker ikke i denne browser.': 'Speech does not work in this browser.', 'Mikrofonen er ikke tilladt.': 'The microphone is not allowed.',
  'Blev afbrudt. Prøv igen.': 'Was interrupted. Try again.',
  'Tilføj din Claude-nøgle under Mere.': 'Add your Claude key under More.', 'Nøglen blev afvist. Tjek den under Mere.': 'The key was rejected. Check it under More.',
  'Nøglen har ikke adgang til modellen.': 'The key does not have access to the model.', 'For mange spørgsmål lige nu. Prøv igen om lidt.': 'Too many questions right now. Try again shortly.',
  'Ingen forbindelse. Er du online?': 'No connection. Are you online?', 'Claude svarede med en fejl ({s}).': 'Claude replied with an error ({s}).', 'Noget gik galt': 'Something went wrong',
  'Claude kunne ikke svare på dette billede.': 'Claude could not answer about this photo.', 'Claude ville ikke svare på dette.': 'Claude would not answer this.',
  'Claude kunne ikke skrive dagen.': 'Claude could not write the day.',
};

/** Teksten på det valgte sprog. {navn} i teksten erstattes med værdierne i `vars`. */
export function t(da: string, vars?: Record<string, string | number>): string {
  let s = isEn() ? (EN[da] ?? da) : da;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Ental eller flertal: tn(1, '1 ting', '{n} ting') */
export const tn = (n: number, one: string, many: string) => (n === 1 ? t(one) : t(many, { n }));

/** "12 min" eller "1 t 5 min" / "1 h 5 min" */
export function durText(min: number): string {
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} ${isEn() ? 'h' : 't'} ${min % 60} min`;
}

/** Til Claude: svar på det valgte sprog. */
export function answerLanguage(): string {
  return isEn()
    ? '\n\nIMPORTANT: The person has chosen English. Write every answer and every text field in clear, simple British English. When asked to translate, translate into English instead of Danish.'
    : '';
}

/** Skift sprog-lyttere (appen tegnes forfra) */
const listeners = new Set<() => void>();
export function onLang(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }
export const langChanged = () => listeners.forEach((l) => l());
