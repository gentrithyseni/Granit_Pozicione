# Udhëzuesi i plotë teknik i Graniti Web

Ky udhëzues shpjegon si funksionon versioni aktual i projektit: nisjen e aplikacionit, faqet dhe komponentët, rrjedhën e të dhënave, llogaritjet financiare, Supabase-in dhe përpunimin e Excel-it. Qëllimi është të mund ta mësosh sistemin dhe ta shpjegosh, jo vetëm të dish emrat e teknologjive.

Përshkrimet bazohen në skedarët që gjenden aktualisht në repository. Dokumenti i diplomës është material shpjegues për punimin; nuk e përcakton sjelljen e programit nëse kodi vepron ndryshe.

## 1. Çfarë është sistemi?

Graniti Web është një aplikacion React/TypeScript për organizimin e ofertave dhe dokumenteve të projekteve ndërtimore. Ai:

- regjistron pozicione pune dhe kostot përbërëse të tyre;
- llogarit çmimin e ofertës, fitimin e planifikuar dhe TVSH-në;
- ruan projekte, kategori dhe pozicione në Supabase;
- lejon kërkimin, filtrimin, krahasimin dhe analizën e ofertave;
- lexon paramasa dhe Libra Ndërtimorë nga Excel;
- krijon ose rregullon faqosjen e Librit Ndërtimor dhe eksporton Excel/ZIP;
- plotëson shabllone Excel për faturë kontrate dhe fletëdërgesë;
- menaxhon hyrjen, aprovimin e llogarive, profilin, temën dhe njoftimet.

Nuk është sistem që nxjerr sasitë nga vizatimet, nuk është kontabilitet dhe nuk konfirmon pagesa. Vlerat financiare varen nga të dhënat e regjistruara ose importuara dhe nga konfigurimi real i Supabase-it.

## 2. Arkitektura me një shikim

```text
index.html
  └── src/main.tsx
      └── App.tsx
          ├── ThemeProvider
          ├── AuthProvider
          ├── ToastProvider
          ├── BrowserRouter
          └── faqet (pages)
              ├── komponentët (components)
              ├── shërbimet (services)
              ├── llogaritjet/parser-at/eksportuesit (lib)
              └── Supabase ose skedari që shkarkohet në shfletues
```

- **`pages/`**: orkestrojnë ekranet, state-in e tyre, ngarkimin e të dhënave dhe veprimet e përdoruesit.
- **`components/`**: ndërfaqe të ripërdorshme ose pjesë më të vogla të faqeve.
- **`services/`**: punë me të dhënat dhe Supabase-in; disa faqe megjithatë bëjnë edhe query drejtpërdrejt.
- **`lib/`**: formula, parser-a, validim, organizim faqesh dhe shkrim/skarkim dokumentesh.
- **`context/` dhe `hooks/`**: state global dhe qasje e tipizuar te ai state.
- **`types/` dhe `constants/`**: format e të dhënave dhe vlera të përbashkëta.
- **`public/templates/`**: shabllonet që shkarkuesit i lexojnë drejtpërdrejt nga browser-i.

Nuk ka një API/server të veçantë të aplikacionit në këtë repository. Browser-i përdor Supabase SDK-në drejtpërdrejt; qasja në databazë duhet të kufizohet nga autentikimi dhe politikat RLS të konfigurimit Supabase.

## 3. Rrjedhat kryesore të sistemit

### 3.1 Nisja, rrugët dhe kontrolli i hyrjes

1. `index.html` krijon elementin `#root` dhe ngarkon `src/main.tsx`.
2. `src/main.tsx` e monton `<App />` në DOM brenda `React.StrictMode`.
3. `App.tsx` vendos provider-at globalë, router-in dhe rrugët. Faqet ngarkohen me lazy loading; gjatë ngarkimit paraqitet `LoadingScreen`.
4. `/login` është rruga publike. Ballina dhe faqet funksionale mbrohen nga `ProtectedRoute`; rruga e panjohur paraqet `NotFoundPage`.
5. `AuthProvider` lexon sesionin ekzistues dhe dëgjon ndryshimet e Supabase Auth. Nëse ende po e kontrollon sesionin, `ProtectedRoute` pret; nëse përdoruesi nuk është i kyçur, ridrejton te login.
6. Në mungesë të konfigurimit Supabase, `supabase` është `null`. Sjellja nuk është e njëjtë në çdo service: disa japin lista/vlera bosh, disa japin gabim. Rruga e mbrojtur lejon kalimin pa autentikim kur Supabase s’është konfiguruar, prandaj kjo mënyrë është për zhvillim, jo provë që ekziston siguri pa server.

### 3.2 Autentikimi, llogaritë dhe aprovimi

- `LoginPage` ka forma për hyrje, krijim llogarie, rikthim fjalëkalimi dhe vendosje fjalëkalimi pas email-it të rikuperimit.
- Hyrja fillimisht kontrollon numrin e tentimeve të dështuara për email në shfletues dhe më pas dërgon kërkesën te Supabase Auth. Pas kredencialeve, konteksti kontrollon profilin dhe statusin e tij; llogaritë që s’janë të aprovuara nuk trajtohen si përdorues normalë të aplikacionit.
- Krijimi i llogarisë ruan emrin si metadata të përdoruesit dhe mund të kërkojë konfirmim email-i dhe/ose aprovim administratori, varësisht konfigurimit Supabase.
- Faqja e profilit i lejon përdoruesit të ndryshojë fjalëkalimin. Para ndryshimit verifikohen përputhja e fjalëkalimeve të reja dhe që i riu të mos jetë i njëjtë me aktualin; `changePassword` ri-autentikon me fjalëkalimin aktual dhe pastaj kërkon përditësimin. Forma pastrohet vetëm pas suksesit.
- Profili me rolin `admin` dhe statusin `approved` mund të shohë listën e përdoruesve dhe të ndryshojë statuset sipas kontrolleve në UI. Këto kontrolle të UI-së nuk e zëvendësojnë RLS/politikat e databazës.
- Rikuperimi i fjalëkalimit dhe ndryshimi i fjalëkalimit janë dy hapa të ndryshëm: i pari dërgon email; i dyti vendos fjalëkalimin e ri pas rikthimit ose pas verifikimit të fjalëkalimit aktual.

