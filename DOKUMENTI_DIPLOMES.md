# TEMË DIPLOME

## Të dhëna bazë

- **Universiteti:** [Plotëso]
- **Fakulteti:** [Plotëso]
- **Departamenti / Programi:** Inxhinieri Softuerike / Shkenca Kompjuterike
- **Studenti:** [Emri Mbiemri]
- **Numri i indeksit:** [Plotëso]
- **Mentori:** [Plotëso]
- **Viti akademik:** 2025/2026
- **Titulli i temës:** Zhvillimi i një platforme web për menaxhimin e paramasave, ofertave dhe Librit Ndërtimor në ndërtim

---

## Përmbledhje

Ky projekt paraqet zhvillimin e një aplikacioni web për menaxhimin e proceseve që lidhen me përgatitjen e paramasave, ofertave, faturave dhe të dhënave të projekteve ndërtimore. Zgjidhja është ndërtuar për të zëvendësuar punën manuale të shpërndarë në skedarë Excel dhe dokumente të ndryshme me një sistem të centralizuar, të strukturuar dhe të shpejtë për përdorim.

Aplikacioni mundëson regjistrim manual të pozicioneve, import të të dhënave nga Excel, gjenerim të Librit Ndërtimor, krahasim të projekteve dhe kategorive, kërkim global në të dhëna, si dhe menaxhim të llogarisë së përdoruesit. Për realizimin e projektit janë përdorur React, TypeScript, Vite, Supabase dhe biblioteka të tjera ndihmëse për forma, eksportim dhe vizualizim të të dhënave.

Ky dokument është hartuar duke u bazuar në kodin dhe skedarët ekzistues të repository-t, përfshirë [App.tsx](App.tsx), faqet në [src/pages](src/pages), shërbimet në [src/services](src/services), skemën e databazës në [database-schema.sql](database-schema.sql), si dhe materialet shembull në folderët [Fatura](Fatura) dhe [Paramasa](Paramasa).

## Fjalë kyçe

Paramasa, Libri Ndërtimor, aplikacion web, React, TypeScript, Supabase, Excel, faturë, menaxhim projektesh.

## 1. Hyrje

Në sektorin e ndërtimit, menaxhimi i ofertave, paramasave dhe dokumentacionit mbështetet shpesh në skedarë Excel, dokumente manuale dhe përpunim të përsëritur të të dhënave. Kjo qasje rrit mundësinë për gabime, e ngadalëson procesin dhe e vështirëson kërkimin ose krahasimin e të dhënave historike.

Ky projekt është zhvilluar për të adresuar këto probleme përmes një platforme web që centralizon të dhënat, automatizon llogaritjet kryesore dhe ofron mjete për analizë, eksport dhe kërkim.

## 2. Problemi që zgjidhet

Problemet kryesore që trajton projekti janë:

- ruajtja e shpërndarë e të dhënave në Excel dhe dokumente manuale,
- llogaritje të përsëritura dhe të ndjeshme ndaj gabimeve,
- mungesë e kërkimit të shpejtë në të dhëna,
- mungesë e historikut të çmimeve dhe krahasimit të projekteve,
- vështirësi në gjenerimin e dokumentacionit të standardizuar si Libri Ndërtimor dhe faturat.

## 3. Qëllimi i projektit

Qëllimi i këtij projekti është ndërtimi i një sistemi web që:

- lehtëson futjen dhe menaxhimin e pozicioneve të punës,
- importon dhe përpunon të dhëna nga Excel,
- gjeneron dokumente dhe faqe të standardizuara për Libër Ndërtimor,
- ofron analizë të të dhënave dhe statistika,
- ruan të dhënat në mënyrë të sigurt dhe të organizuar,
- mbështet autentikim dhe kontroll të aksesit të përdoruesve.

## 4. Objektivat

