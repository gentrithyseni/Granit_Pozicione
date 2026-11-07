# Use cases: funksionimi i tetë pjesëve të sidebar-it

Ky dokument shpjegon tetë destinacionet që përdoruesi sheh në sidebar, nga hyrja në faqe deri te rezultati i veprimit. Për secilin rast përshkruhen aktori, kushtet paraprake, rrjedha normale, alternativat/gabimet, funksionet kryesore dhe arsyeja pse ndahet procesi në ata hapa.

Dokumenti pasqyron sjelljen aktuale të kodit, jo sjelljen ideale apo një dizajn të ardhshëm. Në veçanti, jo çdo veprim ruhet në databazë: eksporti i faturës vetëm shkarkon dokumentin; importi i paramasës ruan të dhënat e lexuara në historik kur Supabase është aktiv; regjistrimi i pozicionit ndryshon databazën.

## Hyrja e përbashkët për rastet e përdorimit

Sidebar-i ndërtohet në `src/components/Shell.tsx`. Lidhjet e tij janë:

| # | Emri në sidebar | Rruga |
|---|---|---|
| 1 | Faqja Kryesore | `/` |
| 2 | Regjistro | `/register` |
| 3 | Krijo Fature | `/fature` |
| 4 | Krijo Libër Ndërtimor | `/import` |
| 5 | Të Dhënat | `/data` |
| 6 | Kërko | `/search` |
| 7 | Profili | `/profile` |
| 8 | Rreth Nesh | `/about-us` |

Përveç `/`, faqet ngarkohen me `React.lazy` në `App.tsx`; gjatë ngarkimit shfaqet `LoadingScreen`. Të tetë rrugët janë brenda `ProtectedRoute`. Kur Supabase është konfiguruar, kjo shtresë pret kontrollin e sesionit/profilit dhe pastaj kërkon përdorues të kyçur; përdoruesi pa qasje ridrejtohet te `/login` dhe ruhet rruga ku po tentonte të shkonte. Kur Supabase nuk është konfiguruar, kodi lejon kalimin te faqja pa autentikim. Kjo është mënyrë zhvillimi dhe nuk siguron databazë funksionale.

Rrjedha e përgjithshme:

```text
Përdoruesi klikon një lidhje në Shell
  → React Router ndryshon rrugën pa reload të plotë
  → ProtectedRoute kontrollon hyrjen kur Supabase është aktiv
  → App shfaq faqen përkatëse
  → faqja merr input-in dhe thërret komponentë/service/lib
  → rezultat shfaqet, ruhet në Supabase, ose shkarkohet si skedar
```

`/login` është kusht paraprak për shumë përdorime, jo lidhje e nëntë në sidebar. `Shell` e përdor `useAuth` për dalje nga llogaria; tema dhe toast-et ofrohen nga context-et globale. Njoftimi i ruajtjes `showSavedToast` shfaqet vetëm në veprime të caktuara të ruajtjes/përditësimit dhe e çon faqen butë në krye; ai nuk rifreskon tërë browser-in.

---

## UC-01 — Faqja Kryesore (`/`)

**Aktori kryesor:** përdorues i kyçur.  
**Qëllimi:** të marrë pamje të shpejtë të projekteve, vlerave, statistikave dhe Librit të fundit, pastaj të kalojë te një veprim tjetër.  
**Nisja:** klikimi i “Faqja Kryesore” në sidebar ose hapja e `/`.

### Kushtet paraprake

- Kur Supabase është aktiv: session-i duhet të jetë i vlefshëm dhe profili duhet ta lejojë hyrjen.
- Për të pasur metrika domethënëse duhet të ketë projekte, pozicione dhe/ose rekorde të Librit në databazë.
- Nëse Supabase nuk është lidhur, disa services kthejnë vlera bosh/zero; ballina nuk krijon vetë të dhëna shembull.

### Rrjedha normale, nga fillimi deri në fund

1. `App.tsx` paraqet `HomePage` pas kontrollit të `ProtectedRoute`.
2. `HomePage` nis ngarkimin e dashboard-it dhe njëkohësisht kërkon disa grupe të dhënash: numërimet e projekteve/kategorive/pozicioneve, projektet e përfunduara, vlerën totale të sistemit dhe historikun e Librit.
3. Për një pjesë tjetër, ballina lexon projektet më të rejat dhe siguron kategoritë standarde. Pasi i merr, kërkon përmbledhjet e vlerës sipas projektit/kategorisë dhe përdorimin e qyteteve të transportit.
4. Rezultatet vendosen në state. Derisa leximet përfundojnë, UI-ja shfaq `…`/tekst ngarkimi; gabimet e kapura shfaqen si mesazh në dashboard.
5. Përdoruesi sheh përshëndetjen sipas orës, datën lokale, vlerën e përgjithshme të pozicioneve dhe numërimet.
6. Katër kartat e veprimit çojnë në Regjistro, Krijo Fature, Libri Ndërtimor dhe Të Dhënat.
7. Te “Gjendja e projekteve”, përdoruesi klikon një status. `selectedStatus` filtron listën; projektet e përfunduara paraqiten si referenca të fundit, ndërsa statuset e tjera paraqesin deri në tetë projekte nga lista e ngarkuar.
8. Te statistikat, `InsightsCharts` paraqet vlera dhe shpërndarje sipas të dhënave të agreguara.
9. Te statistikat e Librit, `summarizeLibriExportRecords` përmbledh numrin, vlerën, mesataren dhe top librat. Nëse ka Libër të fundit, përdoruesi mund ta hapë faqen e importit ose ta rigjenerojë/shkarkojë sërish.
10. Klikimi “Shkarko përsëri” rikthen faqosjen e ruajtur kur është e vlefshme, ndërton workbook me eksportuesin e Librit dhe e shkarkon në browser.

