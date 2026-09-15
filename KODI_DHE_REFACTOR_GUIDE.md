# Udhëzuesi i Kodit dhe Rekomandimet për Refactor

Ky dokument shpjegon strukturën aktuale të projektit Graniti Web. Për secilin file përshkruhet shkurt roli i tij dhe funksionet, komponentët, tipet ose eksportet kryesore. Në fund janë renditur rekomandimet për refactor, të ndara sipas prioritetit.

## 1. Si lexohet sistemi

Rrjedha kryesore e aplikacionit është:

```text
App.tsx
  -> Provider-at globale: Theme, Auth, Toast
  -> BrowserRouter dhe route-t
  -> ProtectedRoute
  -> Pages
  -> Components
  -> Services / lib
  -> Supabase ose eksport lokal
```

Rrjedha e të dhënave zakonisht është:

```text
Formulari ose Excel-i
  -> validimi dhe normalizimi
  -> llogaritja / transformimi
  -> Supabase ose state lokal
  -> preview, dashboard, kërkim ose eksport
```

- `pages` kontrollojnë rrjedhën e faqeve dhe state-in kryesor.
- `components` paraqesin pjesë të ripërdorshme të UI-së.
- `services` komunikojnë me databazën dhe mbajnë veprimet e biznesit.
- `lib` mban algoritme, validim, parser-a dhe eksportues.
- `context` ruan gjendjen globale.
- `types` përshkruajnë strukturën e të dhënave.
- `constants` përmbajnë lista dhe vlera që nuk ndryshojnë shpesh.

---

## 2. Root dhe konfigurimi

### `App.tsx`

- `App` - ndërton provider-at globale, router-in, route-t dhe `ProtectedRoute` për faqet që kërkojnë login.
- `BrowserRouter` - mundëson navigimin client-side pa rifreskim të plotë.
- `Routes` dhe `Route` - lidhin URL-të me faqet React.
- `Navigate` - ridrejton route-t e panjohura në homepage.

**Vërejtje:** JSX-i i provider-ave dhe route-ve është pak i ngjeshur; mund të ndahet në `AppProviders.tsx` dhe `AppRoutes.tsx`.

### `src/main.tsx`

- Inicializon React-in dhe e monton `App` në elementin kryesor të HTML-it.

### `vite.config.ts`

- Konfiguron Vite dhe plugin-in React për development dhe production build.

### `src/vite-env.d.ts`

- Aktivizon tipet e Vite-it dhe importet e aseteve në TypeScript.

### `package.json`

- Përmban scripts si `dev`, `build`, `test`, `lint` dhe varësitë e projektit.

---

## 3. Pages

### `src/pages/HomePage.tsx`

- `greetingForHour` - zgjedh përshëndetjen sipas orës: mëngjes, ditë ose mbrëmje.
- `HomePage` - ngarkon statistikat, projektet, kategoritë, qytetet e transportit dhe paramasën e fundit.
- `useEffect` kryesor - merr të dhëna nga Supabase dhe shërbimet e dashboard-it.
- `statusCounts` - numëron projektet sipas statusit draft, në proces dhe përfunduar.
- `selectedProjects` - filtron projektet sipas statusit të zgjedhur.
- `selectedStatusLabel` - kthen etiketën e statusit të zgjedhur.
- `recentPageCount` - llogarit numrin e faqeve të paramasës së fundit.
- `handleDownloadRecent` - rigjeneron dhe shkarkon Libri Ndërtimor të fundit.

**Refactor i rekomanduar:** `HomePage` kombinon fetching, statistika, evente dhe JSX shumë të gjatë. Krijo `useHomeDashboard`, `HomeHero`, `QuickActionCards`, `ProjectStatusPanel` dhe `RecentParamasaCard`.

### `src/pages/RegisterPage.tsx`

- `RegisterPage` - menaxhon formularin për regjistrim të një pozicioni dhe krijim të projektit/kategorisë.
- `useForm` - menaxhon vlerat, validimin dhe submit-in e formularit.
- `pricingInput` - përgatit të dhënat për preview-n e çmimit.
- `adjustLaborToTarget` - rregullon materialin dhe punën që totali të afrohet me një target.
- `handleSubmit` - ruan pozicionin përmes `saveRegisterRow`.
- `load` - ngarkon projektet dhe kategoritë ekzistuese.
- `watch` - monitoron ndryshimet në formular për llogaritje të menjëhershme.

**Refactor i rekomanduar:** ndani formularin në `RegisterProjectFields`, `RegisterCostFields`, `RegisterTransportFields` dhe `RegisterTargetAdjuster`. Nxirrni llogaritjen target në një hook ose service.

### `src/pages/InvoicePage.tsx`

