# Udhëzues për ta kuptuar projektin

> Ky dokument është për autorin e projektit: shpjegon arkitekturën, rrjedhat, formulat, kufijtë dhe arsyetimet teknike në më shumë hollësi. **Nuk është versioni për t'ia dërguar mentorit.** Për draftin formal përdor [DOKUMENTI_DIPLOMES.html](./DOKUMENTI_DIPLOMES.html).

## 1. Në një fjali: çfarë bën aplikacioni?

Është një aplikacion web për të organizuar ofertat e projekteve ndërtimore: regjistron pozicione dhe kosto, importon paramasa nga Excel, i ndan pozicionet në faqe sipas shablloneve, gjeneron dokumente dhe jep kërkim e analiza mbi të dhënat e ruajtura.

Sistemi nuk llogarit vetë sasitë inxhinierike nga vizatimet dhe nuk është sistem kontabiliteti. Ai përpunon të dhënat që i jep përdoruesi ose që lexon nga Excel.

## 2. Si është i organizuar kodi?

| Vendndodhja | Roli |
|---|---|
| [App.tsx](./App.tsx) | Provider-at e aplikacionit, rrugët (routes) dhe ngarkimi i faqeve. |
| [src/pages/](./src/pages/) | Faqet: ballina, regjistrimi, importi, fatura, kërkimi, të dhënat dhe profili. |
| [src/components/](./src/components/) | Komponentë të ripërdorshëm, si Shell, kartat e pozicioneve, preview dhe grafikët. |
| [src/services/](./src/services/) | Kërkesa te Supabase dhe veprime të domenit, p.sh. ruajtja e pozicionit ose raportet. |
| [src/lib/](./src/lib/) | Llogaritje dhe përpunim i pavarur nga UI-ja: çmime, Excel, faqosje, validim, cache. |
| [src/context/](./src/context/) | Gjendje globale për autentikim, temë dhe njoftime. |
| [src/types/](./src/types/) | Modele TypeScript për dokumentet dhe metadata-n. |
| [public/templates/](./public/templates/) | Shabllonet Excel që përdoren gjatë eksportit. |
| [supabase/migrations/](./supabase/migrations/) | Ndryshime skeme dhe funksione SQL që duhen aplikuar në Supabase. |

Rrjedha e zakonshme është:

```text
Faqja React → service → Supabase (PostgreSQL)
      ↓
  src/lib (llogaritje, validim, import/eksport)
```

Jo çdo query kalon ende përmes një service-i; disa faqe lexojnë Supabase drejtpërdrejt. Nëse sistemi zgjerohet, kjo mund të centralizohet gradualisht, por s'është kusht për ta kuptuar rrjedhën aktuale.

## 3. Përdorimi sipas faqeve

### Ballina

Ballina paraqet numrin e projekteve/kategorive/pozicioneve, vlerën e regjistruar, statistika sipas projektit dhe kategorisë, aktivitetin e Librave Ndërtimorë dhe paramasën e fundit. Trendi mujor i ofertave gjendet te faqja “Të dhënat”.

### Regjistrimi

Përdoruesi:

1. zgjedh projektin dhe kategorinë ose shkruan emra të rinj;
2. plotëson përshkrimin, njësinë, sasinë dhe kostot;
3. cakton përqindjet e fitimit dhe TVSH-së;
4. sheh preview të formulës dhe ruan rreshtin.

[RegisterPage.tsx](./src/pages/RegisterPage.tsx) menaxhon formën. [pricing.ts](./src/lib/pricing.ts) llogarit çmimet. [register.ts](./src/services/register.ts) përgatit parametrat dhe thërret funksionin SQL për ruajtje.

### Të dhënat

Përdoruesi hap projekt ose kategori dhe mund të shohë/ndryshojë pozicionet, të krahasojë çmime dhe të shënojë koston reale të projektit. Redaktimi duhet të ngarkojë shpenzimet dhe normat ekzistuese; nuk duhet të sajojë një TVSH/fitim të ri vetëm sepse forma u hap e u ruajt.