### Funksionet kryesore dhe pse përdoren

- `greetingForHour(hour)` zgjedh tekstin e përshëndetjes; kjo është vetëm paraqitje dhe nuk ndikon në të dhëna.
- `fetchDashboardStats()` numëron rekorde pa i ngarkuar të gjitha rreshtat; përdoret për KPI-të.
- `fetchCompletedProjects()` merr referenca të projekteve të përfunduara.
- `fetchTotalSystemValue()`, `fetchProjectSummaries()` dhe `fetchCategorySummaries()` përgatisin agregatet e grafikëve.
- `fetchTransportCityUsage()` përmbledh përdorimin e transportit sipas qytetit.
- `fetchLibriExportRecords()` merr historikun e Librit; `summarizeLibriExportRecords()` llogarit përmbledhjen për UI.
- `restoreLibriExportPlan()` rikthen faqosjen manuale të Librit; nëse mungon/plani s’është valid, eksportuesi mund të përdorë planifikimin e parazgjedhur.
- `handleDownloadRecent()` menaxhon spinner-in, rigjenerimin, shkarkimin dhe mesazhin e gabimit.
- `InsightsCharts` dhe `StatusBadge` i paraqesin të dhënat; nuk ruajnë asgjë.

### Alternativa dhe kufizime

- Nëse një query dështon, shfaqet gabim; pjesët që arritën të ngarkohen mund të mbeten të dukshme.
- Nëse nuk ka Libër të ruajtur, tregohet gjendje bosh.
- Vlera e sistemit dhe vlera e ofertave bazohen në totalet e pozicioneve. Nuk janë pagesa të arkëtuara, fitim neto apo raport kontabël.
- Trendi mujor i ofertave nuk paraqitet në ballinë; gjendet në faqen Të Dhënat.
- Statistikat janë pamje leximi. Ndryshimet bëhen në faqet përkatëse.

**Rezultati pas përdorimit:** përdoruesi ka pasqyrë të shpejtë dhe mund të vazhdojë në një nga proceset e sidebar-it; nuk ndryshohen të dhënat vetëm duke hapur ballinën.

---

## UC-02 — Regjistro (`/register`)

**Aktori kryesor:** përdorues që përgatit ofertë/pozicion.  
**Qëllimi:** të krijojë një rresht të llogaritur në kuadër të një projekti dhe kategorie.  
**Nisja:** klikimi “Regjistro”.

### Kushtet paraprake

- Për ruajtje duhet Supabase i konfiguruar.
- Duhet të zgjidhet projekt/kategori ekzistuese ose të jepen emrat për krijim të ri.
- Përshkrimi duhet të jetë i plotë dhe sasia pozitive.

### Rrjedha normale

1. `RegisterPage` hap formën me vlera fillestare: njësi `komplet`, sasi 1, ditë 1, lokacion Prishtinë, transport 10 € dhe TVSH 18%; kostot/fitimi fillojnë zero.
2. Faqja siguron kategoritë standarde përmes `ensureDefaultCategories()` dhe lexon projektet nga Supabase, më të rejat të parat.
3. Përdoruesi zgjedh projektin. Nëse zgjedh `NEW`, plotëson emrin, klientin dhe statusin e projektit. Po ashtu mund të zgjedhë kategori ekzistuese ose `NEW` dhe të japë emër të ri.
4. Plotëson përshkrimin e punës, njësinë, sasinë, materialin/punën për njësi, ditët, ushqimin/transportin ditor, qytetin, shpenzimet fikse, fitimin dhe TVSH-në.
5. Ndryshimi i qytetit gjen çmimin përkatës në `TRANSPORT_OPTIONS` dhe vendos çmimin standard; përdoruesi mund ta ndryshojë çmimin në fushën e transportit.
6. `watch()` i React Hook Form lexon input-et aktuale. `pricingInput` i përgatit për `PricingPreview`; ky paraqet rezultatin pa pritur ruajtjen.
7. Nëse përdoruesi e di totalin e synuar, mund të përdorë panelin “Rregullo drejt një totali synuar”. `adjustLaborToTarget()` mban ushqimin/transportin/të tjerat dhe fitimin/TVSH-në, pastaj rregullon materialin e punën proporcionalisht ose me përparësi njërës kategori. Rezultati shkruhet përsëri në formë dhe regjistrohet në audit log-un lokal.
8. Klikimi “Llogarit dhe Ruaj Rreshtin” nis `onSubmit`. Faqja kontrollon përshkrimin dhe sasinë; në dështim shfaq gabim dhe nuk thërret shërbimin e ruajtjes.
9. `saveRegisterRow(values)` kontrollon konfigurimin Supabase dhe emrat e projektit/kategorisë së re kur kërkohen. Thërret `calculatePositionPrice()` për ndarjen e kostove dhe krijon pesë expense entries: material, punë, ushqim, transport dhe të tjera.
10. Service-i thërret RPC `save_register_position`, duke dërguar ID-të ekzistuese ose payload-et e projektit/kategorisë së re, rreshtin e llogaritur dhe shpenzimet. RPC-ja duhet të kthejë ID e pozicionit, projektit dhe kategorisë.
11. Pas ruajtjes, service-i tenton të fusë një snapshot në `price_history`. Dështimi i snapshot-it kthehet veçmas si `priceHistoryError`; nuk e zhbën rreshtin që RPC-ja e ka ruajtur.
12. Faqja paraqet rreshtin e fundit të ruajtur, rifreskon kategoritë, pastron përshkrimin dhe emrat e projektit/kategorisë së re dhe përdor `showSavedToast`.