- `FieldLabel` - shfaq ikonën dhe etiketën e një fushe.
- `FieldError` - shfaq gabimin e validimit të fushës.
- `fieldClass` - kthen klasën CSS për fushë me gabim.
- `IssuerFields` - menaxhon të dhënat e kompanisë lëshuese.
- `SharedHeaderFields` - menaxhon numrin, datën, klientin dhe adresën.
- `toInputDate` - konverton datën e shfaqur në formatin e input-it HTML.
- `fromInputDate` - konverton datën HTML në formatin e aplikacionit.
- `KontrateForm` - paraqet formularin për faturën sipas kontratës.
- `PozicioneForm` - paraqet formularin për fletë-dërgesë me pozicione.
- `InvoicePage` - zgjedh llojin e dokumentit, validon të dhënat dhe nis eksportin.
- `handleExport` - thërret validimin dhe eksportuesin për llojin e zgjedhur.
- `handleKindChange` - ndërron mes faturës së kontratës dhe fletë-dërgesës.

**Refactor i rekomanduar:** file-i ka dy forma të mëdha. Mbajeni `InvoicePage` si orchestrator dhe zhvendosni `IssuerFields`, `SharedHeaderFields`, `KontrateForm` dhe `PozicioneForm` në folderin `components/invoice`.

### `src/pages/ImportPage.tsx`

- `toTitleCase` - e kthen tekstin në formë title case.
- `normalizeBaseName` - pastron emrin e file-it duke hequr extension dhe separatorët.
- `extractPrimarySection` - nxjerr rrënjën e seksionit nga pozicionet e importuara.
- `suggestPreviewMeta` - krijon metadata fillestare nga Excel-i, emri i file-it dhe projekti.
- `mergeBlankFields` - plotëson vetëm metadata-n bosh pa mbishkruar input-in e përdoruesit.
- `ImportPage` - menaxhon upload-in, preview-n, validimin e seksioneve, planifikimin, historikun dhe eksportet.
- `handleFileUpload` - lexon Excel-in, kontrollon totalin, sugjeron metadata dhe ruan historikun.
- `handlePrint` - hap printimin e browser-it.
- `handleGroupingModeChange` - kalon mes paketimit automatik dhe manual të faqeve.
- `handleDownloadLibriNdertimor` - gjeneron workbook-un final XLSX.
- `handleDownloadLibriNdertimorZip` - gjeneron ZIP me një file për faqe.
- `handleUpdateRow` - përditëson një rresht të importuar në state.
- `handleRedownloadHistory` - rigjeneron një eksport nga historiku.
- `handleDeleteHistory` - kërkon konfirmim dhe fshin eksportin e ruajtur.

**Refactor i rekomanduar, prioritet i lartë:** ndani në `useImportWorkflow`, `ImportMetadataForm`, `ImportUploadPanel`, `ImportValidationPanel`, `ImportActionBar` dhe `LibriHistoryPanel`. Ky është file-i më i qartë për ndarje pas `DataPage`.

### `src/pages/DataPage.tsx`

- `DataPage` - menaxhon projektet, kategoritë, pozicionet, editimin, krahasimin, analizën dhe historikun e çmimeve.
- `reloadProjects` - ngarkon projektet, kategoritë dhe përmbledhjet e kategorive.
- `loadComparePool` - ngarkon pozicionet që mund të krahasohen.
- `loadProjectDetails` - ngarkon pozicionet e një projekti të zgjedhur.
- `loadCategoryDetails` - ngarkon pozicionet e një kategorie nëpër projekte.
- `saveProjectMeta` - ruan klientin, statusin, përshkrimin dhe koston reale të projektit.
- `handleDeleteProject` - konfirmon dhe fshin një projekt.
- `handleDeletePosition` - konfirmon dhe fshin një pozicion.
- `handleDeleteCategory` - konfirmon dhe fshin një kategori.
- `analyzeSelectedProject` - prodhon sugjerime për totalin, çmimin mesatar, pozicionet kryesore dhe sasitë zero.
- `startEdit` - ngarkon shpenzimet e një pozicioni dhe përgatit formën e editimit.
- `saveRowEdit` - rillogarit totalin, përditëson pozicionin/shpenzimet dhe ruan snapshot të çmimit.
- `handleExport` - eksporton pozicionet e projektit në CSV.
- `filteredProjects` - filtron projektet sipas emrit dhe statusit.
- `categoryGroups` - grupon pozicionet e kategorisë sipas projektit.
- `filterProjectItems` - filtron pozicionet e projektit sipas kërkimit.
- `renderPositionList` - krijon listën e `PositionCard` komponentëve.

**Refactor i rekomanduar, prioriteti më i lartë:** file-i ka fetching, state, formula financiare, konfirmime, analiza dhe renderim. Ndajeni në `useDataPage`, `useProjectDetails`, `usePositionEditor`, `ProjectSelector`, `CategorySelector`, `ProjectMetaEditor` dhe `PositionResults`.

### `src/pages/SearchPage.tsx`

- `SearchPage` - merr termin e kërkimit dhe shfaq rezultatet globale nga `searchPositions`.

**Refactor i mundshëm:** nxirrni input-in dhe listën e rezultateve në `SearchBar` dhe `SearchResults`.

### `src/pages/ProfilePage.tsx`

- `ProfilePage` - shfaq të dhënat e përdoruesit, ndryshimin e password-it, backup-in dhe logout-in.
- `handleSignOut` - çkyç përdoruesin dhe e dërgon te login.
- `handleBackup` - eksporton të dhënat në JSON.
- `handlePasswordChange` - validon password-in e ri dhe thërret AuthContext.

