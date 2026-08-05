# Përmbledhje dhe Review i Projektit

Ky dokument jep një përmbledhje të plotë të projektit **Graniti Web**, duke shpjeguar çfarë bën secila faqe, komponent, shërbim dhe utilitar, si dhe pse është përdorur secila pjesë e arkitekturës.

## 1. Qëllimi i projektit

Projekti është një panel administrativ për menaxhimin e **paramasave, ofertave, faturave dhe të dhënave të projekteve ndërtimore**. Ai shërben për:

- regjistrim manual të pozicioneve me kosto të detajuara,
- import Excel për paramasa,
- gjenerim të Librit Ndërtimor,
- kërkim global në të dhëna,
- krahasim projektesh dhe kategorish,
- historik çmimesh dhe analiza,
- autentikim dhe mbrojtje të faqeve me Supabase.

## 2. Teknologjitë e përdorura dhe pse

- React 18: për UI me komponentë të ripërdorshëm dhe gjendje interaktive.
- TypeScript: për tipizim, ulje gabimesh dhe strukturim më të qartë të të dhënave.
- Vite: për build të shpejtë dhe dev server të lehtë.
- React Router 6: për navigim mes faqeve pa rifreskim të plotë.
- Supabase: për Auth, PostgreSQL, dhe RLS; mban backend-in e të dhënave pa server të veçantë.
- react-hook-form: për forma me pak boilerplate dhe validim të pastër.
- xlsx / exceljs / jszip: për lexim dhe gjenerim Excel/ZIP.
- lucide-react: për ikona moderne dhe të lehta.
- victory: për grafika dhe dashboard vizual.
- date-fns: për punë me data dhe formate kohore.

## 3. Arkitektura kryesore

App-i nis nga [App.tsx](App.tsx), ku vendosen provider-at globalë:

- `ThemeProvider` për temën light/dark,
- `AuthProvider` për sesionin dhe funksionet e login/register,
- `ToastProvider` për njoftime vizuale,
- `BrowserRouter` për routet.

Pastaj, `ProtectedRoute` mbron faqet që kërkojnë autentikim. Struktura e faqeve është e ndarë sipas funksionit:

- faqe hyrëse dhe ballina,
- regjistrim pozicionesh,
- krijim faturash,
- import dhe eksport Libri Ndërtimor,
- të dhëna dhe analiza,
- kërkim global,
- profil përdoruesi.

## 4. Faqet e aplikacionit

### [src/pages/HomePage.tsx](src/pages/HomePage.tsx)

Faqja kryesore dhe paneli i gjendjes.

- Shfaq statistika bazë: projekte, kategori, pozicione dhe vlerën totale.
- Merr të dhëna nga Supabase për projektet dhe kategoritë.
- Llogarit statuset e projekteve dhe liston projektet në proces.
- Përdor `InsightsCharts` për grafikë dhe `StatusBadge` për statuset.
- Përdor `Shell` për layout uniform të gjithë aplikacionit.

Pse është përdorur: kjo faqe i jep përdoruesit një pamje të shpejtë të sistemit pa hyrë në menutë tjera.

### [src/pages/RegisterPage.tsx](src/pages/RegisterPage.tsx)

Faqja për regjistrimin manual të një pozicioni.

- Menaxhon projektin, kategorinë, përshkrimin, sasinë dhe komponentët e kostos.
- Llogarit çmimin përmes logjikës së pricing-ut.
- Përdor `PricingPreview` për ta parë rezultatin para ruajtjes.
- Përdor `pushAdjustLog` për auditim kur rregullohet materiali/puna ndaj target-it.
- Përdor `ensureDefaultCategories` dhe `saveRegisterRow` për ruajtje në databazë.
- Mbush transportin automatikisht sipas vendit nga `TRANSPORT_OPTIONS`.

Pse është përdorur: kjo është forma kryesore për futje manuale të pozicioneve me logjikë të detajuar të çmimit.

### [src/pages/InvoicePage.tsx](src/pages/InvoicePage.tsx)

