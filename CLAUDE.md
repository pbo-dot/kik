# CLAUDE.md

Projektkontekst og regler for Claude Code.

## Formål

Kik er en guide i lommen (PWA) til eget brug: https://pbo-dot.github.io/kik/. Peg telefonen på noget (bygning, kunst, skilt, menukort, plante, produkt, maskine …), og Claude siger, hvad det er, med en kort historie, der kan læses op. Man kan spørge videre med stemmen, få "Fortæl mere" fra nettet, og dagen samles med rute og "Del → Dagbog".

## Opbygning

- React + TypeScript + Vite, `vite-plugin-pwa` (samme stil som pbo-dot/dagbog). Ingen server. Alt gemmes på telefonen i IndexedDB (`src/lib/db.ts`: `finds` og `photos` for sig, så lister er hurtige).
- Claude kaldes direkte fra telefonen med ejerens egen nøgle (`localStorage["kik.claudeKey"]`). Model i `settings.model` (standard `claude-sonnet-5-5`, valgfrit `claude-opus-5-5`). Alle kald har `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`).
- Agenterne (`src/lib/ai.ts`):
  - **Kenderen** `identify()`: billede + koordinater → struktureret svar (`kategori, navn, svar, sikker, bedOm, sted, hvor`) med zod, effort low. Fire tilstande (`MODES`): Hvad er det?, Oversæt, Pris og anmeldelser, Hvordan gør jeg?
  - **Opslageren** `tellMore()` og `askAbout()`: websøgning (`web_search_20260209`, højst 4) for "Fortæl mere" og spørgsmål. Pris og Hvordan slår op med det samme.
  - **Skriveren** `writeDay()`: et kort dagbogsafsnit i jeg-form ud fra dagens fund.
- `src/lib/actions.ts` kører arbejdet i baggrunden og gemmer undervejs (`busy`), så man kan skifte skærm. Skærmene lytter med `onChange`/`useData`.
- Billeder: 1280 px JPEG til Claude, 240 px miniature til lister. Sted fra `navigator.geolocation` (kun når der tages et billede eller spørges).
- Tale: `SpeechRecognition` (da-DK) til at spørge, `speechSynthesis` til oplæsning ("Læs svaret op med det samme" under Mere).
- "Del → Dagbog" bruger `navigator.share` med tekst; Dagbog modtager delt tekst som en ny samtale. Dagbog skal ikke ændres.
- **Har jeg set den før?** (`src/lib/seen.ts`): under svaret vises "Set før · N gange" (match på kernen af navnet, `baseName`), og "Se alle" åbner søgningen (`#/soeg/<ord>`). Søgefelt øverst på Dage søger i navn, kategori, sted, svar og samtale. Kun på telefonen, gratis. `hvor` (stednavn) mangler i de første fund.
- **Kort og Find retur** (`src/lib/track.ts`, `src/screens/Kort.tsx`, rute `#/kort`, `#/retur` åbner med pilen): knappen "Kort" på forsiden (eller på sporkortet, mens et spor kører). Kortet følger dig (`follow()` måler sted, mens kortet er åbent, også uden spor); flytter man kortet selv, stopper det, og en rund knap følger igen. Uden spor: "Start spor". Med spor: "gået" og "siden start", "Find retur" (zoomer ud til dig og start, pil, afstand og tid tilbage ad sporet, 4 km/t) og "Skjul pil"; Stop som rund knap i toppen. Sporet gemmes i `localStorage["kik.track"]` (`watchPosition`, mindst 8 m mellem punkter, upræcise over 40 m springes over), skærmen holdes tændt (Wake Lock), og det fortsætter, når Kik åbnes igen. Leaflet + OpenStreetMap (hentes først, når kortet åbnes; mørkt kort via CSS-filter; brikker gemmes 30 dage, cache `kort`). Lommelygte (`torch` i `device.ts`). Browseren kan ikke måle med slukket skærm: huller bliver lige streger. CSP i `index.html` tillader `tile.openstreetmap.org`; kortet sender kun appens adresse som henviser (krav fra OpenStreetMap).
- Browsertest for Kort og Find retur: `node e2e/retur.e2e.cjs` (falsk GPS-tur ved Tisvilde, falske kortbrikker; tjekker at kortet følger, "følg mig"-knappen og at start ses ved Find retur).
- Forbrug: skøn ud fra listepriser (`track` i `ai.ts`), pr. fund og pr. måned under Mere.

## Byg og udgivelse

- `npm run build` og `npm run lint` før commit.
- Browsertest: `e2e/kik.e2e.cjs` (Playwright med falsk Claude-API via `page.route('https://api.anthropic.com/**')`, ingen nøgle eller penge). Kør `npx vite preview --port 4173` og så `node e2e/kik.e2e.cjs`. Den gennemgår billede → svar → Fortæl mere → spørg → spørgsmål uden billede → Skriv dagen → Mere, i lys og mørk tilstand, og gemmer skærmbilleder i `e2e/out/` (ikke i git).
- Læg ændringer på `main`. GitHub Actions udgiver til GitHub Pages (Settings → Pages → Source: GitHub Actions).