### `src/pages/LoginPage.tsx`

- `LoginPage` - menaxhon login, regjistrim, recovery dhe ridrejtimin pas autentikimit.

### `src/pages/ImportPage.tsx`, `src/pages/InvoicePage.tsx` dhe `src/pages/DataPage.tsx`

Këto janë faqet më të mëdha dhe kanë më shumë logjikë biznesi të përzier me UI. Ato nuk duhen rishkruar menjëherë; refactor-i duhet të bëhet gradualisht me një ndarje në çdo hap dhe build pas çdo ndryshimi.

---

## 4. Components

### `src/components/Shell.tsx`

- `Shell` - krijon sidebar-in, navigimin kryesor, theme toggle dhe zonën e përmbajtjes.

### `src/components/ProtectedRoute.tsx`

- `ProtectedRoute` - kontrollon Supabase config, loading dhe user-in para se të shfaqë një faqe.

### `src/components/StatusBadge.tsx`

- `StatusBadge` - shfaq statusin e projektit me ngjyrë dhe tekst të standardizuar.

### `src/components/PositionCard.tsx`

- `PositionCard` - shfaq një pozicion, metadata, totalin, editimin, krahasimin dhe fshirjen.
- `adjustLaborToTarget` - rregullon materialin/punën për një total të synuar.
- `handleSave` - ruan ndryshimet e pozicionit përmes callback-ut të faqes.

**Refactor:** ndani `PositionSummary`, `PositionCostBreakdown` dhe `PositionEditForm` nëse komponenti vazhdon të rritet.

### `src/components/EditModal.tsx`

- `EditModal` - paraqet modalin e editimit dhe veprimet save/cancel/delete.

### `src/components/PricingPreview.tsx`

- `PricingPreview` - shfaq përmbledhjen e llogaritjes: kosto, fitim, TVSH, çmim për njësi dhe total.

### `src/components/ComparePositions.tsx`

- `labelFor` - krijon tekstin e fallback-ut për pozicionin.
- `CompareColumn` - shfaq njërin krah të krahasimit.
- `ComparePositions` - menaxhon dy pozicione dhe shfaq diferencat mes tyre.

### `src/components/CategoryProjectCompare.tsx`

- `CategoryProjectCompare` - krahason vlerat dhe pozicionet e një kategorie në projekte të ndryshme.

### `src/components/InsightsCharts.tsx`

- `truncate` - shkurton emrat e gjatë për akset dhe legjendat.
- `InsightsCharts` - shfaq metrikat e homepage-it dhe grafikët e projekteve/kategorive.
- `mostUsedCity` - zgjedh qytetin më të përdorur nga lista e transportit.

**Refactor:** grafikët dhe metrikat mund të ndahen në `InsightMetrics`, `ProjectValueChart`, `CategoryValueChart` dhe `CategoryDistributionChart`.

### `src/components/PriceHistoryDashboard.tsx`

- `PriceHistoryDashboard` - shfaq historikun e çmimeve, KPI-të dhe rezultatet e fitimit sipas projektit.
- `trendStats` - llogarit çmimin e parë, të fundit, minimumin, maksimumin dhe ndryshimin.
- `topProfitProjects` - rendit projektet sipas fitimit të planifikuar.

### `src/components/RevenueTrendChart.tsx`

- `RevenueTrendChart` - shfaq trendin mujor të vlerës dhe numrit të pozicioneve.

### `src/components/ParamasaPreview.tsx`

- `ParamasaPreview` - shfaq preview-n e pozicioneve, seksioneve, faqeve dhe modalet e rregullimit manual.
- `applyPlanChange` - aplikon ndryshimet e planit ose shfaq gabim.
- `handleDownloadPage` - shkarkon një faqe të vetme të Librit Ndërtimor.

**Refactor:** modalet e seksioneve, rregullimit dhe preview-t të faqes mund të bëhen komponentë të veçantë.

### `src/components/ManualPageBuilder.tsx`

- `templateCapacity` - kthen kapacitetin e një shablloni.
- `syncRowsToTemplate` - përshtat rreshtat me numrin e vendeve të shabllonit.
- `chunkRows` - ndan rreshtat në grupe sipas kapacitetit.
- `emptyRow` - krijon një rresht bosh të manual builder-it.
- `toParsedRow` - konverton rreshtin manual në `ParsedRow`.
- `ManualPageBuilder` - ndërton manualisht faqet duke zgjedhur shabllonin dhe plotësuar të dhënat.

### `src/components/CategoryProjectCompare.tsx`, `ComparePositions.tsx` dhe `RevenueTrendChart.tsx`

Këta komponentë kanë përgjegjësi relativisht të qarta dhe nuk kërkojnë ndarje urgjente. Refactor-i këtu duhet të bëhet vetëm nëse shtohen funksione të reja.

---

## 5. Context dhe hooks

### `src/context/AuthContext.tsx`