Faqja për krijim faturash.

- Ofron dy lloje faturash: `Kontrate` dhe `Pozicione`.
- Përdor validim për fushat dhe sanitizim të input-it.
- Gjeneron eksportin përmes `downloadKontrateInvoice` dhe `downloadPozicioneInvoice`.
- Ndërton formularë të ndarë në pjesë me nën-komponentë si `IssuerFields`, `SharedHeaderFields`, `KontrateForm`.

Pse është përdorur: të dhënat e faturës janë të strukturuara ndryshe nga paramasat dhe kërkojnë formë më të posaçme.

### [src/pages/ImportPage.tsx](src/pages/ImportPage.tsx)

Faqja për import Excel dhe gjenerim të Librit Ndërtimor.

- Lexon skedarin Excel me `parseExcelWithValidation`.
- Grumbullon rreshtat sipas seksioneve me `groupRowsBySection`.
- Krijon preview të faqes me `ParamasaPreview`.
- Ofron gjenerim të workbook-it dhe ZIP-it për secilën faqe.
- Ruhet historiku i eksporteve me `saveLibriExportRecord`, `fetchLibriExportRecords` dhe `deleteLibriExportRecord`.
- Ka edhe tab për `ManualPageBuilder`, për krijim faqesh pa Excel.

Pse është përdorur: kjo është pjesa që lidh importin nga Excel me eksportin final të Librit Ndërtimor.

### [src/pages/DataPage.tsx](src/pages/DataPage.tsx)

Faqja për menaxhimin dhe analizën e të dhënave.

- Liston projekte, kategori dhe pozicione.
- Lejon editim, fshirje dhe përditësim të projektit.
- Krahasohet pozicioni mes dy elementeve me `ComparePositions`.
- Krahasohen projekte/kategori me `CategoryProjectCompare`.
- Shfaq historikun e çmimeve me `PriceHistoryDashboard`.
- Mund të regjistrohet snapshot çmimi me `recordPriceSnapshot`.
- Krijon analizë të thjeshtë heuristike për projektin e zgjedhur.

Pse është përdorur: kjo faqe është qendra e administrimit të të dhënave dhe analizës së biznesit.

### [src/pages/SearchPage.tsx](src/pages/SearchPage.tsx)

Faqja e kërkimit global.

- Kërkon në përshkrim, numër pozicioni dhe emër projekti.
- Përdor debounce që të mos bëjë query për çdo karakter menjëherë.
- Shfaq rezultatet në tabelë të thjeshtë.

Pse është përdorur: për kërkim të shpejtë në një databazë që mund të rritet me shumë pozicione.

### [src/pages/ProfilePage.tsx](src/pages/ProfilePage.tsx)

Faqja e profilit.

- Shfaq email-in dhe informacionin e përdoruesit.
- Lejon ndryshim password-i.
- Lejon shkarkim të backup-it JSON me `exportAllDataJson`.
- Përfundon sesionin me `signOut`.

Pse është përdorur: i jep përdoruesit kontroll bazik mbi llogarinë dhe eksportin e të dhënave.

### [src/pages/LoginPage.tsx](src/pages/LoginPage.tsx)

Faqja e autentikimit.

- Mbështet `login`, `register`, `forgot`, dhe `updatePassword`.
- Punon me `useAuth` për hyrje, regjistrim dhe recovery.
- Ndërron temën me `useTheme`.
- Kur Supabase nuk është konfiguruar, tregon mesazh fallback dhe lejon vazhdim pa auth.

Pse është përdorur: kjo faqe e bën panelin të aksesueshëm vetëm për përdoruesit e autorizuar ose në modalitet provë.

## 5. Komponentët e përbashkët

### [src/components/Shell.tsx](src/components/Shell.tsx)

Layout-i bazë i aplikacionit.

- Përmban sidebar me navigim.
- Përfshin toggle për temën.
- Ruan një përvojë të njëjtë në të gjitha faqet.

### [src/components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx)

Mbrojtja e route-ve.

