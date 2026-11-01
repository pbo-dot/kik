// Det, der sker, når man tager et billede eller spørger. Arbejdet kører videre,
// selvom man skifter skærm; skærmene får besked via onChange i db.ts.
import { AIError, askAbout, identify, tellMore } from './ai';
import { allFinds, dayOf, getFind, getPhoto, putFind, putPhoto, type Find, type Mode } from './db';
import { shrink, where } from './device';

const message = (e: unknown) => (e instanceof AIError ? e.message : 'Noget gik galt. Prøv igen.');

async function update(id: string, change: (f: Find) => Partial<Find>) {
  const f = await getFind(id);
  if (f) await putFind({ ...f, ...change(f) });
}

async function photoOf(id: string): Promise<string | null> {
  return (await getPhoto(id))?.data ?? null;
}

/** Nyt billede: gemmes straks, og Kenderen går i gang. Giver fundets id. */
export async function newPhoto(file: Blob, mode: Mode): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const [data, thumb, place] = await Promise.all([shrink(file, 1280), shrink(file, 240, 0.7), where()]);
  await putPhoto({ id, data, mime: 'image/jpeg' });
  await putFind({
    id, createdAt, day: dayOf(createdAt), mode, hasPhoto: true,
    thumb: `data:image/jpeg;base64,${thumb}`,
    lat: place?.lat, lon: place?.lon,
    chat: [], usd: 0, busy: 'kigger',
  });
  void runIdentify(id);
  return id;
}

export async function runIdentify(id: string) {
  const f = await getFind(id);
  const photo = await photoOf(id);
  if (!f || !photo) return;
  await update(id, () => ({ busy: 'kigger', error: undefined }));
  try {
    const { answer, usd } = await identify(photo, f);
    await update(id, (g) => ({ answer, usd: g.usd + usd, busy: undefined }));
    // Pris og vejledning kræver nettet: slå op med det samme
    if (f.mode === 'pris' || f.mode === 'hvordan') void runMore(id);
  } catch (e) {
    await update(id, () => ({ busy: undefined, error: message(e) }));
  }
}

export async function runMore(id: string) {
  const f = await getFind(id);
  if (!f) return;
  await update(id, () => ({ busy: 'mere', error: undefined }));
  try {
    const { text, links, usd } = await tellMore(await photoOf(id), f);
    await update(id, (g) => ({ more: { text, links }, usd: g.usd + usd, busy: undefined }));
  } catch (e) {
    await update(id, () => ({ busy: undefined, error: message(e) }));
  }
}

export async function runAsk(id: string, question: string) {
  const f = await getFind(id);
  if (!f || !question.trim()) return;
  await update(id, (g) => ({ busy: 'svarer', error: undefined, chat: [...g.chat, { role: 'user', text: question.trim() }] }));
  try {
    const { text, usd } = await askAbout(await photoOf(id), f, question.trim());
    await update(id, (g) => ({ chat: [...g.chat, { role: 'assistant', text }], usd: g.usd + usd, busy: undefined }));
  } catch (e) {
    // Spørgsmålet fjernes igen, så det kan stilles på ny
    await update(id, (g) => ({ busy: undefined, error: message(e), chat: g.chat.slice(0, -1) }));
  }
}

/** Blev appen lukket midt i et svar, står fundet som "i gang" for evigt. Ryd op ved start. */
export async function fixInterrupted() {
  for (const f of await allFinds()) {
    if (f.busy) await putFind({ ...f, busy: undefined, error: 'Blev afbrudt. Prøv igen.' });
  }
}

/** Spørgsmål uden billede (fx "Hvad er det for en kirke her?"). */
export async function newQuestion(question: string): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const place = await where();
  await putFind({ id, createdAt, day: dayOf(createdAt), mode: 'hvad', hasPhoto: false, question: question.trim(), lat: place?.lat, lon: place?.lon, chat: [], usd: 0 });
  void runAsk(id, question);
  return id;
}