**Kujdes:** kufizimi i tentimeve i ruajtur në `localStorage` është masë e anës së browser-it, jo mbrojtje server-side kundër sulmeve. Supabase Auth dhe konfigurimi i tij mbeten autoriteti real për kredencialet.

### 3.3 Regjistrimi i pozicionit dhe formula financiare

`RegisterPage` përgatit formën dhe preview-n; `PricingPreview` paraqet rezultatet; `calculatePositionPrice` në `lib/pricing.ts` është formula e përbashkët që përdoret edhe kur redaktohet pozicioni në `DataPage`.

Për input-et:

- `q` = sasia e pozicionit;
- `m` = çmimi i materialit për njësi;
- `p` = çmimi i punës për njësi;
- `d` = ditët e punës;
- `u` = ushqimi për ditë;
- `t` = transporti për ditë;
- `o` = shpenzimet tjera fikse për këtë pozicion;
- `f` = përqindja e fitimit;
- `v` = përqindja e TVSH-së.

Llogaritja është:

```text
Materiali       = q × m
Puna            = q × p
Ushqimi         = d × u
Transporti      = d × t
Të tjera        = o
Nëntotali       = material + punë + ushqim + transport + të tjera
Fitimi          = nëntotali × f / 100
Baza e TVSH-së  = nëntotali + fitimi
TVSH            = baza e TVSH-së × v / 100
Totali i ofertës= baza e TVSH-së + TVSH
Çmimi për njësi = totali / q (kur q > 0)
```

Kjo është arsyeja pse ushqimi dhe transporti shumëzohen me ditë, jo me sasi; “Të tjera” regjistrohet si shumë fikse për pozicion. Nëse TVSH-ja mungon, formula e përdor 18% si parazgjedhje; një vlerë e futur zero mbetet zero.

Pas submit-it, `saveRegisterRow` bën validimet e veta, siguron projektin/kategorinë dhe thërret RPC-në `save_register_position` me të dhënat e pozicionit dhe pesë zëra të shpenzimeve. Qëllimi i RPC-së është t’i ruajë të lidhura të dhënat përkatëse në një veprim databaze. Nëse RPC dështon ose nuk kthen identifikuesit e pritur, submit-i shfaq gabim dhe forma nuk pastrohet. Në sukses rifreskohen kategoritë, pastrohen fushat e përshkrimit/krijimit të projektit/kategorisë së re, ndërsa projekti, kategoria dhe vlerat e tjera mbahen gati për regjistrimin pasues. Ruajtja e snapshot-it të çmimit bëhet pas RPC-së; nëse ajo dështon, pozicioni mund të jetë ruajtur megjithëse historiku raporton gabim veçmas.

### 3.4 Menaxhimi i të dhënave dhe financat e projektit

`DataPage` ngarkon projektet më të rejat të parat, kategoritë standarde dhe pozicionet. Përdoruesi mund të filtrojë statusin/emrin, të zgjedhë një projekt ose kategori, të kërkojë pozicione, t’i redaktojë/fshijë dhe të eksportojë CSV.

- Zgjedhja e projektit ngarkon pozicionet dhe `item_expenses`; përzgjedhja e kategorisë i grupon pozicionet sipas projektit.
- `detailRequestId` pengon përgjigjet e vjetra të kërkesave asinkrone që të mbishkruajnë përzgjedhjen më të re.
- Redaktimi lexon kostot ekzistuese, rillogarit çmimin me të njëjtën formulë, thërret `update_project_position` për pozicionin dhe shpenzimet dhe pastaj regjistron një snapshot të ri. Snapshot-i shtohet; nuk mbishkruan historikun e vjetër.
- Projekti mban veçmas metadata si klienti, statusi, përshkrimi, kostoja reale finale dhe shënimet mbi të.
- “Oferta pa TVSH” nxirret nga totali i pozicioneve duke hequr TVSH-në sipas përqindjes së secilit pozicion. TVSH-ja e shfaqur është diferenca mes ofertës me dhe pa TVSH.
- Fitimi i pritshëm kundrejt kostove të regjistruara llogaritet vetëm kur ekzistojnë kostot e nevojshme; mungesa e kostos nuk nënkupton kosto zero.
- Kostoja reale finale është shumë që përdoruesi e fut për projektin pasi i di shpenzimet reale. Fitimi paraprak në formular është oferta pa TVSH minus atë kosto reale; ruajtja e projektit e rifreskon analizën.
- Grafiku i trendit në këtë faqe paraqet vlerën aktuale të ofertave sipas muajit kur është krijuar projekti. Nuk tregon pagesa të pranuara dhe nuk është grafik i fitimit.

`PriceHistoryDashboard` sot përdor emrin historik të komponentit, por paraqet strukturën e kostove dhe fitimin e pritshëm: kostot sipas materialit/punës/ushqimit/transportit/të tjerave, vlerën pa TVSH, TVSH-në, totalin me TVSH dhe navigim një projekt në herë. Të dhënat e tij merren nga `fetchProfitSummaryByProject`, i cili grumbullon shpenzimet aktuale, jo rreshtat e tabelës `price_history` si seri kohore.

### 3.5 Kërkimi

`SearchPage` pret që përdoruesi të shkruajë së paku dy karaktere. Ka debounce 350 ms që të mos dërgojë kërkesë në çdo tast; nëse query ndryshon, timer-i i vjetër anulohet dhe rezultati i vjetër nuk duhet të zëvendësojë atë të ri. `searchPositions` kërkon te përshkrimi/numri i pozicionit dhe zgjeron rezultatet për projektet/kategoritë përkatëse, i deduplikon sipas ID-së dhe i rendit më të rejat të parat. UI-ja përmbledh numrin e projekteve, kategorive dhe shumën e vlerave të rezultateve.