- Kontrollon `useAuth`.
- Nëse auth mungon, ridrejton në `/login`.
- Nëse Supabase s’është konfiguruar, lejon shfaqjen e përmbajtjes si fallback.

### [src/components/StatusBadge.tsx](src/components/StatusBadge.tsx)

Badge vizual për statusin e projektit.

Përdoret kudo ku projekti ka status `draft`, `in_progress` ose `completed`.

### [src/components/InsightsCharts.tsx](src/components/InsightsCharts.tsx)

Grafikët e analizës.

- Shfaq të dhëna për projektet dhe kategoritë.
- Përdor `victory` për vizualizim.

### [src/components/RevenueTrendChart.tsx](src/components/RevenueTrendChart.tsx)

Grafik i trendit të të ardhurave.

Përdoret për analizë kohore dhe krahasim të vlerave.

### [src/components/PriceHistoryDashboard.tsx](src/components/PriceHistoryDashboard.tsx)

Pamja e historikut të çmimeve.

Përdoret në `DataPage` për të parë ndryshimet e çmimeve sipas kategorive ose projekteve.

### [src/components/ComparePositions.tsx](src/components/ComparePositions.tsx)

Krahason dy pozicione në dy slot-e të ndryshëm.

Përdoret për analizë krahasuese të kostove dhe përbërjes.

### [src/components/CategoryProjectCompare.tsx](src/components/CategoryProjectCompare.tsx)

Krahason projekte brenda një kategorie.

Përdoret për të parë shpërndarjen e vlerave në nivel kategori.

### [src/components/PositionCard.tsx](src/components/PositionCard.tsx)

Card për një pozicion të vetëm.

Përdoret për prezantim të qartë të një rreshti, me çmim, total dhe metadata.

### [src/components/EditModal.tsx](src/components/EditModal.tsx)

Modal i përgjithshëm për editime.

Përdoret kur ndryshohen të dhëna pa dalë nga faqja.

### [src/components/PricingPreview.tsx](src/components/PricingPreview.tsx)

Preview i çmimit.

Përdoret në regjistrim për të parë si del llogaritja finale.

### [src/components/ParamasaPreview.tsx](src/components/ParamasaPreview.tsx)

Preview i Librit Ndërtimor / paramasës.

- Përdor të njëjtin motor paketimi si eksporti real.
- Ofron shikim të faqeve para shkarkimit.
- Lejon download të çdo faqeje veçmas.
- Në modalitet redaktimi, mund të modifikohen rreshtat direkt në preview.

### [src/components/ManualPageBuilder.tsx](src/components/ManualPageBuilder.tsx)

Ndërtues manual i faqeve.

- Lejon zgjedhje shablloni nga 1 deri në 5 pozicione për faqe.
- Ndërton metadata manualisht.
- E ndan listën në faqe sipas kapacitetit të shabllonit.
- Gjeneron workbook për secilën faqe.

Pse është përdorur: për raste kur importi nga Excel nuk është i nevojshëm ose kur përdoruesi do kontroll të plotë manual.

## 6. Context dhe hooks

### [src/context/AuthContext.tsx](src/context/AuthContext.tsx)

Menaxhon autentikimin.

- Merr sesionin aktual nga Supabase.
- Dëgjon ndryshimet e auth state.
- Ofron `signIn`, `signUp`, `resetPassword`, `updatePassword`, `changePassword`, `signOut`.
- Ruajtja e `recoveryMode` e bën rrjedhën e password recovery të qartë.

### [src/context/ThemeContext.tsx](src/context/ThemeContext.tsx)

Menaxhon temën light/dark.

- Ruhet në `localStorage`.
- Aplikohet në `document.documentElement`.

### [src/context/ToastContext.tsx](src/context/ToastContext.tsx)

Sistemi i njoftimeve.

- Ofron `showToast`.
- Toast-et hiqen automatikisht pas pak sekondash.

### [src/hooks/useAuth.ts](src/hooks/useAuth.ts)

Hook i thjeshtë për lexim të `AuthContext`.

### [src/hooks/useTheme.ts](src/hooks/useTheme.ts)

