# Graniti Web

Graniti Web është një panel administrativ për menaxhimin e **paramasave, ofertave, faturave dhe Librit Ndërtimor** në ndërtim. Projekti përfshin regjistrim manual të pozicioneve, import Excel, preview të ndarjes së faqeve, kërkim global, analizë të të dhënave dhe eksport të rezultateve në Excel, ZIP, CSV dhe JSON.

## Çfarë përfshin projekti

- regjistrim i pozicioneve me kalkulim të materialit, punës, ushqimit, transportit, fitimit dhe TVSH-së,
- import i Excel-it me validim dhe preview,
- gjenerim i Librit Ndërtimor me shabllone dhe ndarje faqeje,
- krijim faturash me shabllone të veçanta,
- dashboard me statistika, grafikë dhe historik,
- kërkim global dhe menaxhim i të dhënave,
- autentikim me Supabase dhe mbrojtje e route-ve,
- backup JSON dhe eksport CSV.

## Stack

- React 18 + TypeScript + Vite 6
- React Router 6
- Supabase (PostgreSQL + Auth + RLS)
- react-hook-form, xlsx, exceljs, jszip, lucide-react, victory, date-fns

## Struktura kryesore

- [App.tsx](App.tsx) për router-in dhe provider-at globalë
- [src/pages](src/pages) për faqet kryesore
- [src/components](src/components) për komponentët e përbashkët dhe preview
- [src/context](src/context) për Auth, Theme dhe Toast
- [src/services](src/services) për logjikën e biznesit dhe thirrjet Supabase
- [src/lib](src/lib) për llogaritje, validim, import/export
- [database-schema.sql](database-schema.sql) për skemën e databazës dhe RLS
- [Fatura](Fatura) dhe [Paramasa](Paramasa) për shabllone dhe materiale shembull
- [DOKUMENTI_DIPLOMES.md](DOKUMENTI_DIPLOMES.md) dhe [DOKUMENTI_DIPLOMES.html](DOKUMENTI_DIPLOMES.html) për dokumentin e diplomës

## Kërkesat

- Node.js 18+
- Llogari [Supabase](https://supabase.com) (projekt i ri ose ekzistues)

## Instalimi

```bash
npm install
cp .env.example .env
```

Plotëso `.env` me URL dhe anon key nga Supabase → **Settings → API**.

## Baza e të dhënave

1. Hap **SQL Editor** në Supabase Dashboard.
2. Ekzekuto skedarin [`database-schema.sql`](database-schema.sql) për tabelat dhe RLS.
3. Në **Authentication → Providers**, aktivizo **Email** (password).
4. Krijo përdoruesin e parë te **Authentication → Users → Add user**.

Skema përfshin tabelat kryesore:

- `categories`
- `projects`
- `project_items`
- `item_expenses`
- `import_history`

Politikat RLS lejojnë vetëm përdorues të **autentifikuar** (`authenticated`).

## Nisja lokale

```bash
npm run dev
```

Hap `http://localhost:5173` dhe hyr me email/fjalëkalim në `/login`.

## Skriptet

| Komanda | Përshkrim |
|---------|-----------|
| `npm run dev` | Server zhvillimi |
| `npm run build` | Build prod (`dist/`) |
| `npm run preview` | Preview i build-it |
| `npm run test` | Testet me Vitest |
| `npm run lint` | Kontrolli i kodit me ESLint |

## Faqet kryesore

| Rruga | Funksioni |
|-------|-----------|
| `/` | Ballina me statistika, status projekte dhe grafikë |
| `/register` | Regjistrim pozicioni me kostot e detajuara |
| `/fature` | Krijim faturash me shabllone |
| `/import` | Ngarkim Excel, preview, eksport Libri Ndërtimor |
| `/data` | Projektet, kategoritë, editimi, krahasimi, CSV |
| `/search` | Kërkim global në pozicione |
| `/profile` | Profili, password change, backup JSON |
| `/login` | Hyrje, regjistrim, recovery password |

## Features

| Funksioni | Përshkrimi |
|-----------|------------|
| Menaxhim projektesh | Krijim, editim, fshirje dhe përditësim i projekteve |
| Regjistrim pozicionesh | Futje manuale me llogaritje të detajuara të kostos |
| Import Excel | Lexim, validim dhe preview i të dhënave nga skedarët Excel |
| Libri Ndërtimor | Gjenerim i faqeve, planifikim dhe eksport i faqeve |
| Faturim | Krijim faturash me dy modele të ndryshme |
| Analizë dhe grafikë | Dashboard, histori çmimesh dhe përmbledhje statistikore |
| Kërkim global | Kërkim në projekte, kategori dhe pozicione |
| Backup / eksport | Export CSV, ZIP, Excel dhe JSON |
| Auth dhe siguri | Login, register, recovery dhe RLS në Supabase |

## Screenshot / Preview

Për versionin final të dorëzimit është mirë të shtohen screenshot-e nga këto pjesë:

- ballina / dashboard,
- faqja e regjistrimit,
- preview i Importit dhe Librit Ndërtimor,
- faqja e të dhënave,
- kërkimi global,
- profili dhe backup-u,
- një screenshot i faqes së faturës.

Nëse i fut në README ose në dokumentin e diplomës, projekti duket më i plotë dhe më bindës vizualisht.

## Dokumenti i diplomës

Për këtë projekt është përgatitur edhe dokumentacion formal:

- [DOKUMENTI_DIPLOMES.md](DOKUMENTI_DIPLOMES.md)
- [DOKUMENTI_DIPLOMES.html](DOKUMENTI_DIPLOMES.html)

Versioni HTML është i përshtatshëm për hapje në browser dhe kopjim në Word, ndërsa versioni Markdown shërben si bazë tekstuale e lehtë për editim.

## Materialet shembull

- [Fatura](Fatura) për shabllonet e faturave
- [Paramasa](Paramasa) për skedarët Excel të paramasave dhe Librit Ndërtimor

## Shënim sigurie

Mos commit-o `.env`. Çelësi `anon` është publik në frontend; mbrojtja vjen nga **Auth + RLS**, jo nga fshehja e key-it.

## Zhvillim i mëtejshëm

- PDF eksport më i avancuar
- role të ndryshme përdoruesish
- raporte dhe grafikë shtesë
- integrim me module financiare
- audit log më i plotë për ndryshimet

## Si ta përdorësh si temë diplome

1. Përdor [DOKUMENTI_DIPLOMES.html](DOKUMENTI_DIPLOMES.html) si bazë për Word, pastaj shto faqen e titullit dhe përmbajtjen automatike.
2. Shto screenshot-e reale nga aplikacioni në seksionin e figurave.
3. Vendos emrin, mbiemrin, mentorin dhe institucionin në fushat e zbrazëta.
4. Nëse profesori kërkon raport më të gjatë, zgjero kapitullin e testimit dhe vlerësimit me shembuj konkretë.
5. Ruaje [DOKUMENTI_DIPLOMES.md](DOKUMENTI_DIPLOMES.md) si version pune dhe [DOKUMENTI_DIPLOMES.html](DOKUMENTI_DIPLOMES.html) si version për kopjim në Word.