- Të krijohet një panel administrativ për menaxhim të projekteve ndërtimore.
- Të automatizohet llogaritja e çmimeve dhe totalit për pozicione.
- Të mundësohet importi i paramasave nga Excel.
- Të krijohet preview i saktë para eksportit final.
- Të mundësohet gjenerimi i Librit Ndërtimor në format Excel dhe ZIP.
- Të realizohet kërkim global në të dhëna.
- Të sigurohet autentikim i përdoruesve dhe mbrojtje e faqeve.
- Të ofrohen analiza për projekte, kategori dhe historik çmimesh.

## 5. Metodologjia e punës

Puna është zhvilluar me një metodologji praktike të orientuar drejt implementimit, duke ndjekur këto hapa:

1. Analiza e problemit dhe identifikimi i nevojave në procesin e punës së ndërtimit.
2. Definimi i funksioneve kryesore të aplikacionit.
3. Dizajnimi i strukturës së faqeve dhe rrjedhës së përdorimit.
4. Ndërtimi i komponentëve të ripërdorshëm për UI.
5. Implementimi i logjikës së biznesit për llogaritje, import dhe eksport.
6. Integrimi me Supabase për databazë dhe autentikim.
7. Testimi i funksioneve kryesore me të dhëna reale dhe skedarë Excel.
8. Përmirësimi i preview, validimit dhe eksportit për të shmangur mospërputhjet.

Kjo metodologji është e përshtatshme për një temë diplome në inxhinieri softuerike, sepse kombinon analizë të problemit, arkitekturë software-i dhe implementim praktik.

## 6. Teknologjitë e përdorura

### 6.1 React 18

React është përdorur për ndërtimin e ndërfaqes, sepse lejon ndarje të qartë në komponentë, menaxhim të gjendjes dhe ripërdorim të logjikës së UI-së.

### 6.2 TypeScript

TypeScript është përdorur për tipizim të të dhënave dhe ulje të gabimeve gjatë zhvillimit, sidomos në një sistem që punon me shumë entitete si projekte, kategori, pozicione dhe faturime.

### 6.3 Vite

Vite është përdorur si mjet build dhe development server për shkak të shpejtësisë dhe konfigurimit të thjeshtë.

### 6.4 React Router 6

React Router është përdorur për menaxhimin e navigimit ndërmjet faqeve pa rifreskim të plotë të shfletuesit.

### 6.5 Supabase

Supabase është përdorur si backend për:

- autentikim,
- databazë PostgreSQL,
- politika RLS,
- ruajtje dhe lexim të të dhënave.

Në skemën e databazës janë të përfshira tabelat kryesore `categories`, `projects`, `project_items`, `item_expenses` dhe `import_history`, që përputhen me rrjedhën reale të aplikacionit.

### 6.6 Biblioteka ndihmëse

- `react-hook-form` për forma,
- `xlsx`, `exceljs` dhe `jszip` për Excel/ZIP,
- `lucide-react` për ikona,
- `victory` për grafikë,
- `date-fns` për data,
- utilitarë të brendshëm për validim, eksport dhe analizë.

## 7. Arkitektura e sistemit

Sistemi është ndarë në disa shtresa kryesore:

- **Shtresa e prezantimit**: faqet dhe komponentët React.
- **Shtresa e logjikës**: shërbimet dhe funksionet ndihmëse për llogaritje, validim dhe eksport.
- **Shtresa e gjendjes globale**: Auth, Theme dhe Toast context.
- **Shtresa e të dhënave**: Supabase / PostgreSQL.

Kjo ndarje e bën projektin më të mirëmbajtshëm dhe më të kuptueshëm, duke ulur varësinë e çdo faqeje nga logjika e drejtpërdrejtë e bazës së të dhënave.

### 7.1 Figurë statistikore e strukturës së projektit

Për ta bërë dokumentin më të plotë vizualisht, projekti mund të paraqitet edhe me një figurë të thjeshtë statistikore që e përmbledh strukturën reale të repository-t:

- 7 faqe kryesore,
- 13 komponentë të përbashkët,
- 9 shërbime biznesi,
- 9 modulë / utilitarë në lib,
- 5 tabela kryesore në databazë.

Kjo figurë tregon se projekti është i ndarë mirë në shtresa dhe module, gjë që është shumë e rëndësishme për mirëmbajtje dhe zgjerim të mëtejshëm.

### 7.2 Rrjedha e të dhënave

Rrjedha bazë e sistemit është:

1. përdoruesi fut të dhëna manualisht ose ngarkon Excel,
2. sistemi i kalon në validim,
3. të dhënat ruhen në Supabase,
4. output-i shfaqet si dashboard, preview ose eksport Excel/ZIP/JSON.

Kjo e bën aplikacionin të përshtatshëm për përdorim praktik në menaxhimin e paramasave dhe dokumentacionit ndërtimor.

## 8. Funksionalitetet kryesore

### 8.1 Ballina / Dashboard

Faqja kryesore paraqet gjendjen e përgjithshme të sistemit me statistika, projekte referencë dhe grafikë analitike.

### 8.2 Regjistrimi i pozicioneve

Përdoruesi mund të shtojë pozicione të reja me:

- projekt,
- kategori,
- përshkrim,
- njësi,
- sasi,
- material,
- punë,
- ushqim,
- transport,
- fitim,
- TVSH.

Sistemi llogarit automatikisht totalin dhe çmimin për njësi.

### 8.3 Importi nga Excel

Aplikacioni lexon skedarët Excel, i validon të dhënat dhe i shfaq në preview para eksportit.

### 8.4 Libri Ndërtimor

Sistemi gjeneron faqe të Librit Ndërtimor në format të organizuar, me shabllone dhe ndarje sipas seksioneve.

### 8.5 Faturat

Krijohen fatura të strukturuara sipas dy modeleve: kontratë dhe pozicione.

### 8.6 Kërkimi global

Përdoruesi mund të kërkojë nëpër përshkrime, numra pozicionesh dhe projekte.

### 8.7 Menaxhimi i të dhënave

Faqja e të dhënave ofron editim, fshirje, krahasim projektesh, krahasim kategorish dhe historik çmimesh.

### 8.8 Autentikimi dhe profili

Përdoruesi mund të hyjë, të regjistrohet, të ndryshojë password-in dhe të shkarkojë backup JSON.

## 9. Të dhënat që përdoren në projekt

Sistemi punon me këto entitete kryesore:

- **Projektet**: emri, klienti, statusi, përshkrimi, kosto reale, shënime.
- **Kategoritë**: emri dhe përshkrimi.
- **Pozicionet e projektit**: numri i pozicionit, përshkrimi, njësia, sasia, çmimi, totali.
- **Shpenzimet e detajuara**: material, punë, ushqim, transport dhe të tjera, të ruajtura veçmas në tabelën `item_expenses`.
- **Historiku i importeve**: skedarët e importuar dhe gjendja e undo, të ruajtura në `import_history`.
- **Historiku i çmimeve**: snapshot-e të çmimeve dhe fitimit.
- **Eksportet e Librit Ndërtimor**: metadata, rreshta dhe statistika të eksportit.
- **Të dhëna të faturave**: klienti, data, fushat financiare dhe përmbajtja e faturës.

Në repository ekzistojnë edhe skedarë shembull për punë operative, si p.sh. shabllonet e faturave në [Fatura](Fatura) dhe shumë skedarë Excel për paramasa dhe Libër Ndërtimor në [Paramasa](Paramasa).

## 10. Përshkrimi i faqeve

### 10.1 Faqja kryesore

Shërben si panel i gjendjes së projektit, ku shfaqen statistikat dhe hyrjet e shpejta drejt moduleve të tjera.

### 10.2 Faqja e regjistrimit

Përdoret për futjen manuale të të dhënave dhe për kalkulimin e kostove.

### 10.3 Faqja e faturës