### Formula që shpjegon çka bën sistemi

```text
Materiali = sasia × çmimi material për njësi
Puna = sasia × çmimi punë për njësi
Ushqimi = ditët × çmimi ditor i ushqimit
Transporti = ditët × çmimi ditor i transportit
Të tjera = shumë fikse për pozicionin
Nëntotali = shuma e pesë kostove
Fitimi = nëntotali × fitimi%
Baza e TVSH-së = nëntotali + fitimi
TVSH = baza e TVSH-së × TVSH%
Totali = baza e TVSH-së + TVSH
Çmimi për njësi = totali / sasia
```

Ushqimi dhe transporti lidhen me ditët, jo me sasinë; të tjerat nuk shumëzohen. Formula ndahet në `lib/pricing.ts` që preview-ja, regjistrimi dhe editimi i një pozicioni të përdorin të njëjtën logjikë.

### Alternativa, gabime dhe çka ndodh pas tyre

- Nëse `description` mungon ose sasia nuk është pozitive, submit-i ndalet para thirrjes së service-it.
- Nëse po krijohet projekt/kategori dhe emri përkatës është bosh, `saveRegisterRow` e refuzon veprimin.
- Nëse Supabase/RPC dështon ose mungojnë ID-të e kthyera, shfaqet gabim; të dhënat e formës ruhen për korrigjim.
- Nëse snapshot-i dështon, shfaqen dy informata: pozicioni u ruajt, por historiku jo.
- **Vërejtje e sjelljes aktuale:** pas submit-it, forma pastron emrat e projektit/kategorisë së re, por `reset({ ...values, ... })` ruan vlerat sentinel `projectId: 'NEW'` ose `categoryId: 'NEW'`. Nëse pozicioni i parë krijoi një projekt/kategori, përdoruesi duhet të zgjedhë projektin/kategorinë konkrete nga lista para se të ruajë rreshtin e ardhshëm; në të kundërt emri i ri tashmë është bosh dhe service-i do të kërkojë emër. Kjo është pikë që mund të përmirësohet në UX.
- Përditësimi i çmimit të transportit nga qyteti ndodh përmes `useEffect`; përdoruesi mund ta mbishkruajë pastaj çmimin.

**Rezultati:** rreshti dhe kostot e tij ruhen në databazë përmes RPC-së; preview dhe toast konfirmojnë rezultatin. Kjo faqe nuk është thjesht kalkulator lokal.

---

## UC-03 — Krijo Fature (`/fature`)

**Aktori kryesor:** përdorues që përgatit faturë ose fletëdërgesë.  
**Qëllimi:** të plotësojë një shabllon ekzistues Excel dhe ta shkarkojë.  
**Nisja:** klikimi “Krijo Fature”.

### Kushtet paraprake

- Nuk kërkohet ngarkim/lexim i projekteve nga databaza.
- Duhet zgjedhur lloji i dokumentit dhe plotësuar fushat e detyrueshme.
- Shablloni përkatës duhet të jetë i qasshëm te `public/templates/`.

### Rrjedha normale — faturë kontrate

1. `InvoicePage` nis në tab-in `kontrate` me vlerat e `createKontrateDefaults()`; kompania lëshuese ka vlera fillestare, data është e sotme dhe fushat e tjera janë gati për plotësim.
2. Përdoruesi plotëson lëshuesin (emri, NUI, llogaria bankare), header-in (numri/data, klienti, adresa), të dhënat e kontratës dhe fushat e tabelës.
3. Data HTML kthehet në formatin e brendshëm përmes `fromInputDate()` dhe formatohet për input me `toInputDate()`.
4. Klikimi i shkarkimit thërret `handleExport()`. `validateKontrate()` kontrollon numrin/datën e faturës, klientin/adresën, lëshuesin, kontratën, titullin/referencën dhe totalin me TVSH (minimumi 0.01).
5. Kur validimi dështon, `setKontrateErrors()` i vendos gabimet pranë fushave dhe toast-i jep gabimin e parë; eksportuesi nuk thirret.
6. Kur validimi kalon, `downloadKontrateInvoice()` thërret ExcelJS writer-in, i cili merr template-in `Fatura - Shabllon - Kontrate.xlsx`, vendos vlerat në qelizat e njohura dhe shkarkon XLSX.
7. Eksportuesi llogarit bazën pa TVSH/TVSH nga shuma me TVSH sipas formulës së implementuar (normë fikse 18% për këtë template), jo sipas normës së çdo pozicioni të databazës.

### Rrjedha normale — fletëdërgesë me pozicione

