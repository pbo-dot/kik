// Claude direkte fra telefonen med ejerens egen nøgle.
// Tre "agenter": Kenderen (hvad er det?), Opslageren (nettet) og Skriveren (dagen).
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Answer, ChatTurn, Find, Link, Mode } from './db';
import { addUsage, getApiKey, getSettings } from './settings';

export class AIError extends Error {}

function client() {
  const apiKey = getApiKey();
  if (!apiKey) throw new AIError('Tilføj din Claude-nøgle under Mere.');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

// Afvises et svar af sikkerhedsfiltret, prøver Claude selv igen med en anden model.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

function explain(e: unknown): never {
  if (e instanceof AIError) throw e;
  if (e instanceof Anthropic.AuthenticationError) throw new AIError('Nøglen blev afvist. Tjek den under Mere.');
  if (e instanceof Anthropic.PermissionDeniedError) throw new AIError('Nøglen har ikke adgang til modellen.');
  if (e instanceof Anthropic.RateLimitError) throw new AIError('For mange spørgsmål lige nu. Prøv igen om lidt.');
  if (e instanceof Anthropic.APIConnectionError) throw new AIError('Ingen forbindelse. Er du online?');
  if (e instanceof Anthropic.APIError) throw new AIError(`Claude svarede med en fejl (${e.status}).`);
  throw new AIError('Noget gik galt.');
}

// ---- Pris (skøn ud fra listepriser, dollar pr. million tokens) ----
const PRICES = [
  { match: /opus-5-5/, input: 4, output: 20 },
  { match: /opus/, input: 5, output: 25 },
  { match: /sonnet/, input: 2, output: 10 },
  { match: /haiku/, input: 0.1, output: 0.5 },
];
interface ApiUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}
function track(res: { model: string; usage: ApiUsage }): number {
  const p = PRICES.find((x) => x.match.test(res.model)) ?? PRICES[2];
  const u = res.usage;
  const usd =
    ((u.input_tokens + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1) * p.input + u.output_tokens * p.output) / 1e6 +
    (u.server_tool_use?.web_search_requests ?? 0) * 0.01;
  addUsage(usd);
  return usd;
}

// ---- Fælles ----

export const MODES: Record<Mode, { label: string; task: string }> = {
  hvad: { label: 'Hvad er det?', task: 'Sig, hvad det er, og fortæl én god, kort historie eller et sjovt faktum om det.' },
  oversaet: { label: 'Oversæt', task: 'Oversæt teksten på billedet til dansk. Er det et menukort, så nævn kort de retter, der er mest værd at prøve.' },
  pris: { label: 'Pris og anmeldelser', task: 'Sig præcist, hvilket produkt det er (mærke, model, årgang). Pris og anmeldelser slås op bagefter, så gæt ikke på priser.' },
  hvordan: { label: 'Hvordan gør jeg?', task: 'Sig, hvad det er, og forklar trin for trin, hvordan man bruger, skifter eller ordner det, der er mest sandsynligt, at man vil.' },
};

function now(): string {
  return new Date().toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function placeText(f: Pick<Find, 'lat' | 'lon'>): string {
  return f.lat != null && f.lon != null
    ? `Personen står ved koordinaterne ${f.lat.toFixed(5)}, ${f.lon.toFixed(5)} (brug dem til at finde ud af hvor, fx by eller bydel).`
    : 'Stedet er ukendt.';
}

const GUIDE = `Du er "Kik", en vidende og venlig guide i lommen. En person peger telefonen på noget, de ser ude i verden (en bygning, et kunstværk, et skilt, en plante, et produkt, en maskine …), og vil vide, hvad det er.
- Svar på enkelt, naturligt dansk i du-form. Kort: svaret læses ofte højt, mens personen går.
- Gæt ikke. Er du i tvivl, så sig det, og sig, hvad personen kan fotografere for at gøre det sikkert.
- Planter og svampe: sig aldrig, at noget er sikkert at spise.
- Ingen emojis, ingen overskrifter, ingen punktlister i svar til oplæsning.`;

function imageBlock(data: string): Anthropic.Beta.BetaImageBlockParam {
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } };
}

