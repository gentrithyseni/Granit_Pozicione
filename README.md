# Graniti Web

Graniti Web është një aplikacion për vlerësimin e ofertave dhe menaxhimin e të dhënave në projekte ndërtimore. Fokusi kryesor është **Libri Ndërtimor**: importi dhe kontrolli i paramasave, rregullimi i ndarjes në faqe, ruajtja e historikut dhe eksporti me shabllonet Excel.

## Funksionalitetet

### Libri Ndërtimor dhe paramasat

- Importon skedarë Excel `.xlsx` dhe `.xls`.
- Lexon fletë të ndryshme dhe identifikon kolonat e pozicionit, përshkrimit, njësisë, sasisë dhe çmimit; mbështet edhe numra të formatuar me presje/pikë evropiane, si `1.234,56`.
- Paraqet pozicionet në preview dhe krahason totalin e llogaritur me totalin e deklaruar në skedar, kur ky i fundit gjendet.
- Planifikon ndarjen automatike në faqe sipas shablloneve origjinale të Librit Ndërtimor. Ndarja mund të përshtatet manualisht: faqet mund të bashkohen, ndahen dhe pozicionet të zhvendosen.
- Eksporton Librin si Excel ose ZIP me skedarë Excel individualë për faqe.
- Ruan historikun e importeve, të dhënat e preview-t dhe faqosjen manuale në Supabase, kur databaza është e konfiguruar.

### Menaxhimi i projekteve dhe ofertave

- Regjistron pozicione dhe llogarit materialin, punën, ushqimin, transportin, shpenzimet tjera, fitimin dhe TVSH-në.
- Menaxhon projekte, kategori, statuset dhe pozicionet; ofron krahasim dhe analizë të të dhënave.
- Paraqet përmbledhje statistikore, trend mujor të ofertave, strukturën e kostove sipas projektit dhe fitimin e pritshëm me vlerat pa TVSH, TVSH-në dhe çmimin përfundimtar.
- Kërkon pozicione sipas përshkrimit, numrit, projektit ose kategorisë.
- Eksporton të dhëna të projektit në CSV dhe backup të të dhënave në JSON.

### Faturat

Krijon faturë kontrate dhe fletëdërgesë duke përdorur shabllonet përkatëse Excel.

## Teknologjitë

- React 18, TypeScript dhe Vite
- React Router 6 dhe React Hook Form
- Supabase për PostgreSQL dhe autentikim
- ExcelJS, SheetJS (`xlsx`) dhe JSZip për import/eksport të Excel-it dhe ZIP-it
- Victory për grafikët dhe Lucide React për ikonat

## Struktura kryesore

- `App.tsx` — rrugët dhe provider-at globalë
- `src/pages/` — faqet e aplikacionit
- `src/components/` — komponentët e ndërfaqes dhe preview-t
- `src/services/` — logjika e shërbimeve dhe qasja në Supabase
- `src/lib/` — llogaritjet, validimi dhe logjika e importit/eksportit
- `public/templates/` — shabllonet Excel të Librit Ndërtimor, faturës dhe fletëdërgesës
- `DOKUMENTI_DIPLOMES.md` dhe `DOKUMENTI_DIPLOMES.html` — dokumentet e punimit të diplomës

## Kërkesat

- Node.js 18 ose më i ri
- npm
- Projekt Supabase i konfiguruar për aplikacionin

## Instalimi dhe nisja lokale

Instalo varësitë:

```bash
npm install
```

Krijo `.env` nga `.env.example` dhe plotëso kredencialet e projektit Supabase:

```powershell
Copy-Item .env.example .env
```

Vlerat e kërkuara janë:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Pastaj nise aplikacionin:

```bash
npm run dev
```

Hap adresën lokale të paraqitur nga Vite (zakonisht `http://localhost:5173`).

### Supabase dhe databaza

Aplikacioni përdor tabelat `projects`, `categories`, `project_items`, `item_expenses`, `price_history`, `libri_exports` dhe `profiles`, si dhe funksionet RPC `save_register_position`, `update_project_position` dhe `mark_approval_notice_seen`.

Ky repository **nuk përmban skemën SQL të databazës ose migrimet**. Për një instalim të ri, duhet të krijohen tabelat, funksionet RPC dhe politikat RLS që përputhen me aplikacionin përpara përdorimit. Mos supozo se konfigurimi i `.env` krijon automatikisht databazën.

Për autentikim, konfiguro Supabase Auth dhe përdoruesit sipas politikës së projektit. Përdoruesit e aplikacionit duhet të kenë vetëm qasjen që lejojnë politikat RLS të databazës.

## Rrugët e aplikacionit

| Rruga | Funksioni |
|---|---|
| `/` | Ballina me statistika, projekte dhe përmbledhje të Librit Ndërtimor |
| `/import` | Importi, preview, faqosja dhe eksporti i Librit Ndërtimor |
| `/register` | Regjistrimi dhe llogaritja e pozicioneve |
| `/data` | Menaxhimi, filtrimi, krahasimi dhe analiza e projekteve/pozicioneve |
| `/search` | Kërkimi global |
| `/fature` | Fatura e kontratës dhe fletëdërgesa |
| `/profile` | Profili, ndryshimi i fjalëkalimit dhe backup-i |
| `/about-us` | Informacion rreth aplikacionit |
| `/login` | Hyrja, regjistrimi dhe rikuperimi i fjalëkalimit |

Faqet kryesore mbrohen me autentikim kur Supabase është i konfiguruar.

## Skriptet

| Komanda | Përshkrimi |
|---|---|
| `npm run dev` | Nis serverin e zhvillimit |
| `npm run build` | Kontrollon TypeScript-in dhe krijon build-in te `dist/` |
| `npm run preview` | Shërben lokalisht build-in |
| `npm test` | Nis Vitest në modalitetin interaktiv |
| `npm exec -- vitest run` | Ekzekuton testet një herë |
| `npm run lint` | Nis ESLint, nëse është i instaluar/konfiguruar |

## Siguria dhe mirëmbajtja

- Mos e vendos `.env` në Git. Çelësi Supabase `anon` përdoret në frontend; kontrolli i qasjes duhet të zbatohet me autentikim dhe politika RLS.
- Importo vetëm skedarë Excel të besuar dhe mbaji varësitë të përditësuara. Versioni `xlsx` i përdorur aktualisht (`0.18.5`) është raportuar nga `npm audit` me advisories të njohura; vlerëso zëvendësimin ose përditësimin e tij përpara përdorimit me skedarë nga burime të panjohura.
- Pas ndryshimeve, verifiko projektin me `npm run build` dhe `npm exec -- vitest run`.

## Dokumenti i diplomës

- [DOKUMENTI_DIPLOMES.md](DOKUMENTI_DIPLOMES.md) — versioni tekstual për editim
- [DOKUMENTI_DIPLOMES.html](DOKUMENTI_DIPLOMES.html) — versioni për hapje në shfletues dhe kopjim në Word

Para dorëzimit, plotëso të dhënat personale/institucionale që mungojnë dhe shto screenshot-e reale të aplikacionit nëse kërkohen.