- `AuthContextValue` - përshkruan API-n e autentikimit për komponentët.
- `AuthContext` - ruan context-in e autentikimit.
- `AuthProvider` - lexon session-in, dëgjon ndryshimet dhe ofron login/register/password/logout.
- `signIn` - bën login me email/password.
- `signUp` - krijon përdorues të ri dhe kontrollon konfirmimin.
- `resetPassword` - nis recovery email.
- `updatePassword` - vendos password të ri në recovery mode.
- `changePassword` - verifikon password-in aktual dhe vendos të riun.
- `signOut` - mbyll session-in.

### `src/context/ThemeContext.tsx`

- `ThemeMode` - tipet `light` dhe `dark`.
- `ThemeContextValue` - përshkruan theme state dhe toggle.
- `ThemeContext` - context-i i temës.
- `ThemeProvider` - ruan temën në localStorage dhe vendos klasën në `document.documentElement`.

### `src/context/ToastContext.tsx`

- `ToastProvider` - menaxhon listën e njoftimeve dhe timer-at e mbylljes.
- `dismissToast` - heq një toast nga lista.
- `showToast` - shton një toast success/error/info.
- `useToast` - hook për përdorimin e toast context-it.

### `src/hooks/useAuth.ts`

- `useAuth` - lexon `AuthContext` dhe jep gabim nëse përdoret jashtë provider-it.

### `src/hooks/useTheme.ts`

- `useTheme` - lexon `ThemeContext` dhe jep gabim nëse përdoret jashtë provider-it.

**Refactor i mundshëm:** `AuthContext` mund të ndajë `authApi` nga `authState`, por aktualisht madhësia është ende e menaxhueshme.

---

## 6. Constants dhe data

### `src/constants/defaultCategories.ts`

- `DEFAULT_CATEGORIES` - lista e kategorive që krijohen kur mungojnë në databazë.

### `src/constants/projectStatus.ts`

- `PROJECT_STATUSES` - statuset e lejuara të projektit.
- `ProjectStatus` - tipi i statusit.
- `statusLabel` - kthen tekstin e shfaqur për një status.

### `src/constants/transport.ts`

- `TRANSPORT_OPTIONS` - qytetet dhe çmimet standarde të transportit.

### `src/data/mock.ts`

- `demoProjects` - të dhëna shembull për projekte.
- `demoCategories` - kategori shembull.
- `demoReferences` - referenca shembull për UI/prototip.

**Refactor:** nëse mock data nuk përdoret më, hiqeni ose vendoseni në `tests/fixtures` që të mos ngatërrohet me data reale.

---

## 7. Lib: algoritme dhe eksport

### `src/lib/pricing.ts`

- `PricingInput` - tipet e input-it të çmimit.
- `PricingBreakdown` - tipet e rezultatit të ndarjes së kostos.
- `calculatePositionPrice` - llogarit materialin, punën, ushqimin, transportin, shpenzimet, fitimin, TVSH-në dhe totalin.

**Status:** modul i qartë; duhet të mbetet pa varësi nga React ose Supabase.

### `src/lib/excel.ts`

- `ParsedRow` - modeli i standardizuar i një pozicioni të importuar.
- `normalizeString` - normalizon tekstin duke hequr case dhe diakritikë.
- `toCellText` - konverton qelizën në tekst të pastër.
- `rowText` - bashkon tekstin e një rreshti.
- `isEmptyRow` - kontrollon nëse rreshti është bosh.
- `isSignatureRow` - zbulon rreshta nënshkrimi.
- `detectColumnMap` - zbulon kolonat sipas fjalëkyçeve shqip/serbisht.
- `extractPositionNumber` - nxjerr numrin edhe nga `Pozicioni 1`.
- `parseNumeric` - konverton numra me presje ose pikë.
- `isNewDocumentTitleRow` - zbulon tabelë të re brenda të njëjtit file.
- `parseStructuredRows` - lexon paramasat me header të zbulueshëm.
- `parseLegacyRows` - lexon formatet e vjetra me header alternativ.
- `libriPositionsToRows` - konverton pozicionet e Librit në `ParsedRow`.
- `dedupeRows` - heq dublikatat me çelës të përbërë.
- `detectDeclaredTotal` - lexon totalin e deklaruar nga Excel-i.
- `parseWorkbook` - përpunon të gjitha sheet-et dhe zgjedh parser-in e duhur.
- `ParseExcelResult` - modeli i rezultatit me rows dhe total.
- `parseExcelWithValidation` - lexon file-in me `FileReader` dhe kthen rezultat të validuar.
- `parseExcel` - wrapper i thjeshtë që kthen vetëm rreshtat.

**Refactor i rekomanduar:** ndajeni në `excelText.ts`, `excelColumns.ts`, `excelStructuredParser.ts`, `excelLegacyParser.ts` dhe `excelWorkbook.ts`. Ky file ka shumë përgjegjësi, por parser-at janë të lidhur ngushtë dhe ndarja duhet bërë me teste.

### `src/lib/libriNdertimor.ts`