Rezultatet e kërkimit janë pozicione të ruajtura; shuma e tyre nuk është domosdo totali i një oferte unike, sepse disa pozicione mund t’i përkasin projekteve të ndryshme.

### 3.6 Ballina dhe statistikat

`HomePage` nis disa lexime të pavarura për statistika, projekte të përfunduara, vlerë totale, historikun e Librit dhe përmbledhje të projekteve/kategorive/transportit. Përdor `Promise.all` për pjesë të leximeve të lidhura; gabimet paraqiten në dashboard, ndërsa një flamur `active` ndalon state-update pas çmontimit të faqes.

Ballina ofron:

- numrin e projekteve, kategorive dhe pozicioneve;
- vlerën e përgjithshme të pozicioneve;
- projektet e ndara sipas statusit;
- përmbledhje/grafikë të vlerës sipas projektit, kategorisë dhe qytetit të transportit;
- statistikat e historikut të Librit dhe eksportin e fundit;
- lidhje të shpejta te regjistrimi, fatura, importi dhe menaxhimi i të dhënave.

Statistikat në Home janë përmbledhje të të dhënave të ruajtura; nuk janë zëvendësim i raportit financiar ose provë e pagesave.

### 3.7 Importi, faqosja dhe eksporti i Librit Ndërtimor

Rrjedha kryesore është:

```text
skedari XLS/XLSX
  → parseExcelWithValidation (SheetJS)
  → ParsedRow[] + metadata/total i deklaruar
  → grupim sipas seksionit dhe plan automatik të faqeve
  → preview dhe ndërhyrje manuale
  → ruajtje e rekordeve/layout-it në libri_exports (nëse Supabase ekziston)
  → shkrim i workbook-ut nga shabllonet me ExcelJS
  → shkarkim XLSX ose ZIP
```

1. `excel.ts` lexon workbook-un, shqyrton sheet-et dhe përpiqet të gjejë kolonat sipas emrave të njohur shqip dhe gjuhëve/formatimeve të tjera. Numrat me presje/pikë normalizohen; rreshtat bosh, nënshkrimet dhe totalet nuk trajtohen si pozicione normale.
2. Në tabelat e strukturuara parser-i dallon kolonat dhe kufijtë e seksioneve/tabelave. Ka degë për formate të vjetra. Kur has format të Librit Ndërtimor, përdor parser-in specifik që nxjerr edhe matjet dhe metadata-n.
3. Totali i deklaruar në workbook krahasohet me totalin e llogaritur. Mospërputhja shfaq paralajmërim, jo domosdo refuzim të importit.
4. `paramasaPreview.ts` dallon seksione, ndërsa `libriExportPlan.ts` dhe `libriPaging.ts` krijojnë planin real të Librit: faqet duhet t’i ruajnë rreshtat e burimit një herë secilin, pa kaluar kapacitetin e shabllonit. Paketuesi provon shabllonet nga kapaciteti më i madh drejt më të voglit; përshkrimi tepër i gjatë mund të dalë me paralajmërim overflow.
5. `ParamasaPreview` shfaq rreshtat dhe faqet. `libriPlanEditor.ts` mbështet bashkim/ndarje/zhvendosje. Operacionet e pasakta raportohen në UI. Plani i ruajtur serializohet me indekse të rreshtave; gjatë rikthimit validohet mbulimi i rreshtave dhe struktura.
6. Faqosja manuale e importit ruhet në metadata-n e rekordit të eksportit. Historiku ruan rows, metadata, numrin dhe vlerën e llogaritur; nuk ruan workbook-un origjinal binar.
7. `libriExport.ts` ngarkon shabllonet XLSX nga `public/templates`, klonon pamjen/stilet e sheet-it dhe vendos metadata, pozicione dhe matje në qelizat përkatëse. Eksporti mund të jetë workbook me disa faqe ose ZIP me një XLSX për faqe. Mund të shkarkohet edhe faqe e vetme.
8. `ManualPageBuilder` është rrugë e veçantë për ndërtim manual të faqeve: të dhënat e tij janë lokale në formë dhe nuk krijojnë automatikisht rekord historiku.

Parser-i nuk mund të garantojë se çdo Excel i çrregullt ka të njëjtën strukturë. Gjithmonë kontrollo preview-n, totalet, matjet dhe faqet para se t’i dorëzosh dokumentet.

### 3.8 Fatura e kontratës dhe fletëdërgesa

`InvoicePage` menaxhon dy forma lokale:

- **Faturë kontrate**: të dhëna të lëshuesit, klientit, numrit/datës, kontratës dhe shumës.
- **Fletëdërgesë/pozicione**: header i përbashkët dhe rreshta me përshkrim, njësi, sasi e çmim.

Ndërrimi i llojit pastron gabimet e validimit, por nuk i fshin automatikisht vlerat e formës tjetër. Para eksportit, `faturaValidation.ts` kontrollon fushat e detyrueshme dhe vlerat numerike. Për fletëdërgesë duhet të ketë së paku një rresht aktiv me përshkrim, njësi, sasi dhe çmim të vlefshëm.

`faturaExport.ts` ngarkon template-in përkatës nga `public/templates`, mbush qelizat pa humbur formatimin bazë dhe shkarkon XLSX. Rreshtat e fletëdërgesës shumëzohen sasi × çmim; rreshtat shtesë mund të futen/stilizohen përtej katër rreshtave fillestarë. Fatura nuk ruhet në databazë nga kjo rrjedhë. Në eksportin e kontratës përdoret formula e vendosur në kod për të ndarë shumën me TVSH nga baza dhe TVSH-ja; kontrollo shifrat para përdorimit zyrtar.

### 3.9 Profili, backup-i dhe preferencat