## Status (1. november 2026)

- Første udgave er bygget og skubbet. Ejeren skulle slå Pages til (Source: GitHub Actions) og køre udgivelsen igen. Tjek, at https://pbo-dot.github.io/kik/ virker.
- Endnu ikke prøvet på telefonen: ægte Claude-svar på rigtige billeder (kvalitet og pris pr. billede), kamera, sted, tale, dansk oplæsning og Del → Dagbog.
- Skitsen, som første udgave er bygget efter: `docs/forslag-kig.png`.
- Rettet: afbrudte svar (`fixInterrupted` ved start), "Prøv igen" for spørgsmål uden billede, autooplæsning kun af nye svar.
- Udkast: `docs/forslag-set-foer-og-retur.png` og `-mork.png` (kilde: `.html`).
  - **Har jeg set den før?**: bygget.
  - **Find retur**: bygget. Ikke prøvet på telefonen endnu (GPS, kompas, lommelygte, skærm tændt).
- Udkast: `docs/forslag-kort.png` og `-mork.png`: kort, der følger dig. Bygget.

## Om ejeren

- Tester alt på sin Pixel (Chrome). Har også appene Dagbog (pbo-dot/dagbog, under test, må ikke ændres for Kiks skyld) og Lukker.
- Kan lide små trin, en anbefaling og et billede først. Claude foreslår, ejeren godkender.
- Kik startede som en "turguide i naturen", men ejeren ville have den bredere: til alt, man ser ude (by, ferie, butik, hjemme).

## Færdig-tjekliste (før ejeren får besked)

- [ ] `npm run build` og `npm run lint` uden fejl.
- [ ] `node e2e/kik.e2e.cjs` og `node e2e/retur.e2e.cjs` kørt, og skærmbillederne set (lys og mørk).
- [ ] CLAUDE.md opdateret, hvis noget nyt er bygget.
- [ ] Skubbet til `main`, og "Udgiv på GitHub Pages" er grøn.
- [ ] Ejeren har fået linket og en ærlig besked om, hvad der kun kan testes på telefonen.

## Arbejdsform med ejeren

- Skriv på dansk, kort og i almindeligt sprog. Ejeren er ikke programmør.
- Nye funktioner drøftes og godkendes (gerne med et billede først), før de bygges. Fejlrettelser må laves med det samme.
- **Nye, ukendte funktioner:** Skriv ikke fra bunden først. Undersøg kendte løsninger (open source på GitHub, velholdte biblioteker, officiel dokumentation), sammenlign kort 2–3 fremgangsmåder i forslaget, og vælg den mest gennemprøvede. Kun åben licens, og hold appen let.
- **Forslag undervejs:** Kom løbende med korte forslag, når noget gentager sig, kan gå galt eller kan gøres nemmere. Giv en anbefaling og en rækkefølge. Bygges først efter ejerens ja (fejlrettelser dog med det samme).
- **Gennemgang en gang imellem:** Når ejeren beder om det, så tag en rundtur i hele appen med friske skærmbilleder og giv en ærlig vurdering og 3–5 forslag i anbefalet rækkefølge.
- Ejerens design- og arbejdsregler er fælles for alle ejerens apps; Dagbogs CLAUDE.md (pbo-dot/dagbog) er forbilledet.
- Sig til med link, når en ændring er ude, og vær ærlig om, hvad der kun kan testes på telefonen (kamera, sted, tale, oplæsning, deling).

## Design (top-design anno 2026)

- Material 3 Expressive i ånden, tilpasset appens egne farver (blå `--pri`).
- Stor, letlæselig skrift og stærk kontrast; lys og mørk tilstand skal begge se godt ud.
- Store trykflader (mindst 44–48 px), runde knapper: fyldt, tonal og tekst.
- Kort uden kanter, store runde hjørner, god luft, ensartede streg-ikoner (`Icon` i `src/ui.tsx`).
- Korte tekster. Bløde overgange, og respektér "reducer bevægelse".
- Ingen emojis som ikoner, heller ikke i udkast.
- Vis altid et visuelt forslag i både lys og mørk tilstand (`docs/forslag-*.png`), før nye skærme eller større ændringer bygges.

## Senere (idéer, ikke bygget)

- Guidet tur ("5 ting inden for 1 km"), rejsemappe/hæfte (turen som fil), rav og vejr, deling med familie.
- Fra GitHub-kig (nov. 2026, kun inspiration): "Er det A eller B?" ved tvivl (Seek, MuSeeum), samlinger og månedsoversigt (Seek), svaret skrives frem løbende (MyMuseumGuide), pænere oplæsningsstemme (koster).