Shërben për gjenerimin e faturave sipas modeleve të ndryshme të biznesit.

Në repository janë të pranishëm edhe shabllonet përkatëse Excel që përdoren si bazë për këtë funksionalitet.

### 10.4 Faqja e importit

Përdoret për import Excel, ndarje të rreshtave, preview dhe eksport final.

Kjo faqe lidhet drejtpërdrejt me materialet në folderin [Paramasa](Paramasa), ku ruhen shembuj skedarësh realë nga përdorimi praktik.

### 10.5 Faqja e të dhënave

Përmban administrim të të dhënave, analizë dhe krahasim.

### 10.6 Faqja e kërkimit

Lejon kërkim të shpejtë në të gjitha pozicionet dhe projektet.

### 10.7 Faqja e profilit

Për menaxhimin e llogarisë dhe backup-it.

Përveç ndryshimit të password-it, funksioni i backup-it JSON ruan `projects`, `categories`, `project_items` dhe `item_expenses`, sipas implementimit real të shërbimit të eksportit.

## 11. Funksionet kryesore teknike

- `calculatePositionPrice` për llogaritje çmimi.
- `validateKontrate` dhe `validatePozicione` për faturat.
- `parseExcelWithValidation` për lexim dhe kontroll të Excel-it.
- `planLibriExport` për ndarje të faqeve të Librit Ndërtimor.
- `buildLibriNdertimorWorkbook` për eksport final.
- `searchPositions` për kërkim global.
- `fetchDashboardStats` dhe `fetchProjectSummaries` për analiza.
- `signIn`, `signUp`, `resetPassword`, `changePassword` për auth.

### 11.1 Funksione të lidhura me eksportin dhe administrimin

- `exportProjectCSV` për eksport CSV të një projekti.
- `exportAllDataJson` për backup JSON të të dhënave.
- `recordPriceSnapshot` për ruajtje të historikut të çmimeve.
- `fetchProfitSummaryByProject` për analizë të fitimit sipas projektit.
- `fetchPriceTrend` për trendin e çmimeve.

## 12. Dizajni i ndërfaqes së përdoruesit

Ndërfaqja është ndërtuar me fokus në qartësi dhe përdorim praktik. Është përdorur një layout me sidebar, kartela, tabela dhe preview vizual për të shmangur ngarkesën e panevojshme në përdorim.

Qëllimi i UI-së nuk është vetëm pamja, por edhe:

- shpejtësia e punës,
- orientimi i qartë i përdoruesit,
- minimizimi i gabimeve,
- akses i lehtë në funksionet kryesore.

## 13. Testimi dhe vlerësimi

Testimi i projektit duhet të fokusohet në këto raste:

- saktësia e llogaritjeve financiare,
- importi korrekt i Excel-it,
- gjenerimi i saktë i Librit Ndërtimor,
- funksionimi i kërkimit global,
- ruajtja dhe editimi i të dhënave,
- autentikimi dhe mbrojtja e faqeve,
- eksporti i backup-it.

Vlerësimi praktik tregon nëse aplikacioni përmirëson kohën e punës dhe ul gabimet krahasuar me procesin manual.

## 14. Përparësitë e projektit

- Centralizon të gjitha të dhënat në një sistem të vetëm.
- Automatizon llogaritjet dhe eksportet.
- Ofron kërkim, analizë dhe histori të të dhënave.
- Ka arkitekturë të ndarë dhe të lexueshme.
- Është i përshtatshëm për përdorim real në biznes ndërtimor.

## 15. Kufizimet dhe mundësitë e zhvillimit të mëtejshëm

Kufizimet aktuale përfshijnë varësinë nga konfigurimi i Supabase dhe faktin që disa rrjedha biznesi kërkojnë të dhëna të sakta në Excel ose databazë. Si zhvillim i mëtejshëm, projekti mund të zgjerohet me:

- raportim më të avancuar PDF,
- role të ndryshme përdoruesish,
- statistikë më të thelluar,
- njoftime automatike,
- integrim me module financiare,
- eksport më të pasur për dokumentacion zyrtar.

## 16. Përfundim

Ky projekt paraqet një zgjidhje praktike dhe të strukturuar për menaxhimin e proceseve të lidhura me paramasa, oferta, fatura dhe dokumentacion ndërtimor. Përdorimi i teknologjive moderne web e bën sistemin të shpejtë, të qartë dhe të përshtatshëm për zgjerim të mëtejshëm.

Nga këndvështrimi akademik, tema është e vlefshme sepse përfshin analizë problemi, projektim software-i, implementim teknik, testim dhe vlerësim praktik. Për këtë arsye, projekti është i përshtatshëm për një temë diplome në Inxhinieri Softuerike ose Shkenca Kompjuterike.

## 17. Rekomandimi për gjatësinë e dokumentit

Për këtë projekt, unë rekomandoj **15 deri në 20 faqe** për versionin përfundimtar nëse është temë diplome bachelor dhe nëse dokumenti përfshin:

- hyrje,
- metodologji,
- teknologji,
- arkitekturë,
- funksione,
- screenshot-e,
- testim dhe përfundim.

Nëse profesori kërkon më shumë detajim ose nëse shtohen shumë screenshot-e, atëherë dokumenti mund të shkojë edhe në **20–25 faqe**. Për një version të mirë balancuar, **18 faqe** është një pikë shumë e mirë.

## 19. Burimet reale nga repository

Për ta bërë dokumentin sa më të saktë me implementimin, janë marrë parasysh këto burime konkrete nga repository:

- [App.tsx](App.tsx) për route-t dhe provider-at globalë.
- [README.md](README.md) për përshkrimin bazë të projektit.
- [database-schema.sql](database-schema.sql) për strukturën e databazës dhe RLS.
- [src/pages/HomePage.tsx](src/pages/HomePage.tsx), [src/pages/RegisterPage.tsx](src/pages/RegisterPage.tsx), [src/pages/ImportPage.tsx](src/pages/ImportPage.tsx), [src/pages/DataPage.tsx](src/pages/DataPage.tsx), [src/pages/SearchPage.tsx](src/pages/SearchPage.tsx), [src/pages/ProfilePage.tsx](src/pages/ProfilePage.tsx), [src/pages/LoginPage.tsx](src/pages/LoginPage.tsx) për funksionalitetet e faqeve.
- [src/services](src/services) për logjikën e biznesit, eksportet dhe analizat.
- [src/lib](src/lib) për validimin, llogaritjen dhe eksportin e dokumenteve.
- [Fatura](Fatura) dhe [Paramasa](Paramasa) për materialet shembull dhe shabllonet praktike.

Kjo do të thotë që dokumenti nuk është shkruar vetëm “nga mendja”, por është përshtatur me strukturën, funksionet dhe asetet reale që ekzistojnë në repository.

## 18. Referenca

1. React Documentation: https://react.dev
2. TypeScript Documentation: https://www.typescriptlang.org/docs/
3. Vite Documentation: https://vite.dev
4. React Router Documentation: https://reactrouter.com
5. Supabase Documentation: https://supabase.com/docs
6. react-hook-form Documentation: https://react-hook-form.com
7. ExcelJS Documentation: https://github.com/exceljs/exceljs
8. xlsx / SheetJS Documentation: https://docs.sheetjs.com
9. Victory Documentation: https://commerce.nearform.com/open-source/victory/
10. date-fns Documentation: https://date-fns.org

## Shtojca

Nëse ky dokument dorëzohet si temë diplome, sugjerohet që në versionin final të shtohen edhe:

- faqja e titullit,
- përmbajtja automatike,
- figura / screenshot-e nga aplikacioni,
- diagrami i arkitekturës,
- diagrami i databazës,
- shembuj të importit dhe eksportit,
- testime me të dhëna reale.