1. Përdoruesi ndërron tab-in në `pozicione`. `handleKindChange()` ndërron pamjen dhe pastron gabimet e validimit, por ruan vlerat që janë futur në të dy format.
2. Plotëson lëshuesin, klientin, datën/vendin, titullin dhe numrin e kontratës.
3. Plotëson një ose më shumë rreshta me përshkrim, njësi, sasi dhe çmim për njësi. Mund të shtojë rresht me `addPosition()` ose ta heqë me `removePosition()`; forma e mban të paktën një rresht.
4. `validatePozicione()` kërkon së paku një rresht aktiv. Çdo rresht aktiv duhet të ketë përshkrim, njësi, sasi numerike pozitive dhe çmim jo-negativ.
5. `downloadPozicioneInvoice()` mbush template-in e fletëdërgesës. Rreshtat llogariten sasi × çmim; nëse tejkalohet hapësira standarde, writer-i zgjeron/stilizon workbook-un sipas logjikës së tij.
6. File-i XLSX shkarkohet; toast-i njofton suksesin.

### Alternativa dhe kufizime

- Format numerike sanitizohen gjatë shkrimit: vetëm shifra dhe një pikë/presje dhjetore; NUI/llogaria bankare pranojnë vetëm shifra.
- Gabimet e validimit shfaqen pranë fushave; gabimet e ngarkimit/template-it/ndërtimit kapen në `handleExport()` dhe kthehen si toast.
- **Fatura nuk ruhet në Supabase.** Të dhënat jetojnë në state të faqes. Shkarkimi është rezultati i qëndrueshëm; largimi nga faqja mund t’i humbë vlerat.
- Ndërrimi mes dy llojeve nuk i fshin form fields, vetëm errors.
- Data kontrollohet si jo-bosh në validim; nuk kryhet kontroll i veçantë që data është datë kalendarike valide përtej input-it HTML.

### Funksionet kryesore dhe pse përdoren

- `createKontrateDefaults()` / `createPozicioneDefaults()` japin forma fillestare konsistente.
- `validateKontrate()` / `validatePozicione()` ndajnë kontrollin nga UI dhe parandalojnë eksportin me fusha të detyrueshme bosh.
- `sanitizeDecimalInput()` / `sanitizeDigitsInput()` kufizojnë input-in gjatë shkrimit.
- `downloadKontrateInvoice()` / `downloadPozicioneInvoice()` zgjedhin ndërtimin përkatës.
- `faturaExport.ts` përdor template-t dhe koordinatat reale të qelizave, që dokumenti i gjeneruar të ruajë formatin e njohur.

**Rezultati:** file XLSX i shkarkuar për printim/përdorim. Nuk krijohet rekord i faturës ose pagesës.

---

## UC-04 — Krijo Libër Ndërtimor (`/import`)

**Aktori kryesor:** përdorues që ka paramasë në Excel ose dëshiron të krijojë faqe manuale.  
**Qëllimi:** të lexojë, kontrollojë, faqosë dhe eksportojë një Libër Ndërtimor.  
**Nisja:** klikimi “Krijo Libër Ndërtimor”.

### Kushtet paraprake

- Për import pranohen `.xlsx` dhe `.xls`; skedari duhet të përmbajë strukturë që parser-i njeh.
- Për eksport të saktë duhet të ekzistojnë template-t përkatëse në `public/templates/`.
- Supabase nevojitet për historik të qëndrueshëm ndër pajisje/sesione; pa të, disa rrjedha punojnë vetëm në state të faqes.

### Rrjedha A — importo Excel-in dhe kontrollo përmbajtjen

1. Në faqen e Librit, tab-i fillestar është “Ngarko Excel”. Nëse dëshiron ndërtim pa skedar, përdoruesi kalon te “Krijo Faqe” (shih rrjedhën C).
2. Opsionalisht zgjedh projekt. Projekti përdoret për sugjerim të emrit të kryesit/objektit në metadata; kjo nuk e lidh automatikisht Librin si pozicion në atë projekt.
3. Zgjedh skedarin. `handleFileUpload()` pastron rreshtat/planin e importit të mëparshëm dhe aktivizon loading.
4. `parseExcelWithValidation(file)` lexon workbook-un me SheetJS, kalon sheet-et dhe përdor parser-in e strukturuar, legacy ose parser-in specifik të Librit Ndërtimor sipas formatit.
5. Parser-i normalizon rreshtat në `ParsedRow`: numrin, përshkrimin, njësinë, sasinë, çmimin për njësi/totalin dhe metadata opsionale të sheet-it/seksionit/matjeve.
6. Nëse s’gjendet asnjë pozicion, ngarkimi refuzohet me udhëzim; nëse parsimi dështon, faqja shfaq gabim leximi.
7. Pas suksesit, faqja vendos rreshtat, totalin e deklaruar në file dhe metadata të sugjeruara nga emri i skedarit/projekti. Fushat e metadata-s që përdoruesi i ka plotësuar nuk mbishkruhen nga sugjerimi.
8. Nëse totali i deklaruar ndryshon nga ai i llogaritur më shumë se maksimumi 1 € ose 0.5%, shfaqet paralajmërim. Ky është sinjal për verifikim, jo domosdo refuzim.
9. Faqja tenton ta ruajë importin në `libri_exports` me emrin, rows, numrin dhe vlerën e pozicioneve, metadata dhe ID. Workbook-u origjinal binar nuk ruhet.
10. Nëse insert-i i historikut dështon, rreshtat mund të mbeten të lexuar në preview, por përdoruesit i tregohet që historiku s’u ruajt.

### Rrjedha B — valido seksionet, faqos dhe eksporto