Hook i thjeshtë për lexim të `ThemeContext`.

## 7. Shërbimet

### [src/services/categories.ts](src/services/categories.ts)

- `ensureDefaultCategories`: siguron kategoritë bazë.
- `deleteCategory`: fshin kategori.
- `groupItemsByProject`: grupon pozicionet sipas projektit.

Pse: standardizon kategoritë dhe mban strukturën e të dhënave të pastër.

### [src/services/projects.ts](src/services/projects.ts)

- `fetchCompletedProjects`: projekte referencë.
- `updateProject`: përditësim metadata të projektit.
- `deleteProject`: fshirje projekti.
- `deletePosition`: fshirje pozicioni.
- `exportAllDataJson`: backup total JSON.

### [src/services/register.ts](src/services/register.ts)

- `saveRegisterRow`: ruan një rresht të ri me logjikën e çmimeve.

### [src/services/search.ts](src/services/search.ts)

- `searchPositions`: query global në pozicione.

### [src/services/stats.ts](src/services/stats.ts)

- `fetchDashboardStats`: statistika për home page.

### [src/services/insights.ts](src/services/insights.ts)

- `fetchProjectSummaries`: totalet sipas projektit.
- `fetchCategorySummaries`: totalet dhe numërimi sipas kategorive.
- `fetchMonthlyRevenueTrend`: trend mujor i të ardhurave.
- `fetchTotalSystemValue`: vlera totale e sistemit.

### [src/services/priceHistory.ts](src/services/priceHistory.ts)

- `recordPriceSnapshot`: ruan snapshot të çmimeve.
- `fetchPriceTrend`: trend i çmimeve.
- `fetchProfitSummaryByProject`: përmbledhje fitimi për projekte.

### [src/services/export.ts](src/services/export.ts)

- `exportProjectCSV`: eksporton projektin në CSV.

### [src/services/libriExports.ts](src/services/libriExports.ts)

- `saveLibriExportRecord`: ruan eksportin dhe metadata.
- `fetchLibriExportRecords`: lexon historikun.
- `deleteLibriExportRecord`: fshin një eksport të ruajtur.

## 8. Libraritë dhe utilitarët

### [src/lib/supabase.ts](src/lib/supabase.ts)

- Krijon klientin Supabase vetëm kur ka URL dhe anon key.
- `hasSupabaseConfig` përdoret në disa faqe për fallback.

### [src/lib/pricing.ts](src/lib/pricing.ts)

- `calculatePositionPrice`: llogarit koston për pozicionin.

Pse: e ndan logjikën e çmimit nga UI-ja.

### [src/lib/faturaValidation.ts](src/lib/faturaValidation.ts)

- Sanitizon input-et numerike.
- Validon faturat dhe kontratat.

### [src/lib/faturaExport.ts](src/lib/faturaExport.ts)

- Gjeneron dhe shkarkon faturat në format Excel / workbook.

### [src/lib/excel.ts](src/lib/excel.ts)

- Lexon Excel-in dhe e kthen në rreshta të strukturuar.

### [src/lib/paramasaPreview.ts](src/lib/paramasaPreview.ts)

- `getSectionLabel`: etiketon seksionin.
- `getRowIndentLevel`: llogarit nivelin e indentimit.
- `groupRowsBySection`: ndan rreshtat sipas seksionit.
- `splitParamasaPages`: i ndan për preview faqe.

### [src/lib/paramasaExport.ts](src/lib/paramasaExport.ts)

- `buildParamasaFinalHtml`: krijon HTML final për eksport.

### [src/lib/libriExport.ts](src/lib/libriExport.ts)

- `extractSectionAccountNumber`: nxjerr numrin e llogarisë nga seksioni.
- `buildLibriExportPositions`: përgatit pozicionet për export.
- `planLibriExport`: planifikon se si ndahen faqet.
- `downloadWorkbookBuffer`: shkarkon workbook-in.
- `downloadBlob`: shkarkon blob-in.

