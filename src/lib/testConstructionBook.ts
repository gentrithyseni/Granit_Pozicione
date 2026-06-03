/**
 * TESTIMI I LIBRIT NDËRTIMOR
 * 
 * Ky file mund ta përdorësh për të testuar logjikën e gjenerimit
 * pa pasur nevojë për React ose Supabase.
 * 
 * Përdorimi:
 * 1. Kopjo në src/lib/testConstructionBook.ts
 * 2. Importo në çdo komponent: import { runTest } from './testConstructionBook'
 * 3. Thirr: runTest() në console ose në një useEffect
 */

import { generateAndDownload, ConstructionBookConfig } from './constructionBook';

/**
 * Test 1: Faqe me 2 pozicione (si "2 faqe.xlsx")
 */
export function testTwoPositions() {
  const config: ConstructionBookConfig = {
    month: 'GUSHT 2025',
    executor_name: 'MEGRANT ING SH.P.K',
    building_name: 'Riorganizimi i kuzhinës në objektin - institucionin Parashkollorë dhe montimi i Platformës për personat me nevoja të veçanta',
    section_title: 'II. KUZHINA E ÇERDHES',
    section_number: 'II',
    unit_label: 'komplet',
    offer_account: 'No II',
    offer_positions: 'No II.4, II.5',
    positions: [
      {
        position_number: 'II.4',
        description: 'Furnizimi , transporti dhe montimi i derës së re , që lidh kuzhinën me hapësirën e ngrënies , me dim.100x210 cm nga Mediapani , dhe e cila hapet në të dy anët (derë "fluturuese").',
        unit: 'copë',
        quantity: 1.00,
        unit_price: 350.00,
        total_price: 350.00
      },
      {
        position_number: 'II.5',
        description: 'Rirganizimi i komplet I rrjetit të Ujësjellësit dhe Kanalizimit ekzistues në kuzhinë, duke përfshirë edhe kyqjen - montimin e elementeve të kuzhinës së re, sipas projektit zbatues teknik.',
        unit: 'komplet',
        quantity: 1.00,
        unit_price: 350.00,
        total_price: 350.00
      }
    ],
    max_positions_per_page: 4
  };

  generateAndDownload(config, 'Test_2_Pozicione.xlsx');
  console.log('✅ Testi 1: 2 pozicione - u gjenerua');
}

/**
 * Test 2: Faqe me 3 pozicione (si "3 faqe.xlsx")
 */
export function testThreePositions() {
  const config: ConstructionBookConfig = {
    month: 'SHTATOR 2025',
    executor_name: 'MEGRANT ING SH.P.K',
    building_name: 'Renovimi dhe Adaptimi i hapësirave ne objektin e DSS-së',
    section_title: 'V. PUNIMET TË TJERA',
    section_number: 'V',
    unit_label: 'm²',
    offer_account: 'No V',
    offer_positions: 'No 5.1, 5.2, 5.3',
    positions: [
      {
        position_number: '5.1',
        description: 'Furnizimi, transporti dhe punimi i dyshemeve e të kabines me nivelizim nga betoni gjysem i terur me punim te shtresave termoizolues nga stiroduri dhe shtresave tjera sipas standardeve . Ne kalkulim te perfshihen edhe punimi i Lminatit llajsneve perimetrike , si dhe te gjitha materialet dhe elementet e nevojshme per montimin e dyshemes . Llog. ne m²',
        unit: 'm²',
        quantity: 16.50,
        unit_price: 16.00,
        total_price: 264.00
      },
      {
        position_number: '5.2',
        description: 'Furnizimi, transporti dhe montimi i nje pjese te murit mr llamarin te plastifikuae Në çmim te parashifet edhe punimi i nen konstruksionit nga profilet metalikee të muri I atikes h=1.0 m me drrasa te punuara d=16 mm me mveshje nga llamarina. Në çmim te parashifen edhe mjetet lidhes si dhe platforma punueseLlog. ne m²',
        unit: 'm²',
        quantity: 5.00,
        unit_price: 30.00,
        total_price: 150.00
      },
      {
        position_number: '5.3',
        description: 'Furnizimi me material si dhe montimi i ulëseve me gjatësi të caktuar dei ne 10 m dhe gjerësi 400 mm nga druri. Në çmim duhet të parashihet edhe ankerimi per dysheme . Në çmim parashihet edhe lyerja me material për mbrojtje kundër lagështisë, insekteve, këpurdhave si dhe lyerja përfundimtare. Punëkryesi obligohet që para vurjes në veper të marr aprovomin nga ana e organit mbikëqyrës si dhe gjithashtu paraprakisht të prezentoj çertifikatat dhe atestet e nevojshme për aprovim nga ana e organit mbikëqyrës. Lloji i ulëseve duhet të jetë i patentuar dhe i çertifikuar',
        unit: 'm',
        quantity: 10.00,
        unit_price: 65.00,
        total_price: 650.00
      }
    ],
    max_positions_per_page: 4
  };

  generateAndDownload(config, 'Test_3_Pozicione.xlsx');
  console.log('✅ Testi 2: 3 pozicione - u gjenerua');
}

/**
 * Test 3: Faqe me 4 pozicione (si "4 faqe.xlsx")
 */