- `ProfilePage` paraqet gjendjen e llogarisë, veprimet e fjalëkalimit, backup-in JSON dhe mjetet e administrimit kur roli/statusi e lejojnë.
- `exportAllDataJson` lexon faqet e të dhënave për tabelat e aplikacionit dhe shkarkon backup me version. Nuk është dump i plotë i Supabase: nuk përfshin profilet e përdoruesve dhe nuk zëvendëson backup-in e databazës.
- `ThemeProvider` ruan preferencën light/dark në `localStorage` dhe vendos klasën/atributin e temës në `documentElement`.
- `ToastProvider` paraqet njoftimet globale. `showSavedToast` është njoftim suksesi për disa ruajtje/përditësime: bën scroll të butë në krye, jo reload të browser-it. Fshirjet dhe shkarkimet përdorin njoftim të zakonshëm.
- `audit.ts` regjistron në `localStorage` disa rregullime manuale/automatike të targetit të çmimit. Nuk është audit log i databazës dhe nuk duhet trajtuar si histori e pakontestueshme.

## 4. File-by-file: konfigurimi dhe skedarët në root

| Skedari | Roli dhe lidhja me pjesët e tjera |
|---|---|
| `App.tsx` | Përbërësi rrënjë: provider-at, router-i, route-t publike/mbrojtura, lazy import-et dhe loading-u i faqeve. Lidh të gjitha faqet me sistemin global. |
| `index.html` | Shell-i HTML i Vite-it: metadata, titulli, manifesti, ikona, fontet, `#root` dhe entry script-i `src/main.tsx`. Nuk përmban logjikë të databazës. |
| `package.json` | Emri/versioni, komandat `dev`, `build`, `test`, `preview`, `lint`, si dhe varësitë React/Supabase/Excel/Victory. Shih shënimet e testimit për mungesën e test-file-ve aktuale. |
| `package-lock.json` | Mbyll versionet konkrete të varësive për instalim të përsëritshëm me npm. Nuk është kod aplikacioni. |
| `tsconfig.json` | Aktivizon TypeScript strict, target/module modern dhe konfigurimin JSX; përfshin `App.tsx` dhe `src`, përjashton testet nëse gjenden. |
| `vite.config.ts` | Konfiguron plugin-in React, hosts për zhvillim dhe ndarjen e disa vendor chunks në build. Nuk konfiguron kredencialet e Supabase. |
| `.env.example` | Shembull me emrat `VITE_SUPABASE_URL` dhe `VITE_SUPABASE_ANON_KEY`; plotësohet lokalisht në `.env`, i cili përjashtohet nga Git. |
| `.gitignore` | Përjashton `node_modules`, build-in, `.env`, log-et dhe cilësimet lokale të editorëve. |
| `.hintrc` | Konfigurim i vogël për HTMLHint që injoron URL-të te `node_modules`; nuk ka komandë HTMLHint në `package.json`. |
| `README.md` | Udhëzuesi i instalimit, kërkesave, rrugëve, Supabase-it dhe veçorive. Thotë se schema SQL/migrimet nuk janë pjesë e repository-t. |
| `DOKUMENTI_DIPLOMES.md` | Drafti tekstual i punimit të diplomës; burim për redaktim të përmbajtjes akademike, jo modul i aplikacionit. |
| `DOKUMENTI_DIPLOMES.html` | Versioni HTML i draftit të diplomës për shfletim/printim; duhet mbajtur në përputhje me Markdown-in sipas kërkesës akademike. |
| `KODI_DHE_REFACTOR_GUIDE.md` | Udhëzues i mëparshëm për strukturën/refactor-in. Disa seksione i referohen skedarëve që nuk gjenden më në tree-n aktual; ky dokument i ri përshkruan tree-n aktual. |
| `Picture1 - Megrant.png` | Imazh marke i ruajtur në root. Nuk është vetë komponent UI; përdorimi aktiv i markës bëhet nga asetet te `public/`. |
| `tmp-new.xlsx`, `tmp-old.xlsx` | Workbook-e me emra të përkohshëm. Nuk u gjetën referenca në kodin runtime; mos i ngatërro me template-t zyrtare të eksportit. |

## 5. File-by-file: kodi burimor

### Nisja, faqet dhe stilet

| Skedari | Çfarë bën dhe me çfarë lidhet |
|---|---|
| `src/main.tsx` | Monton `<App />` në `#root` dhe aktivizon `React.StrictMode`. |
| `src/vite-env.d.ts` | Ngarkon tipet e ambientit Vite, përfshirë `import.meta.env`. |
| `src/styles.css` | Stilet globale të layout-it, sidebar-it, formularëve, tabelave, grafikëve, modalëve, temave light/dark dhe përshtatjes responsive. Përdoret nga i gjithë aplikacioni; nuk mban state ose logjikë financiare. |
| `src/pages/HomePage.tsx` | Ballina: ngarkon statistika nga `stats`, `insights`, `projects`, `categories`, `libriExports`; shfaq statuset, grafikët, Librin e fundit dhe shkarkimin e tij. Përdor `InsightsCharts`, `StatusBadge` dhe llogaritje prezantimi lokale. |
| `src/pages/RegisterPage.tsx` | Forma e regjistrimit të pozicionit; përdor React Hook Form, `calculatePositionPrice`, `saveRegisterRow`, kategoritë/statuset/transportin dhe `PricingPreview`. Pas ruajtjes rifreskon kategoritë dhe pastron vetëm fushat e caktuara për regjistrimin vijues. |
| `src/pages/DataPage.tsx` | Faqja më e gjerë e të dhënave: projekte/kategori/pozicione, filtrime, editim, fshirje, kosto reale, krahasime, CSV dhe analiza. Lidh drejtpërdrejt Supabase-in me `projects`, `categories`, `item_expenses`, `insights`, `priceHistory` dhe komponentët e analizës. |
| `src/pages/SearchPage.tsx` | UI e kërkimit live; debounce, gjendje loading/error/empty, përmbledhje rezultatesh dhe tabelë. Delegon kërkimin te `services/search.ts`. |
| `src/pages/ImportPage.tsx` | Orkestron upload-in e Excel-it, preview, metadata, planifikimin manual/automatik, historikun dhe shkarkimet XLSX/ZIP. Përdor `excel`, `libriExportPlan`, `libriPlanEditor`, `libriExports`, `ParamasaPreview` dhe `ManualPageBuilder`. |
| `src/pages/InvoicePage.tsx` | Menaxhon format e faturës kontratë dhe fletëdërgesës; validon input-et, zgjedh writer-in përkatës dhe nis shkarkimin e workbook-ut. |
| `src/pages/LoginPage.tsx` | Ndërfaqja e autentikimit me gjendje të ndryshme për login/regjistrim/rikuperim; thërret metodat e `useAuth` dhe shfaq error/success. |
| `src/pages/ProfilePage.tsx` | Profili, ndryshimi i fjalëkalimit, backup JSON dhe paneli i aprovimit/menaxhimit të përdoruesve. Përdor `AuthContext`, `userManagement` dhe `projects` për backup. |
| `src/pages/AboutUsPage.tsx` | Mbështjell `CompanyHomeIntro` në `Shell`; faqja informative për kompaninë dhe aplikacionin. |
| `src/pages/NotFoundPage.tsx` | Faqja 404 për URL të panjohur, me lidhje kthimi në ballinë. |