Trendi mujor paraqet vlerën aktuale të ofertave për gjashtë muajt kalendarikë të fundit, të grupuar sipas muajit të krijimit të projektit. Mund të filtrohet sipas statusit dhe përfshin edhe muajt pa aktivitet. Kjo vlerë nuk nënkupton pagesa të pranuara ose fitim; nëse pozicionet e një projekti ndryshojnë më vonë, totali aktual i tij paraqitet te muaji i krijimit të projektit.

### Importi dhe Libri Ndërtimor

Faqja pranon Excel-in, paraqet pozicionet e lexuara, metadata-n dhe një plan të faqeve. Para shkarkimit, përdoruesi mund të ndërhyjë në bashkimin/ndarjen e faqeve; ndarja manuale ruhet me regjistrin e importit dhe përdoret kur libri rishikohet ose shkarkohet përsëri. Eksporti i një workbook-u përdor shabllonet në `public/templates`; eksporti ZIP i mban faqet si skedarë të veçantë.

### Fatura

Dy lloje dokumentesh: faturë kontrate dhe fletë-dërgesë me rreshta pozicionesh. Vlerat plotësohen manualisht në formë, validohen dhe pastaj vendosen në shabllonin Excel. Përdoruesi prapë duhet të kontrollojë rezultatin kundrejt dokumentit/kontratës origjinale.

### Kërkimi

Kërkimi global përfshin përshkrimin, numrin e pozicionit, emrin e projektit dhe emrin e kategorisë. Rezultatet e vjetra nuk duhet ta mbishkruajnë rezultatin për kërkesën e fundit kur përdoruesi shtyp shpejt.

## 4. Llogaritja e çmimit, hap pas hapi

Kontrata e rëndësishme e sistemit është që **njësitë e kostove të mos ngatërrohen**:

- material dhe punë: çmimi është për njësi pune, shumëzohet me sasinë;
- ushqim dhe transport: çmimi është për ditë, shumëzohet me ditët;
- shpenzimet tjera: shuma e plotë për pozicionin, nuk shumëzohet.

Formula në [pricing.ts](./src/lib/pricing.ts):

```text
M  = sasia × materiali për njësi
P  = sasia × puna për njësi
U  = ditët × ushqimi ditor
T  = ditët × transporti ditor
S  = shpenzimet tjera (shumë fikse)
N  = M + P + U + T + S
F  = N × (përqindja e fitimit / 100)
B  = N + F                       (baza e TVSH-së)
TV = B × (përqindja e TVSH-së / 100)
Totali me TVSH = B + TV
Çmimi për njësi = Totali me TVSH / sasia
```

Shembull:

- sasia = 2;
- materiali për njësi = €10 → €20;
- puna për njësi = €5 → €10;
- ditë = 1, ushqim = €4/ditë, transport = €8/ditë;
- shpenzime tjera = €3.

Nëntotali është €45. Me fitim 10%, fitimi = €4.50 dhe baza e TVSH-së = €49.50. Me TVSH 18%, TVSH = €8.91 dhe totali = €58.41. Çmimi për njësi = €29.205 (shfaqja/rrumbullakimi bëhet në formatim).

Funksioni përdoret si në preview ashtu edhe në ruajtje/redaktim për të shmangur kopjimin e formulës nëpër faqe.

### Pse raporti i fitimit duhet të heqë TVSH-në?

TVSH-ja e mbledhur për shtetin nuk është fitim i kompanisë. Nëse çmimi total është €118 me TVSH 18%, shitja pa TVSH është €100. Nëse kostoja është €80:

```text
Fitimi = €100 − €80 = €20
Fitimi ndaj kostos (markup) = €20 / €80 × 100 = 25%
```