- `LibriMeasurementLine` - model i një matjeje `A x B = rezultat`.
- `LibriPosition` - model i pozicionit në Libër.
- `LibriMeta` - metadata e faqes së Librit.
- `LibriSheetResult` - rezultati i parser-it për një sheet.
- `toText` - pastron vlerat e qelizave.
- `normalize` - normalizon tekstin për kërkim.
- `parseNumber` - lexon numër me presje ose pikë.
- `isLibriNdertimorSheet` - zbulon formatin e Librit Ndërtimor.
- `findRowIndex` - gjen rreshtin e parë që plotëson kushtin.
- `extractMeta` - nxjerr kryesin, muajin, objektin, seksionin dhe ofertën.
- `parseLibriSheet` - lexon pozicionet dhe matjet e një faqeje Libri.

**Status:** përgjegjësi e qartë; mund të ndahet vetëm parser-i i metadata-s nga parser-i i pozicioneve nëse rritet.

### `src/lib/paramasaPreview.ts`

- `ParamasaTemplateId` - identifikon shabllonin 1-5.
- `ParamasaTemplateMode` - lejon shabllon specifik ose `auto`.
- `ParamasaPage` - modeli i faqes së preview-t.
- `ParamasaSection` - modeli i seksionit të pozicioneve.
- `PARAMASA_TEMPLATES` - metadata e shablloneve dhe kapacitetit.
- `normalizePositionToken` - pastron token-in e pozicionit.
- `getPositionRoot` - nxjerr rrënjën e seksionit.
- `isRomanRoot` - kontrollon rrënjë romake.
- `isNumericRoot` - kontrollon rrënjë numerike.
- `getSectionLabel` - krijon etiketën e seksionit.
- `getRowIndentLevel` - llogarit thellësinë e pozicionit.
- `isSectionHeaderRow` - dallon titullin e seksionit nga pozicioni real.
- `groupRowsBySection` - grupon pozicionet në seksione pa përzierje.
- `estimateRowUnits` - vlerëson hapësirën e një rreshti.
- `fitsWithinPage` - kontrollon nëse rreshtat hyjnë në faqe.
- `chooseAutoTemplate` - zgjedh shabllonin automatik.
- `splitParamasaPages` - ndan rreshtat në faqe.

### `src/lib/libriPaging.ts`

- `TemplateId` - identifikon template 1-5.
- `LibriSlotCoord` - përshkruan koordinatat dhe kapacitetin e slot-it.
- `TEMPLATE_SLOTS` - koordinatat reale të shablloneve Excel.
- `LibriPage` - rezultati i paketimit të faqes.
- `slotBudget` - kthen kapacitetin e tekstit.
- `fitsTemplate` - kontrollon kapacitetin dhe njësitë e përziera.
- `packSectionIntoPages` - paketon pozicionet e një seksioni në faqe të sigurta.

**Status:** algoritëm i fokusuar; mbajeni të pavarur nga UI.

### `src/lib/libriPlanEditor.ts`

- `toExportPages` - konverton planin e preview-t në plan eksporti.
- `mergeAdjacentPlanPages` - bashkon faqe fqinje kur është e sigurt.
- `splitPlanPage` - ndan një faqe në dy pjesë.
- `movePositionToPage` - lëviz një pozicion në faqe tjetër.

### `src/lib/libriExport.ts`

- `toArrayBuffer` - normalizon buffer-at e ExcelJS në `ArrayBuffer`.
- `toRomanNumeral` - konverton numër arab në numër romak.
- `extractSectionAccountNumber` - nxjerr numrin romak të seksionit.
- `sanitizeSheetName` - pastron emrin e sheet-it sipas kufizimeve të Excel-it.
- `loadTemplateWorkbook` - ngarkon template nga browser-i ose filesystem-i Node.
- `cloneWorksheet` - klonon sheet-in duke ruajtur stile, merge, dimensione dhe print setup.
- `setCell` - vendos vlerë në qelizë duke ruajtur stilin.
- `buildLibriExportPositions` - konverton `ParsedRow` në struktura eksporti.
- `LibriExportPlanPage` - modeli i një faqeje të planifikuar.
- `planLibriExport` - grupon seksionet dhe krijon planin final të faqeve.
- `buildLibriNdertimorWorkbookFromPlan` - ndërton workbook nga plani ekzistues.
- `buildLibriNdertimorWorkbook` - ndërton workbook nga rreshtat dhe metadata.
- `fillPageIntoWorksheet` - mbush template-in me metadata, pozicione dhe matje.
- `buildLibriSinglePageWorkbook` - ndërton një faqe të vetme XLSX.
- `downloadWorkbookBuffer` - shkarkon një `ArrayBuffer` si XLSX.
- `buildLibriNdertimorZip` - krijon ZIP me çdo faqe veçmas.
- `downloadBlob` - shkarkon një `Blob` nga browser-i.

**Refactor i rekomanduar:** ndahet në `libriTemplates.ts`, `libriWorkbook.ts`, `libriPageWriter.ts` dhe `libriDownloads.ts`. Aktualisht përmban loading, clone, mapping, planifikim, shkrim dhe download.

### `src/lib/faturaExport.ts`