Pse: ky është motori kryesor i ndarjes dhe eksportit të Librit Ndërtimor.

### [src/lib/libriNdertimor.ts](src/lib/libriNdertimor.ts)

- `isLibriNdertimorSheet`: identifikon nëse një sheet është Libër Ndërtimor.
- `parseLibriSheet`: lexon strukturën e sheet-it.

### [src/lib/libriPaging.ts](src/lib/libriPaging.ts)

- `TEMPLATE_SLOTS`: përkufizon kapacitetet e shablloneve.
- `packSectionIntoPages`: paketim i seksioneve në faqe.

### [src/lib/audit.ts](src/lib/audit.ts)

- `readAdjustLogs`, `pushAdjustLog`, `clearAdjustLogs`.

Përdoret për historik lokal të rregullimeve të çmimeve.

### [src/lib/dates.ts](src/lib/dates.ts)

- `formatDateTime` dhe `wasUpdated` për shfaqje kohore.

## 9. Tipet dhe konstantet

### [src/types/database.ts](src/types/database.ts)

Definon tipet kryesore të databazës:

- `DbProject`
- `DbCategory`
- `DbProjectItem`
- `ItemWithMeta`
- `ProjectSummary`
- `CategorySummary`
- `SearchResultItem`
- `DbLibriExport`
- `DbPriceHistory`

Pse: këto tipa e bëjnë punën me Supabase shumë më të sigurt dhe më të qartë.

### [src/types/fatura.ts](src/types/fatura.ts)

Definon formën e faturave dhe helper-at për default values.

### [src/types/paramasaMeta.ts](src/types/paramasaMeta.ts)

Definon metadata e paramasës dhe të librit ndërtimor.

### [src/constants/projectStatus.ts](src/constants/projectStatus.ts)

- `PROJECT_STATUSES` për draft / në proces / përfunduar.
- `statusLabel` për etiketim të statusit.

### [src/constants/transport.ts](src/constants/transport.ts)

- Lista e qyteteve dhe çmimet e transportit.

Pse: shmang input të lirë për transportin dhe standardizon llogaritjen.

## 10. Review teknik

### Pikat e forta

- Arkitekturë e ndarë mirë mes faqeve, shërbimeve dhe utilities.
- Përdorim i qartë i TypeScript për tipizim të të dhënave të biznesit.
- Supabase është përdorur në mënyrë të arsyeshme si backend i plotë për auth dhe databazë.
- Preview dhe export për Libri Ndërtimor përdorin të njëjtin motor logjik, gjë që ul mospërputhjen mes UI dhe skedarit final.
- Forma dhe validimi janë të ndara nga logjika e biznesit, duke e bërë kodin më të mirëmbajtshëm.

### Rreziqe ose pika për kujdes

- Disa faqe, sidomos `DataPage` dhe `ImportPage`, janë të gjata dhe mbajnë shumë përgjegjësi në një file të vetëm.
- Ka shumë logjikë biznesi brenda komponentëve të UI-së; në një version më të madh do të ishte mirë të nxirret pjesë nga kjo logjikë në hooks ose services të veçantë.
- Disa rrjedha varen nga Supabase i konfiguruar; kur mungon config, app-i kalon në fallback, por kjo duhet dokumentuar qartë për përdorim prodhimi.
- Funksionet e eksportit dhe parsing-ut janë kritike; ato kërkojnë testim të rregullt me skedarë realë Excel për të shmangur regressions.

## 11. Përfundim

Ky projekt është një panel administrativ i mirëstrukturuar për ndërtim, me fokus në menaxhim të pozicioneve, import/export Excel, faturim dhe analizë të të dhënave. Zgjedhjet teknike kanë kuptim për këtë domain: React + TypeScript për UI të qëndrueshme, Supabase për backend të shpejtë, dhe një shtresë të qartë utilities/shërbimesh për llogaritje, validim dhe eksport.

Nëse ky dokument përdoret për prezantim ose dorëzim, ai mund të shërbejë si përmbledhje zyrtare e projektit dhe si guidë për çka bën secili file kryesor.