Nëse gabimisht zbritet kostoja nga totali bruto, dalin €38 fitim dhe raporti i mbivlerëson rezultatet me shumën e TVSH-së. Për këtë arsye analiza përdor normën e TVSH-së së ruajtur me pozicionin për ta kthyer totalin bruto në vlerë neto.

“Fitimi ndaj kostos” (`profit / cost`) është markup, jo marzh i shitjes (`profit / revenue`). Të dyja janë raporte të vlefshme, por nuk janë e njëjta gjë. Në këtë implementim, përqindja është ndaj kostos.

## 5. Çfarë ruhet në databazë?

| Tabela | Çfarë ruan |
|---|---|
| `projects` | Emrin e projektit, klientin, statusin, shënimet dhe koston reale nëse plotësohet. |
| `categories` | Emrat e kategorive të pozicioneve. |
| `project_items` | Pozicionin, njësinë/sasinë, vlerën bruto, përqindjen e fitimit dhe të TVSH-së. |
| `item_expenses` | Zërat e kostos së lidhur me pozicionin. |
| `price_history` | Fotografi historike të vlerave të çmimeve gjatë ruajtjes/redaktimit. |
| `libri_exports` | Emrin e skedarit të importuar, metadata-n dhe pozicionet e parsuar për rigjenerim. |
| `profiles` | Të dhënat/rolet e profilit të lidhur me Supabase Auth. |

Marrëdhëniet kryesore:

```text
projects 1 ─── * project_items * ─── 1 categories
project_items 1 ─── * item_expenses
project_items 1 ─── * price_history
```

Një pozicion lidhet me një projekt, mund të ketë kategori dhe ka shumë rreshta shpenzimesh. Historiku nuk zëvendëson gjendjen aktuale të pozicionit.

## 6. Pse ndryshoi ruajtja e databazës?

### Para përmirësimit

Ruajtja e pozicionit bëhej me hapa të veçantë: krijo projektin, krijo kategorinë, fut pozicionin, pastaj fut shpenzimet. Nëse një hap dështonte në mes, mund të mbetej projekt bosh ose pozicion pa shpenzime.

Po ashtu, redaktimi bënte `UPDATE` të pozicionit dhe pastaj dy kërkesa të ndara (fshi shpenzimet e vjetra, fut të rejat). Dështimi pas fshirjes mund t'i linte kostot bosh.

### Pas përmirësimit

[Migrimi SQL](./supabase/migrations/20261013173000_preserve_pricing_and_atomic_saves.sql) shton:

- kolonat `profit_percent` dhe `vat_percent` në `project_items`;
- backfill të normave të njohura nga historiku; për të dhënat e vjetra pa normë, vlerësim duke supozuar TVSH 18% dhe duke ruajtur totalin;
- funksionin `save_register_position`, i cili krijon projekt/kategori kur duhen dhe ruan pozicionin me shpenzimet në një transaksion;
- funksionin `update_project_position`, i cili përditëson pozicionin dhe zëvendëson shpenzimet brenda një transaksioni.

Në PostgreSQL çdo thirrje RPC është transaksion: nëse insert/update i njërit prej rreshtave dështon, operacioni kthehet mbrapsht. Funksionet janë `SECURITY INVOKER`, pra nuk i anashkalojnë lejet/RLS të thirrësit; kjo sjellje duhet verifikuar me rolet reale.

### Hapat para përdorimit të versionit të ri

1. Kontrollo që Supabase-i i projektit përmban tabelat `projects`, `categories`, `project_items`, `item_expenses` dhe `price_history`.
2. Apliko `supabase/migrations/20261013173000_preserve_pricing_and_atomic_saves.sql` në databazën e synuar (me Supabase CLI ose SQL Editor sipas procesit që përdor).
3. Konfirmo që migrimi përfundoi pa gabime.
4. Testo krijimin dhe redaktimin e një projekti/pozicioni me përdorues të autentikuar.
5. Provo me role që nuk duhet të kenë leje dhe sigurohu që RLS i refuzon veprimet.