### Komponentët UI

| Skedari | Çfarë bën dhe ku përdoret |
|---|---|
| `src/components/Shell.tsx` | Layout i faqeve të brendshme: sidebar/navigim, toggle teme, dalje nga llogaria dhe `<main>` për faqen. Përdoret nga shumica e pages. |
| `src/components/ProtectedRoute.tsx` | Kontrollon Supabase-config, gjendjen e ngarkimit dhe `user`; paraqet loading, ridrejton te login ose shfaq fëmijën. |
| `src/components/LoadingScreen.tsx` | Ekran i përbashkët ngarkimi me brand, titull dhe përshkrim; përdoret për lazy-load dhe kontroll autentikimi. |
| `src/components/StatusBadge.tsx` | Shfaq etiketën/ngjyrën e statusit duke përdorur `projectStatus.ts`; statusi bosh trajtohet si draft. |
| `src/components/PositionCard.tsx` | Kartë e pozicionit në Data: detaje, shpenzime, editim, krahasim, anulim dhe fshirje. Callback-et e `DataPage` bëjnë ruajtjen reale; disa rregullime regjistrohen në auditimin lokal. Ka një import të `EditModal`, por nuk e renderon në JSX-in aktual. |
| `src/components/EditModal.tsx` | Wrapper i thjeshtë modal me titull, mbyllje dhe përmbajtje të dhënë si child; eksportohet default/named. Në versionin aktual nuk u gjet përdorim JSX i komponentit, prandaj duket i papërdorur. |
| `src/components/PricingPreview.tsx` | Paraqet ndarjen nga `PricingBreakdown`: kosto, fitim, TVSH, çmim për njësi dhe total; nuk bën ruajtje. |
| `src/components/ComparePositions.tsx` | Merr një listë pozicionesh dhe dy ID të zgjedhura; krahason përshkrimin, sasinë, çmimin për njësi/total dhe datat. State-i i zgjedhjes mbahet nga `DataPage`. |
| `src/components/CategoryProjectCompare.tsx` | Përmbledh vlerat e një kategorie të grupuara sipas projektit; nxjerr mesatare për njësi, total dhe diferencën kundrejt grupit me subtotal më të lartë. |
| `src/components/InsightsCharts.tsx` | KPI dhe grafikët e ballinës për vlerë projekti/kategorie, shpërndarje pozicionesh dhe qytetin e transportit; të dhënat vijnë nga `services/insights`. |
| `src/components/RevenueTrendChart.tsx` | Paraqet vlerën mujore të ofertave për gjashtë muaj, filtrin e statusit dhe metrikat e muajit; shpjegon që nuk janë pagesa apo fitim. |
| `src/components/PriceHistoryDashboard.tsx` | Përmbledh strukturën e kostove dhe fitimin e pritshëm; kërkon `fetchProfitSummaryByProject` dhe rifreskohet me `refreshKey`. Emri historik “PriceHistory” nuk do të thotë se kjo pamje vizaton seri të `price_history`. |
| `src/components/CompanyHomeIntro.tsx` | Përmbajtja prezantuese e kompanisë: shërbimet, misioni, partnerët dhe lidhjet te kërkimi/të dhënat. |
| `src/components/ParamasaPreview.tsx` | Preview i pozicioneve/faqeve të importuara; ndërfaqe për paralajmërimet, shkarkimin/printimin e faqes dhe modifikimin manual të planit përmes callback-eve. |
| `src/components/ManualPageBuilder.tsx` | Krijon faqe Libri manualisht në state të vet: zgjedh template, shton rreshta, ndan në faqe dhe lejon preview/shkarkime individuale. E ndarë nga importi dhe historiku i tij. |

### Context-et dhe hooks

| Skedari | Përgjegjësia |
|---|---|
| `src/context/AuthContext.tsx` | Sesioni/user/profile, login, regjistrim, rikuperim/ndryshim fjalëkalimi, sign-out dhe logjika e aprovimit; mbështetet te Supabase Auth dhe `userManagement`. |
| `src/context/ThemeContext.tsx` | State i temës light/dark; lexon/shkruan `localStorage` dhe vendos klasën/atributin në elementin HTML. |
| `src/context/ToastContext.tsx` | Menaxhon toasts globale, timer-at, mbylljen dhe `showSavedToast` për ruajtje të suksesshme. |
| `src/hooks/useAuth.ts` | Qasje e tipizuar te AuthContext; hedh gabim kur përdoret jashtë provider-it. |
| `src/hooks/useTheme.ts` | Qasje e tipizuar te ThemeContext; hedh gabim kur përdoret jashtë provider-it. |