- `setCell` - vendos vlerë në qelizë duke ruajtur formatimin.
- `parseNumber` - lexon numra decimalë.
- `applyA4PrintSetup` - vendos print setup për A4.
- `safeUnmerge` - heq merge pa hedhur gabim.
- `safeMergeCells` - krijon merge në mënyrë të sigurt.
- `loadTemplate` - ngarkon template-in e faturës.
- `fillKontrate` - mbush template-in e faturës së kontratës.
- `cloneRowStyle` - kopjon stilin e një rreshti në rresht tjetër.
- `fillPozicioneRow` - mbush një rresht të fletë-dërgesës.
- `fillPozicione` - mbush template-in e fletë-dërgesës.
- `buildKontrateWorkbook` - ndërton workbook-un e kontratës.
- `buildPozicioneWorkbook` - ndërton workbook-un e pozicioneve.
- `downloadKontrateInvoice` - eksporton dhe shkarkon faturën e kontratës.
- `downloadPozicioneInvoice` - eksporton dhe shkarkon fletë-dërgesën.

**Refactor:** `fillKontrate` dhe `fillPozicione` mund të shkojnë në `invoiceTemplateWriters.ts`.

### `src/lib/faturaValidation.ts`

- `FaturaFieldErrors` - map i gabimeve sipas fushës.
- `FaturaValidationResult` - rezultati valid/invalid i faturës.
- `sanitizeDecimalInput` - lejon vetëm format decimal të pranueshëm.
- `sanitizeDigitsInput` - heq karakteret jo-numerike.
- `parseDecimal` - konverton tekstin në numër.
- `isValidDecimal` - kontrollon numrin decimal.
- `result` - krijon rezultat standard validimi.
- `requireText` - kontrollon tekstin e detyrueshëm.
- `positionIsActive` - kontrollon nëse pozicioni ka të dhëna.
- `validateKontrate` - validon faturën sipas kontratës.
- `validatePozicione` - validon fletë-dërgesën.

### `src/lib/paramasaExport.ts`

- `escapeHtml` - mbron tekstin kur futet në HTML.
- `renderPage` - renderon një faqe paramase në HTML.
- `buildParamasaFinalHtml` - ndërton HTML-in final të paramasës.

### `src/lib/pricing.test.ts`

- Teston `calculatePositionPrice`, grupimin, paketimin e faqeve dhe eksportin real të Librit.
- Është testi kryesor regresiv për llogaritje dhe eksport.

### `src/lib/audit.ts`

- `AdjustLog` - modeli i një ndryshimi automatik të çmimit.
- `readAdjustLogs` - lexon audit log nga localStorage.
- `pushAdjustLog` - shton një hyrje të re në audit log.
- `clearAdjustLogs` - fshin audit log-un lokal.

### `src/lib/dates.ts`

- `formatDateTime` - formaton datën në locale shqip.
- `wasUpdated` - kontrollon nëse një record është ndryshuar pas krijimit.

### `src/lib/supabase.ts`

- `hasSupabaseConfig` - kontrollon nëse ekzistojnë URL dhe anon key.
- `supabase` - krijon client-in Supabase kur konfigurimi është i plotë.

---

## 8. Services

### `src/services/register.ts`

- `RegisterFormValues` - modeli i formularit të regjistrimit.
- `saveRegisterRow` - krijon projekt/kategori sipas nevojës, llogarit pozicionin, ruan shpenzimet dhe snapshot-in.

### `src/services/projects.ts`

- `fetchCompletedProjects` - merr projektet e përfunduara.
- `updateProject` - përditëson metadata-n e projektit.
- `deleteProject` - fshin projektin dhe pozicionet me cascade.
- `deletePosition` - fshin një pozicion dhe shpenzimet e tij.
- `exportAllDataJson` - eksporton projects, categories, project_items dhe item_expenses në JSON.

### `src/services/categories.ts`

- `ensureDefaultCategories` - siguron që kategoritë standarde ekzistojnë.
- `deleteCategory` - fshin kategorinë.
- `groupItemsByProject` - grupon pozicionet sipas projektit.

### `src/services/insights.ts`

- `fetchProjectSummaries` - mbledh vlerën e pozicioneve sipas projektit.
- `fetchCategorySummaries` - mbledh numrin dhe vlerën sipas kategorisë.
- `MonthlyRevenuePoint` - modeli i përmbledhjes mujore.
- `CityUsageSummary` - modeli i përdorimit të qytetit.
- `fetchTransportCityUsage` - numëron qytetet e transportit dhe rikuperon raste të vjetra kur çmimi është unik.
- `fetchMonthlyRevenueTrend` - krijon trendin mujor të vlerës së ofertave.
- `fetchTotalSystemValue` - llogarit vlerën totale të sistemit.

**Refactor i mundshëm:** ndajeni `insights.ts` në `projectInsights.ts`, `categoryInsights.ts`, `transportInsights.ts` dhe `revenueInsights.ts`.

### `src/services/priceHistory.ts`

- `PriceHistorySnapshot` - modeli i snapshot-it të çmimit.
- `recordPriceSnapshot` - ruan një snapshot të ri në `price_history`.
- `PriceTrendPoint` - modeli i një pike të trendit.
- `fetchPriceTrend` - merr historikun e çmimit sipas kategorisë.
- `ProfitSummary` - modeli i analizës së fitimit.
- `fetchProfitSummaryByProject` - krahason koston e planifikuar, ofertën dhe koston reale.