Këtu nuk ka mjedis të lidhur me databazën e gjallë. Build-i lokal nuk ekzekuton migrimin, prandaj kjo pjesë duhet bërë e testuar nga ti në Supabase para publikimit. Mos i dërgo askujt çelësat privatë të projektit.

## 7. Si funksionon importi Excel?

Pika hyrëse është [excel.ts](./src/lib/excel.ts):

1. Skedari lexohet në shfletues përmes `FileReader`.
2. Për secilën fletë kontrollohet nëse i përket formatit “Libri Ndërtimor”.
3. Nëse po, [libriNdertimor.ts](./src/lib/libriNdertimor.ts) nxjerr metadata, përshkrime, matje dhe sasi.
4. Përndryshe provohet formatimi strukturor/tabelor, pastaj parseri legacy si fallback.
5. Rreshtat dublikatë eliminohen dhe, nëse gjehet rresht “TOTALI”, shuma e deklaruar krahasohet me shumën e llogaritur.

Kontrolli i totalit nuk provon se çdo rresht i lexuar është semantikisht i saktë; është sinjal për të dalluar dokumentet ku mund të ketë pozicione të humbura ose të lexuara gabim. Përdoruesi duhet të kontrollojë preview-n.

## 8. Si planifikohen faqet e Librit Ndërtimor?

[paramasaPreview.ts](./src/lib/paramasaPreview.ts) i grupon pozicionet sipas seksionit. [libriPaging.ts](./src/lib/libriPaging.ts) vlerëson nëse përshkrimet përshtaten në slote të shablloneve me 1–5 pozicione. Preferon një faqe me më shumë pozicione vetëm nëse tekstet përshtaten; në rast tjetër ndan faqet dhe sinjalizon overflow kur edhe një pozicion nuk përshtatet.

[libriPlanEditor.ts](./src/lib/libriPlanEditor.ts) zbaton veprimet manuale:

- bashkim i dy faqeve fqinje, me kapacitet maksimal pesë pozicione;
- ndarje pas një pozicioni;
- lëvizje të pozicionit në faqe tjetër nëse përshtatet.

Përshkrimi në fushën e metadata-s mund të ndryshohet; preview dhe eksporti duhet të përdorin të njëjtin plan për të shmangur dokumente që nuk përputhen me pamjen paraprake.

## 9. Backup-i: çfarë përfshin dhe çfarë jo?

Shkarkimi JSON tani lexon faqet me intervale 1,000 rreshtash për secilën tabelë operative dhe e ndërpret eksportin nëse ndonjë kërkesë dështon. Ai përfshin:

- projekte, kategori, pozicione dhe shpenzime;
- historikun e çmimeve;
- regjistrat e importit të Librit Ndërtimor.

Ai **nuk** përfshin profilet/auth të përdoruesve dhe nuk ka buton për rikthim automatik të JSON-it në databazë. Pra është eksport i të dhënave të punës, jo kopje e plotë e infrastrukturës/databazës. Ruaje skedarin në lokacion të sigurt sepse mund të përmbajë të dhëna biznesi.

## 10. Siguria dhe kufijtë që duhen kuptuar

- Supabase Auth menaxhon identitetin; profili i aplikacionit ka role/status aprovimi.
- Rruga e mbrojtur në frontend nuk është vetë kufi sigurie. RLS në databazë është kontrolli vendimtar për rreshtat.
- Konfigurimi real RLS nuk mund të konfirmohet vetëm duke lexuar UI-në. Kontrolloje në Supabase.
- Aplikacioni mund të kalojë në mënyrë demo kur Supabase nuk është konfiguruar; kjo nuk duhet ngatërruar me autentikim prodhimi.
- Raportet që mbledhin shumë rreshta duhet të marrin parasysh kufirin e rezultateve të API-së. Për databaza të mëdha, bëj agregim SQL ose faqëzim të plotë.
- Kostoja reale e projektit është vlerë që përdoruesi e plotëson, jo rezultat i integrimit me faturat reale.
- Parseri mbështet formatet e njohura; para importit të një formati të ri kontrollo preview-n dhe totalet.