export function testFourPositions() {
  const config: ConstructionBookConfig = {
    month: 'SHTATOR 2025',
    executor_name: 'MEGRANT ING SH.P.K',
    building_name: 'Renovimi dhe Adaptimi i hapësirave ne objektin e DSS-së',
    section_title: 'V. PUNIMET TË TJERA',
    section_number: 'V',
    unit_label: 'm²,komplet',
    offer_account: 'No V',
    offer_positions: 'No 5.11, 5.12, 5.13, 5.14',
    positions: [
      {
        position_number: '5.11',
        description: 'Furnizimi i materialit dhe ngjyrosja e mureve të koridorit me ngjyrë ne tri shtresa. Deri ne lartesine h=1.2m, te aplikohet ngjyra e yndyrshme e cila mund te mirembahet-pastrohet me uj. Ngjyren e cakton organi mbikqyres',
        unit: 'm²',
        quantity: 55.00,
        unit_price: 1.50,
        total_price: 82.50
      },
      {
        position_number: '5.12',
        description: 'Furnizimi, transportimi dhe ngjyrosja e mureve dhe Pllafoneve të kthinavet të brendshme me ngjyrë dispersive. Ngjyren e cakton organi mbikqyres',
        unit: 'm²',
        quantity: 325.00,
        unit_price: 1.50,
        total_price: 487.50
      },
      {
        position_number: '5.13',
        description: 'Furnizimi dhe montimi I konstruksionit nga amstrongu, ne çmim te llogaritet edhe largimi i Dritave e te demtuara dhe zevendesimi i tyre me te reja.Llog ne m²',
        unit: 'm²',
        quantity: 35.00,
        unit_price: 18.00,
        total_price: 630.00
      },
      {
        position_number: '5.14',
        description: 'Pastrimi, larja, dizinfektimi i gjithembarshem i hapesirave te brendshme te objektit pas perfundimit te punimeve. Materiali i cili pastrohet te largohet nga objekti.Llog ne komplet',
        unit: 'komplet',
        quantity: 1.00,
        unit_price: 50.00,
        total_price: 50.00
      }
    ],
    max_positions_per_page: 4
  };

  generateAndDownload(config, 'Test_4_Pozicione.xlsx');
  console.log('✅ Testi 3: 4 pozicione - u gjenerua');
}

/**
 * Test 4: Shumë pozicione (test ndarjeje në faqe)
 */
export function testMultiplePages() {
  const positions = Array.from({ length: 12 }, (_, i) => ({
    position_number: `5.${i + 1}`,
    description: `Pozicioni test ${i + 1} me përshkrim të mesëm që zë disa rreshta në Excel për shkak të gjatësisë. Ky është një tekst demonstrues për të testuar ndarjen automatike në faqe.`,
    unit: 'm²',
    quantity: 10 + i,
    unit_price: 15 + i * 2,
    total_price: (10 + i) * (15 + i * 2)
  }));

  const config: ConstructionBookConfig = {
    month: 'TETOR 2025',
    executor_name: 'MEGRANT ING SH.P.K',
    building_name: 'Test Multi-Faqe',
    section_title: 'V. PUNIMET TË TJERA',
    section_number: 'V',
    unit_label: 'm²',
    offer_account: 'No V',
    offer_positions: `No ${positions.map(p => p.position_number).join(', ')}`,
    positions,
    max_positions_per_page: 4
  };

  generateAndDownload(config, 'Test_Multi_Faqe.xlsx');
  console.log('✅ Testi 4: 12 pozicione (multi-faqe) - u gjenerua');
}

/**
 * Test 5: Pozicion me përshkrim shumë të gjatë (test wrap)
 */
export function testLongDescription() {
  const config: ConstructionBookConfig = {
    month: 'NËNTOR 2025',
    executor_name: 'MEGRANT ING SH.P.K',
    building_name: 'Test Përshkrim i Gjatë',
    section_title: 'V. PUNIMET TË TJERA',
    section_number: 'V',
    unit_label: 'm²',
    offer_account: 'No V',
    offer_positions: 'No 5.1',
    positions: [
      {
        position_number: '5.1',
        description: 'Ky është një pozicion me përshkrim shumë të gjatë për të testuar se si sistemi i ndan faqet. Përshkrimi duhet të jetë kaq i gjatë sa të zërë të paktën 5-6 rreshta në Excel kur është me wrap text. Furnizimi, transporti dhe montimi i të gjitha elementeve të nevojshme sipas projektit teknik zbatues, duke përfshirë të gjitha materialet, punën, mjetet dhe shpenzimet e tjera. Punët kryhen sipas standardeve ndërkombëtare dhe lokale në fuqi. Punëkryesi është përgjegjës për cilësinë e punimeve dhe garanton punët për një periudhë minimale prej 24 muajsh.',
        unit: 'm²',
        quantity: 100.00,
        unit_price: 25.00,
        total_price: 2500.00
      }
    ],
    max_positions_per_page: 4
  };

  generateAndDownload(config, 'Test_Long_Desc.xlsx');
  console.log('✅ Testi 5: Përshkrim i gjatë - u gjenerua');
}

/**
 * Vrapo të gjitha testet
 */
export function runAllTests() {
  console.log('🚀 Duke filluar testet e Librit Ndërtimor...\n');

  // Vrapo me vonesë për të mos bllokuar browser-in
  setTimeout(() => testTwoPositions(), 100);
  setTimeout(() => testThreePositions(), 500);
  setTimeout(() => testFourPositions(), 1000);
  setTimeout(() => testMultiplePages(), 1500);
  setTimeout(() => testLongDescription(), 2000);

  console.log('\n📋 Testet u nisën. Kontrollo folderin e shkarkimeve.');
}

/**
 * Test i shpejtë me një pozicion
 */
export function runQuickTest() {
  testTwoPositions();
}