# CLAUDE.md

Projektkontekst og regler for Claude Code.

## Formål

Kik er en guide i lommen (PWA) til eget brug: https://pbo-dot.github.io/kik/. Peg telefonen på noget (bygning, kunst, skilt, menukort, plante, produkt, maskine …), og Claude siger, hvad det er, med en kort historie, der kan læses op. Man kan spørge videre med stemmen, få "Fortæl mere" fra nettet, og dagen samles med rute og "Del → Dagbog".

## Opbygning

- React + TypeScript + Vite, `vite-plugin-pwa` (samme stil som pbo-dot/dagbog). Ingen server. Alt gemmes på telefonen i IndexedDB (`src/lib/db.ts`: `finds` og `photos` for sig, så lister er hurtige).
- Claude kaldes direkte fra telefonen med ejerens egen nøgle (`localStorage["kik.claudeKey"]`). Model i `settings.model` (standard `claude-sonnet-5-5`, valgfrit `claude-opus-5-5`). Alle kald har `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`).
- Agenterne (`src/lib/ai.ts`):
  - **Kenderen** `identify()`: billede + koordinater → struktureret svar (`kategori, navn, svar, sikker, bedOm, sted`) med zod, effort low. Fire tilstande (`MODES`): Hvad er det?, Oversæt, Pris og anmeldelser, Hvordan gør jeg?
  - **Opslageren** `tellMore()` og `askAbout()`: websøgning (`web_search_20260209`, højst 4) for "Fortæl mere" og spørgsmål. Pris og Hvordan slår op med det samme.
  - **Skriveren** `writeDay()`: et kort dagbogsafsnit i jeg-form ud fra dagens fund.
- `src/lib/actions.ts` kører arbejdet i baggrunden og gemmer undervejs (`busy`), så man kan skifte skærm. Skærmene lytter med `onChange`/`useData`.
- Billeder: 1280 px JPEG til Claude, 240 px miniature til lister. Sted fra `navigator.geolocation` (kun når der tages et billede eller spørges).
- Tale: `SpeechRecognition` (da-DK) til at spørge, `speechSynthesis` til oplæsning ("Læs svaret op med det samme" under Mere).
- "Del → Dagbog" bruger `navigator.share` med tekst; Dagbog modtager delt tekst som en ny samtale. Dagbog skal ikke ændres.
- Forbrug: skøn ud fra listepriser (`track` i `ai.ts`), pr. fund og pr. måned under Mere.

## Byg og udgivelse

- `npm run build` og `npm run lint` før commit. Test i browser med `npx vite preview` og Playwright med falsk Claude-API (`page.route('https://api.anthropic.com/**')`), både lys og mørk tilstand.
- Læg ændringer på `main`. GitHub Actions udgiver til GitHub Pages (Settings → Pages → Source: GitHub Actions).

## Arbejdsform med ejeren

- Skriv på dansk, kort og i almindeligt sprog. Ejeren er ikke programmør.
- Nye funktioner drøftes og godkendes (gerne med et billede først), før de bygges. Fejlrettelser må laves med det samme.
- Undersøg kendte løsninger, før noget nyt og ukendt bygges, og vælg den mest gennemprøvede med åben licens.
- Sig til med link, når en ændring er ude, og vær ærlig om, hvad der kun kan testes på telefonen (kamera, sted, tale, oplæsning, deling).

## Design (top-design anno 2026)

- Material 3 Expressive i ånden, tilpasset appens egne farver (blå `--pri`).
- Stor, letlæselig skrift og stærk kontrast; lys og mørk tilstand skal begge se godt ud.
- Store trykflader (mindst 44–48 px), runde knapper: fyldt, tonal og tekst.
- Kort uden kanter, store runde hjørner, god luft, ensartede streg-ikoner (`Icon` i `src/ui.tsx`).
- Korte tekster. Bløde overgange, og respektér "reducer bevægelse".

## Senere (idéer, ikke bygget)

- "Har jeg set den før?" (søg i egne fund), guidet tur ("5 ting inden for 1 km"), rejsemappe/hæfte, rav og vejr, deling med familie.