### `src/services/search.ts`

- `searchPositions` - kërkon në pozicione dhe metadata të projekteve/kategorive.

### `src/services/stats.ts`

- `fetchDashboardStats` - merr numrin e projekteve, kategorive dhe pozicioneve për dashboard.

### `src/services/export.ts`

- `exportProjectCSV` - merr pozicionet e projektit dhe i shkarkon si CSV.

### `src/services/libriExports.ts`

- `LibriExportRecord` - modeli i eksportit të ruajtur.
- `mapRecord` - konverton record-in e databazës në model frontend.
- `saveLibriExportRecord` - ruan një import/eksport të Librit.
- `fetchLibriExportRecords` - merr historikun e Librave.
- `deleteLibriExportRecord` - fshin një record të historikut.

---

## 9. Types

### `src/types/database.ts`

- `DbProject` - modeli i projektit dhe kostos reale.
- `DbCategory` - modeli i kategorisë.
- `DbProjectItem` - modeli i pozicionit në databazë.
- `ItemWithMeta` - pozicion me emrin e projektit dhe kategorisë.
- `ProjectSummary` - përmbledhje e vlerës së projektit.
- `CategorySummary` - përmbledhje e numrit dhe vlerës së kategorisë.
- `SearchResultItem` - rezultat kërkimi me metadata.
- `DbLibriExport` - record i eksportit të Librit.
- `DbPriceHistory` - record i historikut të çmimit.

### `src/types/fatura.ts`

- `FaturaKind` - dallon kontratë dhe pozicione.
- `FaturaIssuerDefaults` - të dhënat default të kompanisë.
- `FaturaSharedFields` - fushat e përbashkëta të faturës.
- `FaturaKontrateFields` - fushat e faturës së kontratës.
- `FaturaPositionRow` - një rresht pozicioni në fletë-dërgesë.
- `FaturaPozicioneFields` - fushat e fletë-dërgesës.
- `DEFAULT_ISSUER` - vlerat fillestare të lëshuesit.
- `todaySqDate` - kthen datën e sotme në format shqip.
- `createEmptyPosition` - krijon një pozicion bosh.
- `createKontrateDefaults` - krijon gjendjen fillestare të faturës së kontratës.
- `createPozicioneDefaults` - krijon gjendjen fillestare të fletë-dërgesës.

### `src/types/paramasaMeta.ts`

- `ParamasaPreviewMeta` - metadata e kryesisë, muajit, objektit, ofertës dhe seksionit.

### `src/types.ts`

- `ThemeMode` - tipi i temës.
- `Project` - modeli i vjetër/demo i projektit.
- `Position` - modeli i vjetër/demo i pozicionit.
- `Category` - modeli i vjetër/demo i kategorisë.
- `ReferenceEntry` - modeli i referencës demo.

**Refactor:** `src/types.ts` duket legacy dhe duhet krahasuar me `src/types/database.ts`; nëse nuk përdoret, hiqeni pas një kërkimi final të usages.

---

## 10. Dokumentet dhe SQL

### `database-schema.sql`

- Krijon tabelat `categories`, `projects`, `project_items`, `item_expenses` dhe `import_history`.
- Aktivizon RLS dhe lejon veprimet për role `authenticated`.
- `ON DELETE CASCADE` lidh projektet me pozicionet dhe shpenzimet.

### `database-policies-only.sql`

- Aktivizon vetëm RLS dhe politikat për databaza ekzistuese.
- Duhet të ekzekutohet kur tabelat tashmë janë krijuar dhe nuk dëshirohet ri-krijimi i skemës.

**Kujdes sigurie:** politikat aktuale përdorin `USING (true)` dhe `WITH CHECK (true)`, prandaj çdo përdorues i autentikuar mund të shohë dhe ndryshojë të gjitha të dhënat. Për multi-user real duhet `owner_id`/`user_id` dhe politika me `auth.uid()`.

### `README.md`

- Shpjegon instalimin, scripts, route-t, teknologjitë dhe funksionet kryesore.
- Është hyrja e parë për një zhvillues të ri.

### `DOKUMENTI_DIPLOMES.md`

- Versioni tekstual i dokumentit të diplomës për editim.
- Përshkruan problemin, arkitekturën, importin Excel, vlerësimin e ofertave dhe përgatitjen për mbrojtje.

### `DOKUMENTI_DIPLOMES.html`

- Versioni i formatuar për browser, printim dhe kopjim në Word.
- Duhet të mbahet i sinkronizuar me Markdown-in kur ndryshohet titulli ose kapitujt.

### `PROJECT-REVIEW.md`

- Përmban vërejtje dhe analizë të mëparshme të projektit.
- Duhet përdorur si dokument auditimi, jo si burim i dytë kontradiktor me README-n.

### `index.html`

- Shell-i HTML i Vite-it ku montohet aplikacioni React.

---

## 11. Folderët e materialeve

### `public/templates`