1. `groupRowsBySection()` formon seksionet sipas titullit të kapur ose rrënjës së numrit të pozicionit dhe dallon titujt pa vlerë nga pozicionet reale.
2. Përdoruesi kontrollon titujt e seksioneve dhe mund t’i korrigjojë. `sectionTitleOverrides` ndikon në plan dhe në eksport.
3. `planLibriExport()` lidh grupimin e seksioneve me `packSectionIntoPages()` në `libriPaging.ts`. Planifikuesi provon template-t 1–5 pozicione dhe zgjedh faqen më të madhe që nuk e tejkalon kapacitetin e përshkrimeve. Seksionet nuk përzihen automatikisht në të njëjtën faqe.
4. `ParamasaPreview` shfaq faqet dhe paralajmërimet e njësive të përziera/përshkrimeve të gjata; përdoruesi mund të shohë preview tabelor ose pamje të Librit.
5. Përdoruesi mund të kalojë në manual dhe të bashkojë/ndajë faqet ose të zhvendosë pozicione. `libriPlanEditor.ts` i validon operacionet. `serializeLibriExportPlan()` ruan indekset dhe kërkon mbulim të saktë të rreshtave pa dublikime.
6. Ndryshimet e layout-it mund të ruhen me veprimin e ruajtjes në preview. Për rekord ekzistues, faqosja ruhet te metadata e `libri_exports`; përditësimi serializohet dhe dërgohet në service. Disa ndryshime sinkronizohen edhe me debounce/queue në faqe.
7. “Shkarko Libër Ndërtimor” krijon workbook me disa faqe. “Shkarko çdo faqe veç e veç” krijon ZIP me XLSX për secilën faqe. Para shkarkimit, faqja përpiqet të ruajë layout-in aktual.
8. `libriExport.ts` ngarkon template-in për secilën faqe, kopjon formatimin e workbook-ut dhe mbush metadata, përshkrimet dhe matjet. Skedari final shkarkohet nga browser-i.
9. Warning-u për tekst të gjatë ose njësi të përziera i shfaqet përdoruesit edhe pas shkarkimit që ta kontrollojë output-in.
10. “Përfundo” ruan layout-in aktual nëse ka ID historiku dhe pastaj navigon në ballinë. Nuk është i njëjtë me klikimin e download-it.

### Rrjedha C — krijo faqe manualisht

1. Përdoruesi zgjedh tab-in “Krijo Faqe”.
2. `ManualPageBuilder` mban metadata/rreshtat në state të komponentit. Përdoruesi zgjedh template 1–5 pozicione dhe plotëson rreshtat.
3. Rreshtat ndahen në faqe sipas kapacitetit të template-it; preview paraqet strukturën dhe përdoruesi mund të shkarkojë faqe.
4. Ky proces nuk thërret automatikisht `saveLibriExportRecord`; faqet manuale nuk hyjnë vetvetiu në historikun që vjen nga importet.

### Historiku i Librave

- Faqja lexon deri në 50 importet më të reja nga `fetchLibriExportRecords()` dhe UI i paraqet pesë rekorde për faqe.
- “Shiko” rikthen planin e ruajtur dhe lejon kontroll/ndryshim të layout-it të rekordit historik.
- “Shkarko përsëri” rindërton workbook-un nga rows/meta/layout i ruajtur, jo nga Excel-i origjinal.
- “Fshi” kërkon konfirmim dhe fshin rekordin e historikut; kjo nuk është e njëjtë me fshirjen e projektit/pozicioneve.
- Nëse layout-i është i pavlefshëm ose mungon, rikthimi mund të bjerë te planifikimi automatik.

### Pse ka parser, planner dhe writer të ndarë?

- `excel.ts` standardizon burime të ndryshme Excel në një model `ParsedRow`.
- `paramasaPreview.ts` identifikon seksionet, që numërimi i pozicionit të mos mjaftojë i vetëm për titujt.
- `libriPaging.ts` mbron hapësirën e template-it dhe minimizon faqet pa futur përshkrime që nuk hyjnë.
- `libriExportPlan.ts` bën faqosjen të serializueshme dhe të verifikueshme në histori.
- `libriPlanEditor.ts` izolon operacionet manuale nga UI.
- `libriExport.ts` merret vetëm me workbook-un final dhe shkarkimin.

**Rezultati:** workbook XLSX/ZIP i shkarkuar; me Supabase aktiv, importi dhe faqosja mund të rikthehen nga historiku. Përdoruesi gjithsesi duhet të kontrollojë preview-n dhe dokumentin final.

---

## UC-05 — Të Dhënat (`/data`)

**Aktori kryesor:** përdorues që menaxhon oferta të regjistruara.  
**Qëllimi:** të gjejë projekte/pozicione ekzistuese, të përditësojë metadata dhe analiza, të krahasojë oferta ose të eksportojë CSV.  
**Nisja:** klikimi “Të Dhënat”.

### Rrjedha e ngarkimit dhe përzgjedhjes