### Konstante, tipe dhe ndërfaqe me shërbime

| Skedari | Çfarë përkufizon |
|---|---|
| `src/constants/defaultCategories.ts` | Emrat/përshkrimet e kategorive standarde që service-i i kategorive siguron në databazë. |
| `src/constants/projectStatus.ts` | Statuset `draft`, `in_progress`, `completed`, union type dhe etiketat për UI. |
| `src/constants/transport.ts` | Qytetet dhe çmimet fikse të transportit që përdor forma e regjistrimit. |
| `src/types/database.ts` | Modelet TypeScript për projektet, profilet, kategoritë, pozicionet, expense, summary, search dhe Libri/price history. Nuk validon përgjigjen runtime të Supabase-it. |
| `src/types/fatura.ts` | Modelet/defaults për header-in, lëshuesin, faturën kontratë dhe rreshtat e fletëdërgesës. |
| `src/types/paramasaMeta.ts` | Forma TypeScript e metadata-s së paramasës/Librit që rrjedh në import, preview dhe eksport. |
| `src/types.ts` | Tipe të përgjithshme/legacy për `Project`, `Position`, `Category`, `ReferenceEntry` dhe temë. Nuk u gjet përdorim i këtyre modeleve nga importet aktuale të aplikacionit; mos i ngatërro me modelet aktive te `types/database.ts`. |

### Services

| Skedari | Çfarë bën dhe cilat faqe e përdorin |
|---|---|
| `src/services/categories.ts` | Siguron kategoritë standarde, normalizon emrat/dublikatat, fshin kategori dhe grupon pozicione sipas projektit. Home/Register/Data e përdorin. Cache-i invalidizohet kur ka ndryshime përkatëse. |
| `src/services/projects.ts` | Merr projektet e përfunduara, përditëson/fshin projekte e pozicione dhe krijon backup JSON të tabelave të të dhënave. Home/Data/Profile e përdorin. Sjellja cascade varet nga foreign keys në databazë. |
| `src/services/register.ts` | Validon dhe llogarit rreshtin e regjistrimit, përgatit payload-et e shpenzimeve, thërret `save_register_position` dhe më pas tenton snapshot-in e çmimit. |
| `src/services/search.ts` | Kërkon pozicione sipas tekstit/numrit/projektit/kategorisë, bashkon dhe deduplikon rezultatet. Përdoret nga SearchPage. |
| `src/services/stats.ts` | Numëron projekte, kategori dhe pozicione për KPI-të e ballinës; mungesa e Supabase kthen zero, gabimet e query raportohen. |
| `src/services/insights.ts` | Agregon vlerat e projekteve/kategorive, përdorimin e transportit, totalin e sistemit dhe trendin 6-mujor. HomePage dhe DataPage i përdorin. |
| `src/services/priceHistory.ts` | Shkruan snapshot-e në `price_history` dhe ndërton analizën financiare nga `project_items`/`item_expenses`; mban edhe renditjen e projekteve për pamjen e fitimit. |
| `src/services/libriExports.ts` | Ruajtje/lexim/fshirje historiku të importeve; ruan rows/meta/layout-et e faqes, harton rezultatet nga Supabase dhe memoizon historikun përkohësisht. ImportPage/HomePage e përdorin. |
| `src/services/export.ts` | Merr pozicionet e një projekti dhe krijon shkarkim CSV; jep rezultat suksesi/gabimi për DataPage. |
| `src/services/userManagement.ts` | Lexon profilin/listën e profileve dhe përditëson aprovimin/statusin përmes Supabase, për AuthContext/ProfilePage. |

### Algoritmet dhe funksionet e pavarura (`lib/`)

| Skedari | Përgjegjësia dhe lidhjet |
|---|---|
| `src/lib/supabase.ts` | Lexon dy environment variables, llogarit `hasSupabaseConfig` dhe eksporton klientin ose `null`. Është kufiri kryesor i konfigurimit frontend. |
| `src/lib/cache.ts` | Cache i thjeshtë në memorie me TTL dhe invalidim sipas çelësit; përdoret nga kategoritë dhe historiku i Librit, jo si databazë e qëndrueshme. |
| `src/lib/pricing.ts` | Formula e kostove/fitimit/TVSH-së dhe helper-i për heqjen e TVSH-së nga një total bruto. Përdoret nga regjistrimi, preview dhe redaktimi. |
| `src/lib/audit.ts` | Shton/lexon/fshin regjistrat lokalë të rregullimeve të çmimit në `localStorage`; nuk është audit log i sigurt/server-side. |
| `src/lib/dates.ts` | Formatim date-time për locale shqip dhe kontroll nëse `updated_at` është më shumë se dy sekonda pas krijimit. |
| `src/lib/excel.ts` | Parser i workbook-ut me SheetJS: zbulon kolonat, lexon numrat, formatet strukturore/legacy dhe totalet; kthen rreshta të normalizuar për import. |
| `src/lib/libriNdertimor.ts` | Parser specifik i formatit ekzistues të Librit Ndërtimor; nxjerr metadata, pozicione dhe rreshta matjesh nga sheet-i. Përdoret nga `excel.ts` kur njihet ai format. |
| `src/lib/paramasaPreview.ts` | Tipet/metadata për template 1–5 pozicione, identifikimi/grupimi i seksioneve, llogaritja e hapësirës dhe ndarje e përgjithshme për preview. |
| `src/lib/libriPaging.ts` | Koordinatat e slot-eve të template-ve të Librit dhe paketuesi që vendos sa pozicione hyjnë në secilën faqe, duke marrë parasysh buxhetin e përshkrimit. |
| `src/lib/libriExportPlan.ts` | Kthen rreshtat në plan të eksportit, serializon/rikthen faqosjen dhe kontrollon që çdo rresht të mbulohet saktësisht një herë. |
| `src/lib/libriPlanEditor.ts` | Operacionet e planit manual: bashkim faqesh, ndarje dhe zhvendosje pozicioni; validon që rezultati mund të paketohet. |
| `src/lib/libriExport.ts` | Ngarkon template-t e Librit, klonon sheet-et dhe stilet, plotëson qelizat, ndërton workbook/faqe të vetme/ZIP dhe shkarkon rezultatin. |
| `src/lib/faturaValidation.ts` | Sanitizon input-et dhe validon fushat e faturës kontratë/fletëdërgesës përpara se të fillojë eksporti. |
| `src/lib/faturaExport.ts` | Ngarkon template-t e faturës, vendos vlerat në qeliza, ruan formatimin, ndërton dokumentet dhe i shkarkon. |