- Përmban template Excel të Librit Ndërtimor dhe faturave që lexohen nga eksportuesit.
- Këta file nuk janë source code, por janë kontrata vizuale dhe teknike të eksportit.
- Ndryshimi i koordinatave, merge-ve ose lartësive kërkon përditësim të `TEMPLATE_SLOTS` dhe testim printimi.

### `Fatura`

- Përmban template dhe materiale të faturave që përdoren për verifikim ose burim të eksportit.

### `Paramasa`

- Përmban Excel-a shembull për paramasa dhe Libër Ndërtimor.
- Duhet të ruhen si fixtures për testim manual të parser-it.

---

## 12. Refactor plan i rekomanduar

### Prioriteti 1: ndarje pa ndryshuar logjikën

1. `DataPage.tsx`
   - Nxirrni fetching-un në `useDataPageData`.
   - Nxirrni editimin në `usePositionEditor`.
   - Nxirrni panelin e projektit në `ProjectMetaPanel`.
   - Nxirrni listat në `ProjectList`, `CategoryList` dhe `PositionList`.
   - Mbajeni `DataPage` vetëm si kompozues layout-i.

2. `ImportPage.tsx`
   - Nxirrni `useImportWorkflow` për state dhe eventet.
   - Nxirrni `ImportMetadataForm`, `ImportValidationPanel` dhe `ImportHistoryPanel`.
   - Mbajeni eksportin në services/lib dhe jo brenda JSX-it.

3. `libriExport.ts`
   - Ndajeni shkrimin e qelizave nga loading-u i template-ve.
   - Krijoni `libriTemplateLoader.ts`, `libriWorksheetWriter.ts` dhe `libriDownloads.ts`.

### Prioriteti 2: ndarje e logjikës së importit

1. `excel.ts`
   - `excelShared.ts`: normalizim dhe helpers.
   - `excelHeaders.ts`: zbulimi i kolonave.
   - `excelStructuredParser.ts`: formatet e strukturuara.
   - `excelLegacyParser.ts`: formatet legacy.
   - `excel.ts`: vetëm API publike `parseExcel` dhe `parseExcelWithValidation`.

2. `insights.ts`
   - Ndajeni sipas llojit të analizës që të mos përzihet transporti me revenue dhe kategoritë.

3. `PriceHistoryDashboard.tsx` dhe `InsightsCharts.tsx`
   - Ndajeni metric cards nga charts dhe tables.

### Prioriteti 3: standardizim teknik

- Krijoni type të përbashkët për rezultatet e Supabase: `{ data, error }` ose error wrapper standard.
- Krijoni helper `downloadFile` për CSV, JSON, XLSX dhe Blob që të mos përsëritet kodi.
- Krijoni helper për konfirmime destructive actions në vend të shumë `window.confirm`.
- Krijoni konstante për mesazhet e toast-eve.
- Zëvendësoni `any` në `PositionCard` me një tip të përbashkët të edit formës.
- Shtoni test për parser-in e file-it real të ofruar nga përdoruesi.
- Shtoni test për qytetin më të përdorur dhe për rastin `Transport` pa qytet.

### Prioriteti 4: siguria e databazës

- Shtoni `owner_id UUID REFERENCES auth.users(id)` te tabelat kryesore.
- Në insert ruani `auth.uid()` ose user id nga session-i.
- Ndryshoni politikat nga `USING (true)` në `USING (owner_id = auth.uid())`.
- Përdorni të njëjtin kusht në `WITH CHECK`.
- Vendosni politika të veçanta për lexime, insert, update dhe delete.

---

## 13. Çfarë nuk duhet të bëhet menjëherë

- Mos e ndani çdo helper në file të veçantë pa fitim real.
- Mos ndryshoni databazën vetëm për rregullim të pamjes.
- Mos prekni parser-in Excel pa test me file real.
- Mos i bashkoni `libriNdertimor.ts` dhe `excel.ts`; janë dy formate të ndryshme.
- Mos i zhvendosni formulat financiare në komponentë UI.
- Mos bëni refactor të madh pa commit/checkpoint ose pa build pas çdo hapi.

---

## 14. Renditja praktike e punës

1. Krijo teste shtesë për sjelljen aktuale.
2. Nxirr type-in e edit formës nga `DataPage`.
3. Ndaj `DataPage` në hook dhe panele UI.
4. Ndaj `ImportPage` në hook dhe panele UI.
5. Ndaj `libriExport.ts` në loader/writer/download.
6. Ndaj `excel.ts` vetëm pasi parser-at të kenë testet e veta.
7. Përmirëso RLS dhe ndarjen sipas përdoruesit.
8. Përditëso README dhe dokumentin e diplomës pas çdo ndryshimi arkitektural.

## Përfundim

Projekti nuk ka nevojë për rishkrim total. Arkitektura bazë është e kuptueshme: pages, components, services, lib dhe context janë të ndara. Refactor-i më i vlefshëm është ulja e përgjegjësive në `DataPage.tsx`, `ImportPage.tsx`, `libriExport.ts` dhe `excel.ts`, duke ruajtur API-t publike dhe duke shtuar teste para ndryshimit.