1. `DataPage` nis `reloadProjects()` dhe `loadComparePool()`.
2. `reloadProjects()` siguron kategoritë standarde, lexon projektet më të rejat, merr përmbledhjet e kategorive dhe ruan listat në state.
3. Panelet e paraqesin listën e projekteve me filtra statusi dhe kërkim sipas emrit.
4. Përdoruesi klikon projektin. `loadProjectDetails()` ngarkon pozicionet më të reja të projektit dhe kostot e tyre nga `item_expenses`. Kostoja llogaritet vetëm kur ka të dhëna; mungesa e kostove paraqitet si “pa kosto”, jo si zero e sigurt.
5. Përdoruesi mund të zgjedhë kategori në vend të projektit. `loadCategoryDetails()` gjen kategori me emër të normalizuar dhe pozicionet përputhëse në projekte të ndryshme; `groupItemsByProject()` krijon grupet.
6. `detailRequestId` identifikon kërkesën më të fundit, që një query i vonuar i projektit të mëparshëm të mos mbishkruajë zgjedhjen e re.
7. Fusha “Kërko pozicione” filtron lokalisht pozicionet e projektit sipas përshkrimit/numrit, pasi janë ngarkuar.

### Redakto dhe ruaj një pozicion

1. Klikimi edit në `PositionCard` thërret `startEdit(item)`.
2. `startEdit()` lexon `item_expenses`, merr kostot dhe përqindjet ekzistuese dhe i vendos në `editForm`. Gabimi gjatë leximit ndal redaktimin.
3. Përdoruesi ndryshon fushat; preview-ja brenda kartës tregon llogaritjen.
4. `saveRowEdit()` kontrollon përshkrimin, sasinë pozitive dhe ditët jo-negative.
5. `calculatePositionPrice()` llogarit ndarjen e re; përgatiten pesë zëra shpenzimesh.
6. `update_project_position` përditëson pozicionin dhe shpenzimet përkatëse. Në gabim, përdoruesit i tregohet që ndryshimi s’u ruajt dhe editimi mund të vazhdojë.
7. Pas suksesit, `recordPriceSnapshot()` shton një rekord të ri në histori. Dështimi i snapshot-it raportohet veçmas, sepse pozicioni tashmë është ruajtur.
8. Faqja mbyll edit mode, rifreskon detajet/projektet dhe njofton me `showSavedToast`.

### Ndrysho metadata/koston reale të projektit

1. Kur projekti zgjidhet, state i formës plotësohet nga klienti, statusi, përshkrimi, kostoja reale dhe shënimet ekzistuese.
2. Përmbledhja financiare mbledh ofertën me TVSH, heq TVSH-në pozicion pas pozicioni dhe paraqet koston e regjistruar në expense entries.
3. Përdoruesi vendos koston reale finale dhe mund të shohë paraprakisht `oferta pa TVSH − kosto reale`.
4. `saveProjectMeta()` validon që kostoja finale është numër jo-negativ dhe thërret `updateProject()`.
5. Pas suksesit, projekti dhe analytics rifreskohen pa reload të plotë; toast-i lëviz faqen në krye.

Kostoja reale finale e projektit nuk është çmimi i ofertës. Është shpenzimi real i futur nga përdoruesi; “fitimi real” që paraqitet varet nga saktësia e kësaj vlere dhe e ofertës.

### Krahasimet, analiza dhe eksporti

- `ComparePositions` merr pool-in e pozicioneve dhe shfaq dy pozicione të zgjedhura krah për krah me diferencën e çmimit për njësi dhe totalit.
- `CategoryProjectCompare` krahason subtotalet e një kategorie mes projekteve dhe përdor subtotalin më të lartë si referencë.
- `analyzeSelectedProject()` krijon sugjerime heuristike: total, numër pozicionesh, çmim mesatar për njësi, pesë pozicionet më të shtrenjta dhe sasitë zero. Këto janë sinjale të thjeshta, jo analizë automatike inxhinierike.
- `PriceHistoryDashboard` merr analizën e kostove/fitimit sipas projektit; `RevenueTrendChart` paraqet vlerën e ofertave në gjashtë muajt kalendarikë sipas datës së krijimit të projektit.
- `handleExport()` thërret `exportProjectCSV()` për pozicionet e projektit të zgjedhur dhe shkarkon CSV.

### Fshirja

- Fshirja e projektit kërkon konfirmim dhe thërret `deleteProject()`. Kodi pret që foreign key/cascade i databazës t’i fshijë pozicionet dhe shpenzimet e lidhura.
- Fshirja e pozicionit kërkon konfirmim dhe thërret `deletePosition()`; databaza pritet t’i fshijë shpenzimet e tij me cascade. Kodi dokumenton se snapshot-et historike mbeten.
- Fshirja e kategorisë kërkon konfirmim; pozicionet pritet të mbeten pa kategori. Kategoritë standarde mund të rikrijohen nga `ensureDefaultCategories()` herën tjetër.
- Fshirjet rifreskojnë listat/detajet sipas rastit, por përdorin toast të zakonshëm, jo sjelljen `showSavedToast` që lëviz faqen në krye.

### Kufizime

- Të dhënat reale financiare varen nga `item_expenses` dhe `actual_total_cost`; “pa të dhëna” nuk është e barabartë me zero shpenzim.
- “Fitimi i pritshëm” është ofertë pa TVSH minus kostot e regjistruara; nuk është fitim i verifikuar nga kontabiliteti.
- Query-t e listimit bëhen pjesërisht direkt nga faqja, pjesërisht nga service-et; Supabase RLS mbetet kontrolli i qasjes së databazës.
- Përditësimi i pozicionit ruan snapshot të ri, por paneli aktual financiar fokusohet te struktura/fitimi dhe jo grafiku kohor i snapshot-eve.