## 6. Materialet statike dhe workbook-et

### Asetet e `public/`

| Skedari | Roli |
|---|---|
| `public/branding/megrant-logo.png` | Logoja që shfaqet në sidebar. |
| `public/icons/graniti-mark.svg` | Ikona/marka për favicon, manifest dhe ekranin e loading-ut. |
| `public/manifest.webmanifest` | Metadata për instalim si web app/PWA dhe ikonën e aplikacionit. |
| `public/robots.txt` | Rregulla për crawler-at; nuk ndikon në logjikën e aplikacionit. |
| `public/templates/Fatura - Shabllon - Kontrate.xlsx` | Template origjinal që `faturaExport.ts` mbush për faturën e kontratës. |
| `public/templates/Fletedergese-Shabllon-Pozicione.xlsx` | Template që përdoret për fletëdërgesën me pozicione. |
| `public/templates/Shablloni-1-Faqe.xlsx` | Template Libri me një pozicion për faqe. |
| `public/templates/Shablloni-2-Faqe.xlsx` | Template Libri me dy pozicione për faqe. |
| `public/templates/Shablloni-3-Faqe.xlsx` | Template Libri me tre pozicione për faqe. |
| `public/templates/Shablloni-4-Faqe.xlsx` | Template Libri me katër pozicione për faqe. |
| `public/templates/Shablloni-5-Faqe.xlsx` | Template Libri me pesë pozicione për faqe. |
| `public/templates/~$Shablloni-1-Faqe.xlsx` | Skedar lock i krijuar nga Microsoft Excel kur workbook-u është i hapur; nuk është template që duhet zgjedhur nga eksportuesi. |

Template-t kanë rëndësi strukturore, jo vetëm pamore: merge-t, qelizat, lartësitë dhe print setup lidhen me kodin që i mbush. Ndryshimi i template-it mund ta prishë output-in edhe nëse TypeScript-i vazhdon të kompilohet.

### Materialet burimore në root

Skedarët në `Fatura/` dhe `Paramasa/` janë workbook-e burimore/shembuj për punë ose verifikim. Aplikacioni nuk i importon automatikisht nga këto folderë; përdoruesi e ngarkon vetë një file në ndërfaqe. Emrat aktualë:

- `Fatura/Fatura - Shabllon - Kontrate.xlsx` — workbook burimor/shabllon për faturën e kontratës; kopja aktive për eksport është nën `public/templates/`.
- `Fatura/Fletedergese - Shabllon - Pozicione.xlsx` — workbook burimor për fletëdërgesën; kopja aktive për eksport është nën `public/templates/`.
- `Paramasa/1. Paramasa - Badovc.xls` dhe `Paramasa/1. Paramasa shtesa badovc (3).xls` — skedarë paramase Badovc për input/testim manual.
- `Paramasa/1. Paramasa.xlsx` — paramasë shembull për import.
- `Paramasa/Paramasa per liber ndertimore.xlsx` — workbook shembull për rrjedhën e paramasës/Librit Ndërtimor.
- `Paramasa/Paramase-Ferizaj.xlsx` — paramasë shembull për import.
- `Paramasa/Përshkrimi i qmimit - Renovimi i dyshemesë në Mjekimin Intenziv Qendrorë - MIQ (3).xlsx` — workbook burimor me përshkrim çmimi; mund të përdoret si input manual.
- `Paramasa/Riorganizimi i kuzhinës në objektin - Paramase.xls` — paramasë shembull `.xls`.
- `Paramasa/Shablloni-1 Faqe.xlsx` — kopje burimore e template-it me një pozicion për faqe.
- `Paramasa/Shablloni-2 Faqe.xlsx` — kopje burimore e template-it me dy pozicione për faqe.
- `Paramasa/Shablloni-3 Faqe.xlsx` — kopje burimore e template-it me tre pozicione për faqe.
- `Paramasa/Shablloni-4 Faqe.xlsx` — kopje burimore e template-it me katër pozicione për faqe.
- `Paramasa/Shablloni-5 Faqe.xlsx` — kopje burimore e template-it me pesë pozicione për faqe.

  Këto janë kopje burimore; runtime përdor template-t e vendosura nën `public/templates/`.
- `Paramasa/Situacioni 1 RENOVIMET QKMF - Paramase Podujeve.xlsx` — workbook shembull situacioni/paramase.

Workbook-et e input-it shërbejnë edhe si raste për provë manuale të parser-it. Nuk janë prova automatike: para përdorimit real kontrollohen përshkrimet, sasitë, totalet dhe faqosja.

## 7. Të dhënat dhe kufijtë e sistemit

### Tabelat/veprimet që kodi pret në Supabase

Kodi i referohet tabelave si `projects`, `categories`, `project_items`, `item_expenses`, `price_history`, `libri_exports` dhe `profiles`. Përdor edhe RPC-të:

- `save_register_position` — krijim i pozicionit bashkë me projekt/kategori sipas rastit dhe shpenzimet;
- `update_project_position` — përditësim i pozicionit dhe shpenzimeve të lidhura;
- `mark_approval_notice_seen` — shënim i njoftimit të aprovimit.