// ---------------- Kenderen ----------------

const IdentifySchema = z.object({
  kategori: z.string().describe('Ét eller to ord, fx "Bygning", "Maleri", "Træ", "Vin", "Menukort", "Skilt"'),
  navn: z.string().describe('Hvad det er, så præcist som muligt, fx "Rundetårn" eller "Platan". Højst 6 ord.'),
  svar: z.string().describe('Selve svaret, 2-5 korte sætninger til oplæsning. Oversættelser og trin må gerne være længere.'),
  sikker: z.boolean().describe('true hvis du er ret sikker på, hvad det er'),
  bedOm: z.string().describe('Hvis du ikke er sikker: hvad personen skal tage et billede af for at gøre det sikkert (én kort sætning). Ellers tom streng.'),
  sted: z.boolean().describe('true hvis det er et bestemt sted, man kan finde vej til (bygning, museum, restaurant, seværdighed)'),
  hvor: z.string().describe('Kort stednavn ud fra koordinaterne, fx "Tisvilde Strand" eller "Indre By, København". Tom streng, hvis stedet er ukendt.'),
});

export async function identify(photo: string, f: Find): Promise<{ answer: Answer; usd: number }> {
  const s = getSettings();
  try {
    const res = await client().beta.messages.parse({
      model: s.model,
      max_tokens: 4000,
      system: `${GUIDE}\n\nNu er det ${now()}. ${placeText(f)}`,
      output_config: { effort: 'low', format: betaZodOutputFormat(IdentifySchema) },
      messages: [{ role: 'user', content: [imageBlock(photo), { type: 'text', text: MODES[f.mode].task }] }],
      ...FALLBACK,
    });
    const usd = track(res);
    if (res.stop_reason === 'refusal' || !res.parsed_output) throw new AIError('Claude kunne ikke svare på dette billede.');
    return { answer: res.parsed_output, usd };
  } catch (e) {
    explain(e);
  }
}

// ---------------- Opslageren (nettet) ----------------

const WEB_TOOL = {
  type: 'web_search_20260209' as const,
  name: 'web_search' as const,
  max_uses: 4,
  user_location: { type: 'approximate' as const, country: 'DK', timezone: 'Europe/Copenhagen' },
};

function moreTask(f: Find): string {
  const a = f.answer;
  const what = a ? `${a.kategori}: ${a.navn}` : 'det på billedet';
  switch (f.mode) {
    case 'pris':
      return `Find prisen på ${what} i danske butikker (laveste pris og hvor), og hvad anmeldere og købere siger. Højst 6 linjer.`;
    case 'hvordan':
      return `Find en vejledning til ${what}, fx fra producenten. Forklar trinene kort, og nævn reservedelsnumre, hvis det er relevant.`;
    case 'oversaet':
      return `Fortæl lidt mere om det, der står på billedet (${what}), fx hvad retterne er, eller hvad skiltet betyder i praksis.`;
    default:
      return `Fortæl mere om ${what}: historien, hvad der er værd at vide, og ${a?.sted ? 'åbningstider i dag, pris for entré, ' : ''}ét godt tip. Højst 8 korte sætninger, skrevet til oplæsning.`;
  }
}

async function withWeb(system: string, messages: Anthropic.Beta.BetaMessageParam[], effort: 'low' | 'medium'): Promise<{ text: string; links: Link[]; usd: number }> {
  const s = getSettings();
  const links = new Map<string, string>();
  let text = '';
  let usd = 0;
  try {
    // Lange søgninger kan holde pause (pause_turn); så fortsættes, højst tre gange
    for (let round = 0; round < 3; round++) {
      const res = await client().beta.messages.create({
        model: s.model,
        max_tokens: 8000,
        system,
        output_config: { effort },
        tools: [WEB_TOOL],
        messages,
        ...FALLBACK,
      });
      usd += track(res);
      if (res.stop_reason === 'refusal') throw new AIError('Claude ville ikke svare på dette.');
      for (const b of res.content) {
        if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
          for (const r of b.content) if (r.type === 'web_search_result') links.set(r.url, r.title);
        } else if (b.type === 'text') text += b.text;
      }
      if (res.stop_reason !== 'pause_turn') break;
      messages = [...messages, { role: 'assistant', content: res.content }];
    }
  } catch (e) {
    explain(e);
  }
  return { text: text.trim(), links: [...links].slice(0, 5).map(([url, title]) => ({ url, title })), usd };
}