**Rezultati:** përdoruesi sheh dhe menaxhon të dhënat ekzistuese, ndërsa veprimet e ruajtjes/fshirjes ndryshojnë Supabase sipas funksionit përkatës.

---

## UC-06 — Kërko (`/search`)

**Aktori kryesor:** përdorues që kërkon një pozicion të ruajtur.  
**Qëllimi:** të gjejë pozicione pa hapur një nga një projektet.  
**Nisja:** klikimi “Kërko”.

### Kushtet paraprake

- Supabase duhet të jetë aktiv për rezultate reale.
- Kërkesa nis vetëm pasi query të ketë të paktën dy karaktere pas trim-it.

### Rrjedha normale

1. `SearchPage` menaxhon query-n me React Hook Form (`watch('query')`).
2. Kur query është më i shkurtër se dy karaktere, rezultatet/gabimi pastrohen dhe kërkimi ndalet.
3. Për query të vlefshëm vendoset timer 350 ms. Ky debounce pret derisa përdoruesi të ndalet së shkruari, që të mos dërgohet kërkesë për çdo karakter.
4. Para kërkesës hiqen rezultatet e vjetra dhe aktivizohet loading.
5. `searchPositions(trimmed)` kërkon paralelisht përshkrimet e pozicioneve dhe emrat e projekteve, pastaj për numrin e pozicionit dhe emrat e kategorive.
6. Nëse përputhet emri i projektit/kategorisë, service-i merr pozicionet që i përkasin atij ID-je.
7. Rezultatet bashkohen sipas ID-së në `Map`, që një pozicion i gjetur nga disa kushte të mos përsëritet, dhe renditen më të rejat të parat. Query-t direkte për pozicione kufizohen në deri 50 rreshta secila; kërkimet e ID-ve të projekteve/kategorive nuk kanë limit të vendosur në këtë service.
8. UI-ja paraqet numrin e rezultateve, projektet/kategoritë unike, shumën e total-price dhe tabelën me projekt/kategori/numër/përshkrim/total.

### Alternativa dhe gabime

- Pa dy karaktere: udhëzuesi i kërkimit shpjegon çka mund të kërkohet.
- Gjatë kërkesës: shfaqet “Duke kërkuar…”.
- Pa rezultate: paraqitet gjendje bosh.
- Gabimi i query shfaqet në faqe; nuk paraqitet sikur kërkimi ka përfunduar me sukses.
- `active` dhe cleanup-i i `useEffect` anulojnë timer-in dhe injorojnë rezultatin e kërkesës së vjetër pas ndryshimit të query-t/çmontimit të faqes.
- Shuma e paraqitur përfshin rezultatet e gjetura dhe nuk garanton që është total i një projekti/ofertë unike.

### Pse ky model?

- Debounce-i ul ngarkesën e query-ve pa kërkuar buton submit.
- Search-i në service bashkon përputhjen e përshkrimit, numrit, projektit dhe kategorisë në një pikë.
- Deduplikimi parandalon paraqitjen disa herë të të njëjtit pozicion.
- Limitet shmangin shkarkimin e pakufizuar të rreshtave në çdo kërkim.

**Rezultati:** listë e lexueshme e pozicioneve që përputhen; kërkimi nuk ndryshon asnjë të dhënë.

---

## UC-07 — Profili (`/profile`)

**Aktori kryesor:** përdorues i kyçur; disa veprime janë vetëm për administrator.  
**Qëllimi:** të shohë llogarinë, ndryshojë fjalëkalimin, ruajë backup ose administrojë aplikimet.  
**Nisja:** klikimi “Profili”.

### Kushtet paraprake

- Për veprimet reale të llogarisë kërkohet Supabase config dhe user i vlefshëm.
- Paneli i administrimit shfaqet vetëm nëse konteksti e njeh përdoruesin si `admin` dhe `approved`.

### Rrjedha e përdoruesit të zakonshëm

1. `ProfilePage` lexon `user`, `profile`, `isAdmin`, `changePassword` dhe `signOut` nga `useAuth`.
2. Paraqet email-in, ID-në dhe kohën e hyrjes së fundit.
3. Përdoruesi plotëson fjalëkalimin aktual, të riun dhe konfirmimin.
4. React Hook Form kërkon fushat dhe vendos minimumin e gjatësisë për të riun/konfirmimin.
5. `handlePasswordChange()` i krahason fjalëkalimet e reja dhe kontrollon që i riu të mos jetë i njëjtë me aktualin.
6. `changePassword()` në AuthContext ri-autentikon përdoruesin me fjalëkalimin aktual dhe vetëm pastaj i kërkon Supabase-it ta ndryshojë.
7. Në gabim, forma mbahet dhe paraqitet gabimi. Në sukses, forma pastrohet, mesazhi shfaqet dhe thirret `showSavedToast`.
8. “Shkarko backup (JSON)” thërret `exportAllDataJson()`. Service-i lexon faqet e gjashtë tabelave të të dhënave (1000 rreshta për faqe), krijon JSON me version/formë dhe e shkarkon në browser.
9. “Dil nga llogaria” thërret `signOut()` dhe navigon te `/login`.

### Rrjedha e administratorit