## 11. Si verifikohen ndryshimet?

Komandat:

```powershell
npm run build
npm exec -- vitest run
```

Pas rregullimeve të tanishme:

- `npm run build` — kaloi;
- `npm exec -- vitest run` — kaluan 11 teste në 4 skedarë;
- testet mbulojnë llogaritjen dhe konvertimin nga bruto në neto, datat, kategoritë, trendin mujor, ndarjen e seksioneve, planifikimin e faqeve dhe ndërtimin e workbook-ut nga skedari i vërtetë i shabllonit.

Këto janë teste lokale të logjikës. Nuk testojnë transaksionet në një databazë reale, RLS, autentikim të vendosur, UI në shfletues ose përputhjen juridike/kontabël të faturave.

## 12. Çfarë është rregulluar në kod në këtë iterim?

1. Normat e fitimit dhe TVSH-së ruhen te pozicioni dhe ngarkohen prapë gjatë redaktimit.
2. Fitimi në raport llogaritet kundrejt ofertës pa TVSH, jo totalit bruto.
3. Ruajtja fillestare dhe përditësimi i pozicionit/shpenzimeve janë RPC transaksionale (pas aplikimit të migrimit).
4. Ndërrimi i kapacitetit të shabllonit në ndërtuesin manual nuk i fshin më rreshtat e plotësuar; eksporti i ndan sipas kapacitetit.
5. Backup-i i raporton gabimet, lexon me faqe dhe përfshin historikun e çmimeve/regjistrat e Librit.
6. Kërkimi përfshin kategoritë dhe kërkesat e vjetra nuk i mbishkruajnë rezultatet më të reja.
7. Testi i workbook-ut ngarkon shabllonin lokal për Node, kështu shmanget përdorimi i URL-së relative të shfletuesit në Vitest.
8. Trendi mujor te faqja “Të dhënat” paraqet vlerën e ofertave sipas muajit të krijimit të projektit, me filtër statusi dhe periudhë gjashtëmujore.

## 13. Fjalor i shkurtër

- **Pozicion:** rresht pune/ofertimi, p.sh. një lloj punimi me përshkrim, njësi, sasi dhe çmime.
- **Paramasë:** listë pozicionesh dhe sasish të parashikuara për punë.
- **Libër Ndërtimor:** dokument me pozicione dhe matje që përdoren për evidentim të punëve.
- **Nëntotali:** shuma e komponentëve të kostos para fitimit dhe TVSH-së.
- **TVSH:** tatim mbi vlerën e shtuar; nuk është fitim i kompanisë.
- **Markup (fitimi ndaj kostos):** fitimi pjesëtuar me koston.
- **RPC:** thirrje e funksionit të databazës nga klienti; funksioni i ruajtjes ekzekutohet si transaksion.
- **RLS:** rregulla të PostgreSQL/Supabase që kufizojnë cilat rreshta mund të lexojë/ndryshojë një përdorues.
- **Migration:** skedar versionimi për ndryshim të skemës ose funksioneve të databazës.

## 14. Çfarë duhet sqaruar me mentorin?

- Cili format dhe cilat udhëzime citimi kërkohen për punimin formal?
- A dëshiron mentori një studim të përdorshmërisë me përdorues realë si pjesë të rezultateve?
- Cilat shabllone dhe raste reale mund të përfshihen në testim pa publikuar të dhëna konfidenciale?
- Si duhet të paraqitet kontributi: më shumë si sistem i ofertimit, si menaxhim i dokumenteve, apo si të dyja?
- A duhet të përfshihet migrimi SQL dhe modeli i databazës si figura/tabela në kapitullin e projektimit?

Mos i shpik përgjigjet në punim. Shëno vendimet pasi t'i konfirmosh me mentorin dhe me përdoruesit e synuar.