**Ky repository nuk përmban migrime/schema SQL aktuale.** Emrat e tabelave/RPC-ve janë kontrata që presin skedarët e frontend-it; krijimi real, foreign keys, funksionet, trigger-at dhe RLS duhet verifikuar në Supabase. Nuk mund të konkludohet vetëm nga kodi se instalimi i databazës është identik ose se politikat janë të sigurta.

Shumë query të shërbimeve nuk shtojnë filtër `user_id`/`owner_id`; ndarja e përdoruesve varet nga RLS. Meqë paneli ka administrim përdoruesish, para përdorimit me shumë llogari verifiko politikat e leximit/ndryshimit/fshirjes në Supabase dhe mos u mbështet vetëm në `ProtectedRoute`.

### Dallimi mes katër vlerave financiare

1. **Vlera bruto e ofertës**: shuma e totalit të pozicioneve, zakonisht me TVSH.
2. **Oferta pa TVSH**: vlera bruto e pozicionit pjesëtuar me `1 + TVSH%`; kur pozicionet kanë norma të ndryshme, zbatohet për pozicion.
3. **Kosto e regjistruar/parashikuar**: shuma e rreshtave të `item_expenses`; nëse të dhënat mungojnë ose janë të paplota, mos interpretoje boshllëkun si zero.
4. **Kosto reale finale**: total që përdoruesi e ruan në metadata të projektit pasi di shpenzimin real. Fitimi real i paraqitur është oferta pa TVSH minus këtë kosto, sipas formulës aktuale.

Fitimi i parashikuar nuk është fitim kontabël i certifikuar, ndërsa trendi mujor nuk është qarkullim i arkëtuar. Këto janë analiza të të dhënave që sistemi ka regjistruar.

## 8. Vërejtje nga shqyrtimi i kodit

- **Mungojnë migrimet e databazës në repository.** Për ta ngritur sistemin diku tjetër duhen schema, RPC-të dhe RLS që përputhen me frontend-in.
- **Izolimi i të dhënave nuk është në query-t frontend.** Duhet verifikuar e garantuar nga RLS në Supabase.
- **Konfigurimi pa Supabase nuk është mënyrë e plotë offline.** Disa faqe japin gjendje bosh ose gabime dhe rrugët e mbrojtura nuk e kërkojnë login-in kur klienti mungon.
- **Disa dështime të snapshot-it ndodhin pas ruajtjes së pozicionit.** Kjo është e qëllimshme që dështimi i historikut të mos paraqitet si dështim i pozicionit; UI-ja duhet lexuar si dy rezultate të ndara.
- **Emri `priceHistory`/`PriceHistoryDashboard` është më i vjetër se përmbajtja aktuale e panelit.** Dashboard-i i tanishëm grumbullon shpenzime/fitim; ruajtja e snapshot-eve nuk do të thotë se paneli aktual vizaton evolucionin kohor të tyre.
- **Eksporti i faturës nuk është i qëndrueshëm në databazë.** Është përgatitje dokumenti në browser; ruaje file-in e gjeneruar.
- **Backup JSON nuk përfshin profilet e përdoruesve dhe nuk zëvendëson backup-in e Supabase-it.**
- **`src/types.ts` nuk rezulton i përdorur nga importet aktuale.** Modelet aktive të DB-së janë te `src/types/database.ts`; tipi i vjetër nuk e ndryshon sjelljen runtime.
- **Testet automatike:** në tree-n e shqyrtuar nuk u gjetën skedarë `*.test.*`/`*.spec.*`; nuk duhet supozuar se `npm test` teston logjikën e aplikacionit. Duhet shtuar testim, veçanërisht për formulat, parsing-un, planifikimin dhe validimin e eksportit.
- **Lint:** `package.json` ka script që thërret ESLint, por ESLint nuk figuron te varësitë e manifestit aktual; komanda mund të mos ekzekutohet pa konfigurim/instalim të veçantë.
- **Përmbajtja e faqes “Rreth nesh” është statike.** Pretendimet si “100+ projekte” dhe “10+ vjet” nuk lidhen me të dhëna të databazës; verifikoji para publikimit/dorëzimit. Teksti përdor edhe emrat MEGRANT ING dhe GRANITI SH.P.K., ndaj branding-u duhet kontrolluar nga pronari i projektit.
- **Skedarë historikë:** `KODI_DHE_REFACTOR_GUIDE.md` përmend disa file që mungojnë nga repository aktual, prandaj përdore këtë udhëzues për hartën e tanishme.

Këto janë kufij dhe vërejtje nga struktura e kodit; nuk pretendojnë se janë testuar kundrejt databazës së largët.

## 9. Renditja e rekomanduar për ta mësuar projektin

1. Lexo `README.md` dhe këtë udhëzues për qëllimin/arkitekturën.
2. Ndiq nisjen: `index.html` → `src/main.tsx` → `App.tsx` → `AuthContext`/`ProtectedRoute` → `Shell`.
3. Mëso formulën: `lib/pricing.ts` → `PricingPreview.tsx` → `RegisterPage.tsx` → `services/register.ts`.
4. Mëso menaxhimin: `DataPage.tsx` → `services/projects.ts`, `categories.ts`, `insights.ts`, `priceHistory.ts` → `PositionCard.tsx`.
5. Mëso importin: `ImportPage.tsx` → `lib/excel.ts` → `libriNdertimor.ts`/`paramasaPreview.ts` → `libriExportPlan.ts`/`libriPaging.ts`/`libriPlanEditor.ts` → `libriExport.ts` dhe `services/libriExports.ts`.
6. Mëso faturën: `InvoicePage.tsx` → `fatura.ts` → `faturaValidation.ts` → `faturaExport.ts` → template-t.
7. Pastaj lexo `HomePage.tsx`, `SearchPage.tsx`, context-et, tipet dhe `styles.css`.

Për çdo veprim ndjek këtë pyetje: **ku nis input-i, ku validohet, ku llogaritet, ku ruhet ose eksportohet dhe si raportohet dështimi?** Kjo e bën të qartë jo vetëm çfarë bën një skedar, por pse lidhet me skedarët e tjerë.