1. Nëse `isAdmin` është true, effect-i thërret `reloadProfiles()`.
2. `fetchUserProfiles()` ngarkon profilet; faqja numëron totalin, në pritje, aprovuar dhe refuzuar.
3. Administratori mund të aprovojë/refuzojë profilet në pritje ose pezullojë profile të aprovuara, përveç llogarisë së vet në rastin përkatës të UI-së.
4. `handleProfileStatus()` kërkon konfirmim, vendos identifikuesin e veprimit për loading/disabled, thërret `updateUserApproval()` dhe pastaj ringarkon listën.
5. Në sukses shfaqet toast; në gabim shfaqet mesazhi i service-it.

### Timeout dhe përmbledhje

- `AuthContext` vendos timeout pas 60 minutash pa aktivitet dhe thërret sign-out. Eventet e mouse/keyboard/scroll/touch e rifreskojnë timer-in.
- Paneli anësor shfaq rolin/statusin dhe një tregues “60 min”; kjo është paraqitje e timeout-it të menaxhuar në AuthContext.

### Alternativa dhe kufizime të backup-it

- Pa Supabase ose user, faqja tregon se Auth s’është aktiv në vend të formës së llogarisë.
- Backup-i dështon me mesazh nëse një nga tabelat nuk lexohet; nuk shkarkohet JSON i paplotë si sukses.
- Backup-i përfshin `projects`, `categories`, `project_items`, `item_expenses`, `price_history`, `libri_exports`; **nuk përfshin `profiles` dhe nuk është dump i plotë i konfigurimit Supabase**.
- Administrimi në UI nuk zëvendëson autorizimin e databazës. Politikat RLS duhet të ndalojnë veprimet e paautorizuara edhe kur dikush tenton query jashtë UI-së.

**Rezultati:** ndryshim i fjalëkalimit, file backup, ndryshim i statusit të një aplikimi ose përfundim i sesionit. Këto janë veprime të ndryshme dhe kanë rezultate të ndryshme.

---

## UC-08 — Rreth Nesh (`/about-us`)

**Aktori kryesor:** përdorues që dëshiron informacion prezantues për kompaninë/platformën.  
**Qëllimi:** të shohë përshkrimin e kompanisë, shërbimet, misionin, vlerat dhe lidhjet e shpejta.  
**Nisja:** klikimi “Rreth Nesh”.

### Rrjedha normale

1. Router-i shfaq `AboutUsPage`.
2. `AboutUsPage` e mbështjell `CompanyHomeIntro` brenda `Shell`.
3. `CompanyHomeIntro` paraqet tekstin, kartat e shërbimeve, KPI-të statike, partnerët dhe butonat/lidhjet drejt kërkimit, të dhënave dhe seksionit “Rreth Nesh”.
4. Përdoruesi mund të ndjekë një nga lidhjet brenda aplikacionit për të hapur Search ose Data.

### Çfarë nuk ndodh në këtë faqe?

- Nuk bëhet query në Supabase.
- KPI-të si “100+” ose “10+ vjet” janë vlera statike të vendosura në komponent; nuk llogariten nga databaza. Duhet të konfirmohen nga pronari i projektit para prezantimit publik.
- Faqja nuk krijon, përditëson apo shkarkon rekord.
- Teksti përmban identitete/marka të kompanisë; përputhshmëria MEGRANT ING/GRANITI SH.P.K. duhet kontrolluar si përmbajtje, jo si logjikë programore.

**Rezultati:** vetëm informacion prezantues dhe navigim; asnjë ndryshim i të dhënave.

---

## Përmbledhje krahasuese: ku shkojnë të dhënat?

| Rasti | Lexon Supabase | Shkruan Supabase | Ruhet vetëm në state/browser | Krijon file |
|---|---:|---:|---:|---:|
| Faqja Kryesore | Po | Jo | Filtri i statusit/veprimi aktual | Opsionalisht XLSX i Librit të fundit |
| Regjistro | Po, projekte/kategori | Po, përmes `save_register_position`, pastaj snapshot | Vlerat e formës/preview para submit-it | Jo |
| Krijo Fature | Jo | Jo | Po, deri te largimi/rifreskimi i faqes | Po, XLSX |
| Krijo Libër Ndërtimor | Po, projekte/historik kur ka Supabase | Po, historik dhe layout; jo workbook origjinal | Rows/metadata/plan ndërsa punohet | Po, XLSX/ZIP/print |
| Të Dhënat | Po | Po, editim/fshirje/metadatat | Filtra/zgjedhje/preview | Po, CSV |
| Kërko | Po | Jo | Query dhe rezultatet | Jo |
| Profili | Po | Po, password/status; backup është lexim | Gjendje forme/konfirmime | Po, JSON |
| Rreth Nesh | Jo | Jo | Asnjë state domethënës | Jo |

## Si ta prezantosh një use case

Kur e shpjegon sistemin në mbrojtje, për çdo rast ndiq të njëjtën renditje:

1. **Kush e nis veprimin dhe çfarë kërkon të arrijë?**
2. **Çfarë të dhënash i duhen para fillimit?**
3. **Cila faqe pranon input-in dhe ku validohet?**
4. **Cili funksion bën llogaritjen ose transformimin?**
5. **Ku ruhet rezultati: Supabase, state i përkohshëm apo file i shkarkuar?**
6. **Çfarë sheh përdoruesi në sukses dhe në gabim?**
7. **Çfarë nuk bën ky proces?** Për shembull: fatura e gjeneruar nuk do të thotë që u regjistrua pagesa.

Kjo mënyrë e shpjegimit lidh ekranin me logjikën dhe rezultatin, dhe shmang pretendimet që UI-ja nuk i garanton.