/** "Fortæl mere": slår op på nettet om det, der er fundet. */
export async function tellMore(photo: string | null, f: Find) {
  const first: Anthropic.Beta.BetaContentBlockParam[] = [
    ...(photo ? [imageBlock(photo)] : []),
    { type: 'text', text: `${f.answer ? `Du har allerede sagt: ${f.answer.navn}. ${f.answer.svar}\n\n` : ''}${moreTask(f)}\nGentag ikke det, du allerede har sagt. Skriv ikke om, at du søger.` },
  ];
  return withWeb(`${GUIDE}\n\nNu er det ${now()}. ${placeText(f)}`, [{ role: 'user', content: first }], 'low');
}

/** Spørg videre (stemme eller tekst) om fundet, eller uden billede om stedet. */
export async function askAbout(photo: string | null, f: Find, question: string) {
  const intro: string[] = [];
  if (f.answer) intro.push(`Det er: ${f.answer.kategori}: ${f.answer.navn}. ${f.answer.svar}`);
  if (f.more) intro.push(`Slået op: ${f.more.text}`);
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  const turns: ChatTurn[] = [...f.chat, { role: 'user', text: question }];
  turns.forEach((t, i) => {
    if (i === 0) {
      const head = intro.length ? `${intro.join('\n\n')}\n\nMit spørgsmål: ` : '';
      messages.push({ role: 'user', content: [...(photo ? [imageBlock(photo)] : []), { type: 'text', text: head + t.text }] });
    } else messages.push({ role: t.role, content: t.text });
  });
  return withWeb(
    `${GUIDE}\nSlå op på nettet, når svaret kræver fakta, du ikke er sikker på (åbningstider, priser, historie, vejledninger).\n\nNu er det ${now()}. ${placeText(f)}`,
    messages,
    'medium',
  );
}

// ---------------- Skriveren (dagen) ----------------

export async function writeDay(finds: Find[], dayLabel: string): Promise<{ text: string; usd: number }> {
  const s = getSettings();
  const lines = finds.map((f) => {
    const t = new Date(f.createdAt).toLocaleTimeString('da-DK', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit' });
    const what = f.answer ? `${f.answer.kategori}: ${f.answer.navn}. ${f.answer.svar}` : (f.question ?? '');
    const q = f.chat.filter((c) => c.role === 'user').map((c) => c.text).join(' / ');
    return `- ${t} ${what}${q ? ` (jeg spurgte: ${q})` : ''}`;
  });
  try {
    const res = await client().beta.messages.create({
      model: s.model,
      max_tokens: 4000,
      output_config: { effort: 'low' },
      system: 'Du skriver et kort dagbogsafsnit på dansk i jeg-form ud fra de ting, personen så og spurgte om i løbet af dagen. 4-8 sætninger, varmt og konkret, uden at finde på noget, der ikke står i listen. Ingen overskrift, ingen emojis.',
      messages: [{ role: 'user', content: `${dayLabel}. Det her så jeg:\n${lines.join('\n')}` }],
      ...FALLBACK,
    });
    const usd = track(res);
    if (res.stop_reason === 'refusal') throw new AIError('Claude kunne ikke skrive dagen.');
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    return { text, usd };
  } catch (e) {
    explain(e);
  }
}

export async function testKey(): Promise<void> {
  try {
    const res = await client().messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Svar kun: ok' }],
    });
    track(res);
  } catch (e) {
    explain(e);
  }
}
