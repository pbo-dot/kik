// "Har jeg set den før?": finder dine egne fund på telefonen. Gratis og uden net.
import type { Find } from './db';

/** Kernen i navnet: "Rav, ca. 3 cm" → "rav", "Rundetårn (København)" → "rundetårn". */
export function baseName(navn: string): string {
  return navn.toLowerCase().split(/[,(–-]/)[0].replace(/[?!.]/g, '').replace(/\s+/g, ' ').trim();
}

/** Samme ting? Ens kerne, eller den ene begynder med den anden ("rav" og "rav med insekt"). */
function same(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `);
}

/** Tidligere fund af det samme, nyeste først. */
export function seenBefore(f: Find, all: Find[]): Find[] {
  if (!f.answer) return [];
  const me = baseName(f.answer.navn);
  return all
    .filter((g) => g.id !== f.id && g.createdAt < f.createdAt && g.answer && same(me, baseName(g.answer.navn)))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Søg i alle fund: navn, kategori, sted, svar, spørgsmål og samtale. */
export function searchFinds(all: Find[], q: string): Find[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const score = (f: Find) => {
    const a = f.answer;
    const head = `${a?.navn ?? ''} ${a?.kategori ?? ''} ${a?.hvor ?? ''} ${f.question ?? ''}`.toLowerCase();
    const body = `${a?.svar ?? ''} ${f.more?.text ?? ''} ${f.chat.map((c) => c.text).join(' ')}`.toLowerCase();
    let s = 0;
    for (const w of words) {
      if (head.includes(w)) s += 2;
      else if (body.includes(w)) s += 1;
      else return 0; // alle ord skal findes
    }
    return s;
  };
  return all
    .map((f) => [f, score(f)] as const)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || b[0].createdAt - a[0].createdAt)
    .map(([f]) => f);
}
