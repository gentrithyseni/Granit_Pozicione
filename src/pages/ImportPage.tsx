import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, FileSpreadsheet, Info, Trash2 } from 'lucide-react';
import { ParamasaPreview, type ParamasaPreviewMeta, type PageGroupingMode } from '../components/ParamasaPreview';
import { ManualPageBuilder } from '../components/ManualPageBuilder';
import { Shell } from '../components/Shell';
import { useToast } from '../context/ToastContext';
import { parseExcelWithValidation, type ImportDiagnostic, type ParsedRow, type WorkbookMetadataSuggestions } from '../lib/excel';
import { groupRowsBySection } from '../lib/paramasaPreview';
import {
  buildLibriNdertimorWorkbook,
  buildLibriNdertimorZip,
  downloadWorkbookBuffer,
  downloadBlob,
  planLibriExport,
  restoreLibriExportPlan,
  serializeLibriExportPlan,
  type LibriExportPlanPage,
} from '../lib/libriExport';
import {
  saveLibriExportRecord,
  saveLibriExportPageLayout,
  fetchLibriExportRecords,
  deleteLibriExportRecord,
  type LibriExportRecord,
} from '../services/libriExports';
import { supabase } from '../lib/supabase';
import type { DbProject } from '../types/database';

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeBaseName(fileName: string): string {
  return fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type PreviewMetaSuggestion = {
  meta: ParamasaPreviewMeta;
  objectSource: string;
  chapterSource: string;
};

function suggestPreviewMeta(
  rows: ParsedRow[],
  fileName: string,
  projectName: string,
  workbookMeta: WorkbookMetadataSuggestions
): PreviewMetaSuggestion {
  const baseName = normalizeBaseName(fileName);
  const genericFileWords = new Set(['paramasa', 'paramas', 'me', 'cmime', 'oferta', 'libri', 'ndertimor', 'ndertimore', 'xlsx', 'xls']);
  const fileHint = toTitleCase(
    baseName.split(/\s+/).filter((word) => !genericFileWords.has(word.toLowerCase())).join(' ')
  );
  const positions = rows.map((row) => row.position_number).filter(Boolean).slice(0, 8);
  const objectName = workbookMeta.objectName || projectName || fileHint;
  const sectionTitle = workbookMeta.sectionTitle || rows.find((row) => row.section_title)?.section_title || '';
  const offerAccount = workbookMeta.offerAccount || workbookMeta.sectionTitle?.match(/^([IVXLCDM]+|\d+)\b/i)?.[1] || '';

  return {
    meta: {
      executorName: workbookMeta.executorName || '',
      month: workbookMeta.month || new Date().toLocaleDateString('sq-AL', { month: 'long', year: 'numeric' }),
      date: new Date().toLocaleDateString('sq-AL'),
      objectName,
      offerAccount,
      offerPositions: workbookMeta.offerPositions || positions.join(', '),
      sectionTitle,
    },
    objectSource: workbookMeta.objectName
      ? 'metadata e gjetur në Excel'
      : projectName
        ? 'projekti i zgjedhur'
        : fileHint
          ? 'emri i skedarit (sugjerim për verifikim)'
          : 'nuk u gjet në Excel',
    chapterSource: sectionTitle
      ? workbookMeta.sectionTitle
        ? 'metadata/titulli i kapitullit në Excel'
        : 'rreshti i titullit në Excel'
      : 'nuk u gjet titull i qartë në Excel',
  };
}

function mergeSuggestedFields(
  current: ParamasaPreviewMeta,
  previousSuggestion: ParamasaPreviewMeta | null,
  nextSuggestion: ParamasaPreviewMeta
): ParamasaPreviewMeta {
  const merged = { ...current };
  (Object.keys(current) as Array<keyof ParamasaPreviewMeta>).forEach((key) => {
    const isUntouchedDefault = key === 'executorName' && current[key] === DEFAULT_EXECUTOR_NAME && !previousSuggestion;
    if (!current[key] || current[key] === previousSuggestion?.[key] || isUntouchedDefault) {
      merged[key] = nextSuggestion[key];
    }
  });
  return merged;
}

function splitSectionTitle(value: string): { number: string; title: string } {
  const match = /^\s*((?:[IVXLCDM]+|\d+)\.?)\s*(.*)$/i.exec(value);
  return match ? { number: match[1].replace(/\.$/, ''), title: match[2].trim() } : { number: '', title: value };
}

const LIBRI_PRICE_NOTE = 'Nga Libri Ndërtimor: çmimi nuk vjen nga ky skedar, duhet plotësuar/kombinuar manualisht.';
const DEFAULT_EXECUTOR_NAME = 'Megrant ING SH.P.K';

export function ImportPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [declaredTotal, setDeclaredTotal] = useState<number | null>(null);
  const [importDiagnostics, setImportDiagnostics] = useState<ImportDiagnostic[]>([]);
  const [metadataSuggestionNotes, setMetadataSuggestionNotes] = useState<{ objectSource: string; chapterSource: string } | null>(null);
  const [sectionTitleOverrides, setSectionTitleOverrides] = useState<Record<string, string>>({});
  const [groupingMode, setGroupingMode] = useState<PageGroupingMode>('auto');
  const [manualPlan, setManualPlan] = useState<LibriExportPlanPage[] | null>(null);
  const [currentLibriExportId, setCurrentLibriExportId] = useState<string | null>(null);

  const detectedSections = useMemo(() => groupRowsBySection(rows), [rows]);
  const rowReviewIssues = useMemo(
    () => rows.flatMap((row) =>
      (row.issues ?? [])
        .filter((issue) => issue !== LIBRI_PRICE_NOTE)
        .map((message) => ({ position: row.position_number || '—', rowNumber: row.source_row, message }))
    ),
    [rows]
  );
  const computedImportTotal = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.total_price) || 0), 0),
    [rows]
  );
  const unpricedPositionCount = useMemo(
    () => rows.filter((row) => row.source !== 'libri' && row.quantity > 0 && row.unit_price === 0).length,
    [rows]
  );
  const hasTotalMismatch = declaredTotal !== null &&
    Math.abs(declaredTotal - computedImportTotal) > Math.max(1, declaredTotal * 0.005);
  const autoPlan = useMemo(
    () => (rows.length > 0 ? planLibriExport(rows, sectionTitleOverrides) : []),
    [rows, sectionTitleOverrides]
  );
  const activePlan = groupingMode === 'manual' && manualPlan ? manualPlan : autoPlan;
  const importStepIndex = rows.length === 0 ? 0 : groupingMode === 'manual' ? 2 : 1;
  const workflowSteps = [
    { title: 'Ngarko', hint: 'Excel-in origjinal' },
    { title: 'Kontrollo seksionet', hint: 'Rregullo titujt' },
    { title: 'Rregullo faqet', hint: 'Bashko ose nda' },
    { title: 'Shkarko', hint: '.xlsx / .zip' },
  ];
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [previewMode, setPreviewMode] = useState<'table' | 'preview'>('preview');
  const [mainTab, setMainTab] = useState<'excel' | 'manual'>('excel');
  const [libriExportLoading, setLibriExportLoading] = useState(false);
  const [zipExportLoading, setZipExportLoading] = useState(false);
  const [previewMeta, setPreviewMeta] = useState<ParamasaPreviewMeta>({
    executorName: DEFAULT_EXECUTOR_NAME,
    month: '',
    date: new Date().toLocaleDateString('sq-AL'),
    objectName: '',
    offerAccount: '',
    offerPositions: '',
    sectionTitle: '',
  });
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [libriHistory, setLibriHistory] = useState<LibriExportRecord[]>([]);
  const [libriHistoryPage, setLibriHistoryPage] = useState(1);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const [historyGroupingMode, setHistoryGroupingMode] = useState<PageGroupingMode>('auto');
  const [historyManualPlan, setHistoryManualPlan] = useState<LibriExportPlanPage[] | null>(null);
  const [historyActionId, setHistoryActionId] = useState<string | null>(null);
  const { showToast, showSavedToast } = useToast();
  const layoutSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const previousAutoSuggestion = useRef<ParamasaPreviewMeta | null>(null);

  const reloadLibriHistory = () => {
    void fetchLibriExportRecords()
      .then(setLibriHistory)
      .catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : 'Historiku i Librit nuk u ngarkua.', 'error');
      });
  };

  const libriHistoryPageSize = 5;
  const libriHistoryPageCount = Math.max(1, Math.ceil(libriHistory.length / libriHistoryPageSize));
  const visibleLibriHistory = useMemo(
    () => libriHistory.slice((libriHistoryPage - 1) * libriHistoryPageSize, libriHistoryPage * libriHistoryPageSize),
    [libriHistory, libriHistoryPage]
  );

  useEffect(() => {
    setLibriHistoryPage((currentPage) => Math.min(currentPage, libriHistoryPageCount));
  }, [libriHistoryPageCount]);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      try {
        const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        if (error) {
          showToast(`Projektet nuk u ngarkuan: ${error.message}`, 'error');
          return;
        }
        if (data) setProjects(data);
      } catch (error) {
        showToast(error instanceof Error ? `Projektet nuk u ngarkuan: ${error.message}` : 'Projektet nuk u ngarkuan.', 'error');
      }
    })();
    reloadLibriHistory();
  }, []);

  useEffect(() => {
    const historyRecord = viewingHistoryId
      ? libriHistory.find((record) => record.id === viewingHistoryId) ?? null
      : null;
    const targetId = historyRecord?.id ?? (!viewingHistoryId ? currentLibriExportId : null);
    if (!targetId) return;

    const sourceRows = historyRecord?.rows ?? rows;
    const meta = historyRecord?.meta ?? previewMeta;
    const currentMode = historyRecord ? historyGroupingMode : groupingMode;
    const currentPlan = historyRecord ? historyManualPlan : manualPlan;
    const persistedRecord = libriHistory.find((record) => record.id === targetId);
    const storedPlan = currentMode === 'manual' && currentPlan
      ? serializeLibriExportPlan(currentPlan, sourceRows)
      : null;
    const storedManualPlan = currentPlan
      ? serializeLibriExportPlan(currentPlan, sourceRows)
      : persistedRecord?.manualPageLayout ?? null;

    if (currentMode === 'manual' && currentPlan && !storedPlan) {
      return;
    }
    if (currentPlan && !storedManualPlan) {
      return;
    }
    if (
      persistedRecord &&
      JSON.stringify(persistedRecord.pageLayout) === JSON.stringify(storedPlan) &&
      JSON.stringify(persistedRecord.manualPageLayout) === JSON.stringify(storedManualPlan)
    ) return;

    let active = true;
    const timeoutId = window.setTimeout(() => {
      const saveOperation = layoutSaveQueue.current
        .then(() => saveLibriExportPageLayout(targetId, meta, storedPlan, storedManualPlan))
        .then(() => {
          if (!active) return;
          setLibriHistory((current) => {
            const record = current.find((item) => item.id === targetId);
            if (
              !record ||
              (JSON.stringify(record.pageLayout) === JSON.stringify(storedPlan) &&
                JSON.stringify(record.manualPageLayout) === JSON.stringify(storedManualPlan))
            ) return current;
            return current.map((item) => item.id === targetId
              ? { ...item, pageLayout: storedPlan, manualPageLayout: storedManualPlan }
              : item);
          });
        })
        .catch((error: unknown) => {
          if (active) {
            showToast(
              error instanceof Error
                ? `Ndarja e faqeve nuk u ruajt: ${error.message}`
                : 'Ndarja e faqeve nuk u ruajt.',
              'error'
            );
          }
        });
      layoutSaveQueue.current = saveOperation;
    }, 500);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    currentLibriExportId,
    groupingMode,
    historyGroupingMode,
    historyManualPlan,
    libriHistory,
    manualPlan,
    previewMeta,
    rows,
    showToast,
    viewingHistoryId,
  ]);

  const persistLayoutNow = async (
    id: string,
    meta: ParamasaPreviewMeta,
    sourceRows: ParsedRow[],
    mode: PageGroupingMode,
    plan: LibriExportPlanPage[] | null,
    lastManualPlan: LibriExportPlanPage[] | null = mode === 'manual' ? plan : null
  ): Promise<boolean> => {
    const persistedRecord = libriHistory.find((record) => record.id === id);
    const storedPlan = mode === 'manual' && plan
      ? serializeLibriExportPlan(plan, sourceRows)
      : null;
    const storedManualPlan = lastManualPlan
      ? serializeLibriExportPlan(lastManualPlan, sourceRows)
      : persistedRecord?.manualPageLayout ?? (mode === 'manual' ? storedPlan : null);
    if (mode === 'manual' && plan && !storedPlan) {
      showToast('Faqet nuk u ruajtën manualisht sepse disa pozicione mungojnë ose janë të përsëritura.', 'error');
      return false;
    }
    if (lastManualPlan && !storedManualPlan) {
      showToast('Faqet nuk u ruajtën manualisht sepse disa pozicione mungojnë ose janë të përsëritura.', 'error');
      return false;
    }
    if (
      persistedRecord &&
      JSON.stringify(persistedRecord.pageLayout) === JSON.stringify(storedPlan) &&
      JSON.stringify(persistedRecord.manualPageLayout) === JSON.stringify(storedManualPlan)
    ) return true;

    const saveOperation = layoutSaveQueue.current.then(() =>
      saveLibriExportPageLayout(id, meta, storedPlan, storedManualPlan)
    );
    layoutSaveQueue.current = saveOperation.catch(() => undefined);
    try {
      await saveOperation;
      setLibriHistory((current) => {
        const record = current.find((item) => item.id === id);
        if (
          !record ||
          (JSON.stringify(record.pageLayout) === JSON.stringify(storedPlan) &&
            JSON.stringify(record.manualPageLayout) === JSON.stringify(storedManualPlan))
        ) return current;
        return current.map((item) => item.id === id
          ? { ...item, pageLayout: storedPlan, manualPageLayout: storedManualPlan }
          : item);
      });
      return true;
    } catch (error) {
      showToast(
        error instanceof Error
          ? `Ndarja e faqeve nuk u ruajt: ${error.message}`
          : 'Ndarja e faqeve nuk u ruajt.',
        'error'
      );
      return false;
    }
  };

  // Vetëm plotëson fushat ende bosh kur zgjidhet një projekt — s'e prek asnjë fushë që
  // përdoruesi e ka shkruar tashmë vetë (rregullim i raportuar: muaji/objekti fshiheshin
  // pas çdo ngarkimi/ndryshim projekti).
  useEffect(() => {
    if (!selectedProjectId) return;
    const selectedProject = projects.find((project) => project.id === selectedProjectId);
    if (!selectedProject) return;
    setPreviewMeta((current) => ({
      ...current,
      executorName: current.executorName || selectedProject.name,
      objectName:
        !current.objectName || current.objectName === previousAutoSuggestion.current?.objectName
          ? selectedProject.name
          : current.objectName,
    }));
    if (previousAutoSuggestion.current) {
      previousAutoSuggestion.current = { ...previousAutoSuggestion.current, objectName: selectedProject.name };
    }
  }, [selectedProjectId, projects]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setCurrentLibriExportId(null);
    setGroupingMode('auto');
    setManualPlan(null);
    setFileName(file.name);
    setRows([]);
    setDeclaredTotal(null);
    setImportDiagnostics([]);
    setSectionTitleOverrides({});
    try {
      const { rows: parsedRows, declaredTotal: fileTotal, diagnostics, suggestedMeta } = await parseExcelWithValidation(file);
      if (parsedRows.length === 0) {
        setFileName('');
        event.target.value = '';
        showToast('Nuk u gjet asnjë pozicion në këtë Excel. Kontrollo që skedari të ketë kolonat e pozicionit, përshkrimit, sasisë dhe çmimit.', 'error');
        return;
      }
      setRows(parsedRows);
      setDeclaredTotal(fileTotal);
      setImportDiagnostics(diagnostics);
      const selectedProject = projects.find((project) => project.id === selectedProjectId);
      const { meta: suggested, ...suggestionNotes } = suggestPreviewMeta(
        parsedRows,
        file.name,
        selectedProject?.name || '',
        suggestedMeta
      );
      const mergedMeta = mergeSuggestedFields(previewMeta, previousAutoSuggestion.current, suggested);
      previousAutoSuggestion.current = suggested;
      setMetadataSuggestionNotes(suggestionNotes);
      setPreviewMeta(mergedMeta);

      const computedTotal = parsedRows.reduce((sum, row) => sum + (Number(row.total_price) || 0), 0);
      if (fileTotal !== null && Math.abs(fileTotal - computedTotal) > Math.max(1, fileTotal * 0.005)) {
        showToast(
          `⚠ Kujdes: skedari thotë totali është ${fileTotal.toFixed(2)}€, por sistemi llogariti ${computedTotal.toFixed(2)}€ — diçka mund të mungojë.`,
          'error'
        );
      }

      if (parsedRows.length > 0) {
        try {
          const recordId = await saveLibriExportRecord(file.name, parsedRows, mergedMeta);
          setCurrentLibriExportId(recordId);
          if (recordId) reloadLibriHistory();
          else if (supabase) showToast('Paramasa u lexua, por nuk u ruajt në historikun e Librit.', 'error');
        } catch (error) {
          showToast(
            error instanceof Error
              ? `Paramasa u lexua, por nuk u ruajt në historikun e Librit: ${error.message}`
              : 'Paramasa u lexua, por nuk u ruajt në historikun e Librit.',
            'error'
          );
        }
      }
    } catch (error) {
      showToast(error instanceof Error ? `Gabim gjatë leximit të Excel-it: ${error.message}` : 'Gabim gjatë leximit të Excel-it.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleGroupingModeChange = (mode: PageGroupingMode) => {
    setGroupingMode(mode);
    if (mode === 'manual' && !manualPlan) {
      setManualPlan(autoPlan);
    }
  };

  const handleCancelImport = () => {
    setRows([]);
    setCurrentLibriExportId(null);
    setManualPlan(null);
    setGroupingMode('auto');
  };

  const handleDownloadLibriNdertimor = async () => {
    if (rows.length === 0) return;
    setLibriExportLoading(true);
    try {
      const plan = activePlan;
      const layoutSaved = currentLibriExportId
        ? await persistLayoutNow(currentLibriExportId, previewMeta, rows, groupingMode, plan, manualPlan)
        : !supabase;
      const buffer = await buildLibriNdertimorWorkbook(rows, previewMeta, undefined, sectionTitleOverrides, plan);
      downloadWorkbookBuffer(buffer, `${normalizeBaseName(fileName) || 'Paramasa'}-Libri-Ndertimor.xlsx`);
      const overflowPages = plan.filter((page) => page.overflowWarning).length;
      const mixedPages = plan.filter((page) => page.mixedUnitsWarning).length;
      if (overflowPages > 0 || mixedPages > 0) {
        const parts: string[] = [];
        if (overflowPages > 0) parts.push(`${overflowPages} me përshkrim të gjatë`);
        if (mixedPages > 0) parts.push(`${mixedPages} me njësi të përziera`);
        showToast(`Skedari u shkarkua (${plan.length} faqe). Kontrollo: ${parts.join(', ')}.`, 'info');
      } else {
        showToast(`Skedari u shkarkua: ${plan.length} faqe në formatin origjinal.`, 'success');
      }
      if (!layoutSaved && !currentLibriExportId && supabase) {
        showToast('Skedari u shkarkua, por Libri nuk ka identifikues për ruajtjen e ndarjes në histori.', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gabim gjatë gjenerimit të Librit Ndërtimor.', 'error');
    } finally {
      setLibriExportLoading(false);
    }
  };

  const handleDownloadLibriNdertimorZip = async () => {
    if (rows.length === 0) return;
    setZipExportLoading(true);
    try {
      const plan = activePlan;
      const layoutSaved = currentLibriExportId
        ? await persistLayoutNow(currentLibriExportId, previewMeta, rows, groupingMode, plan, manualPlan)
        : !supabase;
      const blob = await buildLibriNdertimorZip(rows, previewMeta, undefined, sectionTitleOverrides, plan);
      downloadBlob(blob, `${normalizeBaseName(fileName) || 'Paramasa'}-Libri-Ndertimor-faqet.zip`);
      showToast(`ZIP u shkarkua: ${plan.length} skedarë, një për çdo faqe.`, 'success');
      if (!layoutSaved && !currentLibriExportId && supabase) {
        showToast('ZIP u shkarkua, por Libri nuk ka identifikues për ruajtjen e ndarjes në histori.', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gabim gjatë gjenerimit të ZIP.', 'error');
    } finally {
      setZipExportLoading(false);
    }
  };

  const handleUpdateRow = (row: ParsedRow, changes: Partial<ParsedRow>) => {
    const updatedRow = { ...row, ...changes };
    const issues = (row.issues ?? []).filter((issue) => {
      if (issue === 'Mungon njësia matëse.') return !updatedRow.unit.trim();
      if (issue === 'Sasia është negative; kontrolloje para eksportit.') return updatedRow.quantity < 0;
      if (issue === 'Sasia është zero për një pozicion të numëruar; kontrolloje.') return updatedRow.quantity === 0;
      if (issue === 'Sasia është zero për një rresht të importuar; kontrolloje.') return updatedRow.quantity === 0;
      if (issue === 'Çmimi për njësi është negativ; kontrolloje para eksportit.') return updatedRow.unit_price < 0;
      if (issue.startsWith('Totali i deklaruar (')) {
        return changes.quantity === undefined && changes.unit_price === undefined && changes.total_price === undefined;
      }
      return true;
    });
    if (!updatedRow.unit.trim() && !issues.includes('Mungon njësia matëse.')) issues.push('Mungon njësia matëse.');
    if (updatedRow.quantity < 0 && !issues.includes('Sasia është negative; kontrolloje para eksportit.')) {
      issues.push('Sasia është negative; kontrolloje para eksportit.');
    }
    if (updatedRow.unit_price < 0 && !issues.includes('Çmimi për njësi është negativ; kontrolloje para eksportit.')) {
      issues.push('Çmimi për njësi është negativ; kontrolloje para eksportit.');
    }
    const updatedWithIssues = { ...updatedRow, issues };
    setRows((current) => current.map((r) => (r === row ? updatedWithIssues : r)));
    setManualPlan((current) => current?.map((page) => ({
      ...page,
      rows: page.rows.map((planRow) => (planRow === row ? updatedWithIssues : planRow)),
    })) ?? null);
  };

  const handleRedownloadHistory = async (record: LibriExportRecord) => {
    setHistoryActionId(record.id);
    try {
      const pageLayout = viewingHistoryId === record.id && historyGroupingMode === 'manual'
        ? historyManualPlan
        : restoreLibriExportPlan(record.pageLayout, record.rows);
      if (viewingHistoryId === record.id && historyGroupingMode === 'manual') {
        await persistLayoutNow(record.id, record.meta, record.rows, historyGroupingMode, historyManualPlan, historyManualPlan);
      }
      const buffer = await buildLibriNdertimorWorkbook(record.rows, record.meta, undefined, undefined, pageLayout ?? undefined);
      downloadWorkbookBuffer(buffer, `${normalizeBaseName(record.fileName) || 'Paramasa'}-Libri-Ndertimor.xlsx`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gabim gjatë rigjenerimit.', 'error');
    } finally {
      setHistoryActionId(null);
    }
  };

  const handleToggleHistoryPreview = async (record: LibriExportRecord) => {
    if (viewingHistoryId) {
      const openRecord = libriHistory.find((item) => item.id === viewingHistoryId);
      if (openRecord) {
        const saved = await persistLayoutNow(
          openRecord.id,
          openRecord.meta,
          openRecord.rows,
          historyGroupingMode,
          historyManualPlan,
          historyManualPlan
        );
        if (!saved) {
          const confirmed = window.confirm(
            'Ndryshimet e faqeve nuk u ruajtën. A dëshiron ta mbyllësh pamjen gjithsesi? Ndryshimet e paruajtura do të humbin.'
          );
          if (!confirmed) return;
        }
      }
      if (viewingHistoryId === record.id) {
        setViewingHistoryId(null);
        return;
      }
    }

    const savedPlan = restoreLibriExportPlan(record.pageLayout, record.rows);
    const savedManualPlan = restoreLibriExportPlan(record.manualPageLayout, record.rows) ?? savedPlan;
    setHistoryGroupingMode(savedPlan ? 'manual' : 'auto');
    setHistoryManualPlan(savedManualPlan);
    setViewingHistoryId(record.id);
  };

  const handleDeleteHistory = async (id: string) => {
    const record = libriHistory.find((item) => item.id === id);
    const confirmed = window.confirm(
      `A je i sigurt që dëshiron ta fshish librin "${record?.fileName || 'e zgjedhur'}"? Ky veprim nuk mund të zhbëhet.`
    );
    if (!confirmed) return;

    setHistoryActionId(id);
    try {
      await deleteLibriExportRecord(id);
      reloadLibriHistory();
    } finally {
      setHistoryActionId(null);
    }
  };

  const handleFinish = async () => {
    if (currentLibriExportId && rows.length > 0) {
      const saved = await persistLayoutNow(currentLibriExportId, previewMeta, rows, groupingMode, activePlan, manualPlan);
      if (!saved) return;
    }
    navigate('/');
  };

  const handleSaveCurrentLayout = async (): Promise<boolean> => {
    if (!currentLibriExportId) {
      showToast('Libri nuk ka identifikues për ruajtjen e faqeve në histori.', 'error');
      return false;
    }
    const saved = await persistLayoutNow(
      currentLibriExportId,
      previewMeta,
      rows,
      groupingMode,
      activePlan,
      manualPlan
    );
    if (saved) showSavedToast('Faqet u ruajtën në historikun e Librit.');
    return saved;
  };

  const handleSaveHistoryLayout = async (record: LibriExportRecord): Promise<boolean> => {
    const saved = await persistLayoutNow(
      record.id,
      record.meta,
      record.rows,
      historyGroupingMode,
      historyManualPlan,
      historyManualPlan
    );
    if (saved) showSavedToast('Faqet u ruajtën në historikun e Librit.');
    return saved;
  };

  return (
    <Shell>
      <div className="page-header">
        <h1>Libri Ndërtimor</h1>
        <p className="muted">Ngarko Excel-in, ose krijo faqet manualish duke zgjedhur shabllonin dhe duke plotësuar të dhënat.</p>
      </div>

      <div className="libri-workflow-card card">
        <div className="libri-workflow-head">
          <div>
            <span className="muted">Hapi tjetër</span>
            <strong>{rows.length > 0 ? workflowSteps[Math.min(importStepIndex, workflowSteps.length - 1)].title : 'Ngarko Excel'}</strong>
          </div>
          <span className="muted">{rows.length > 0 ? `Hapi ${Math.min(importStepIndex + 1, workflowSteps.length)}/4` : 'Hapi 1/4'}</span>
        </div>
        <div className="libri-workflow-steps" aria-label="Rrjedha e punës">
          {workflowSteps.map((step, index) => {
            const stepState = index < importStepIndex ? 'done' : index === importStepIndex ? 'active' : 'idle';
            return (
              <div key={step.title} className={`libri-workflow-step ${stepState}`}>
                <span className="libri-workflow-step-index">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <small>{step.hint}</small>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="import-main-tabs">
        <button
          type="button"
          className={`import-main-tab ${mainTab === 'excel' ? 'active' : ''}`}
          onClick={() => setMainTab('excel')}
        >
          Ngarko Excel
        </button>
        <button
          type="button"
          className={`import-main-tab ${mainTab === 'manual' ? 'active' : ''}`}
          onClick={() => setMainTab('manual')}
        >
          Krijo Faqe
        </button>
      </div>

      {mainTab === 'manual' && <ManualPageBuilder />}

      {mainTab === 'excel' && (
        <div className="excel-tab-content">
          <div className="panel import-panel">
            <div className="import-meta-panel">
              <div className="import-meta-panel-head">
                <div>
                  <span className="import-section-kicker">TË DHËNAT E DOKUMENTIT</span>
                  <h2>Metadata e paramasës</h2>
                </div>
                <span className="import-meta-edit-note"><Info size={15} /> Sugjerimet mund t’i verifikosh dhe ndryshosh para shkarkimit.</span>
              </div>
              {metadataSuggestionNotes && (
                <div className="import-meta-source-note">
                  <Info size={16} />
                  <p>
                    <strong>Burimi i sugjerimeve:</strong> Objekti — {metadataSuggestionNotes.objectSource}; kapitulli — {metadataSuggestionNotes.chapterSource}.
                    {' '}Të dhënat e nxjerra nga emri i skedarit duhen konfirmuar.
                  </p>
                </div>
              )}
              <div className="form-grid import-meta-grid">
                <label className="full-width-field">
                  Kryesi i punës
                  <input value={previewMeta.executorName} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, executorName: e.target.value }))} placeholder="p.sh. Megrant ING SH.P.K" />
                </label>
                <label>
                  Muaji
                  <input value={previewMeta.month} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, month: e.target.value }))} placeholder="p.sh. Korrik 2026" />
                </label>
                <label>
                  Data
                  <input value={previewMeta.date} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, date: e.target.value }))} placeholder="p.sh. 03.07.2026" />
                </label>
                <label className="full-width-field">
                  Objekti / emërtimi i projektit
                  <input value={previewMeta.objectName} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, objectName: e.target.value }))} placeholder="p.sh. Renovimi i dyshemesë në MIQ" />
                </label>
                <label>
                  Numri i kapitullit në paramasë
                  <input value={previewMeta.offerAccount} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, offerAccount: e.target.value }))} placeholder="p.sh. II" />
                </label>
                <label>
                  Pozicionet e ofertës
                  <input value={previewMeta.offerPositions} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, offerPositions: e.target.value }))} placeholder="p.sh. 1.1, 1.2" />
                </label>
                <label className="full-width-field">
                  Titulli i seksionit / kapitullit
                  <input value={previewMeta.sectionTitle} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, sectionTitle: e.target.value }))} placeholder="Shkruaj titullin e plotë të seksionit" />
                </label>
              </div>
            </div>

        <div className="import-controls">
          <label className="import-label-select">
            <span>Projekti <small>Opsionale</small></span>
            <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
              <option value="">-- Krijo Projekt të Ri --</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label className="import-label-input">
            <span>Skedari Excel <small>Kërkohet</small></span>
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={loading} className="import-file-input" />
            {fileName && <span className="import-selected-file"><FileSpreadsheet size={16} />{fileName}</span>}
          </label>
        </div>

        {rows.length > 0 && !loading && (
          <section className={`import-analysis-summary${hasTotalMismatch ? ' has-issues' : ''}`} aria-live="polite">
            <div className="import-analysis-heading">
              <span className={`import-analysis-icon${hasTotalMismatch ? ' is-warning' : ' is-success'}`}>
                {hasTotalMismatch ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
              </span>
              <div>
                <span className="import-section-kicker">REZULTATI I ANALIZËS</span>
                <h2>{hasTotalMismatch ? 'Importi kërkon verifikim' : 'Skedari u analizua'}</h2>
                <p>{hasTotalMismatch ? 'Krahaso totalet dhe shënimet me Excel-in origjinal para se të vazhdosh.' : 'Kontrollo sugjerimet dhe të dhënat e nxjerra para shkarkimit.'}</p>
              </div>
            </div>
            <div className="import-analysis-stats">
              <div><strong>{rows.length}</strong><span>Pozicione të lexuara</span></div>
              <div><strong>{detectedSections.length}</strong><span>Seksione të gjetura</span></div>
              {unpricedPositionCount > 0 && (
                <div className="is-neutral"><strong>{unpricedPositionCount}</strong><span>Pozicione pa çmim</span></div>
              )}
              {rowReviewIssues.length + importDiagnostics.length > 0 && (
                <div className="is-warning"><strong>{rowReviewIssues.length + importDiagnostics.length}</strong><span>Shënime për verifikim</span></div>
              )}
            </div>
            {hasTotalMismatch && declaredTotal !== null && (
              <div className="import-total-warning" role="alert">
                <AlertTriangle size={18} />
                <p>
                  <strong>Mospërputhje e totalit.</strong> Sipas skedarit: <strong>{declaredTotal.toLocaleString('sq-AL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong>;
                  sipas pozicioneve të lexuara: <strong>{computedImportTotal.toLocaleString('sq-AL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong>.
                  {' '}Kontrollo kolonat dhe totalin në dokumentin burimor.
                </p>
              </div>
            )}
          </section>
        )}

        {rows.length > 0 && !loading && (rowReviewIssues.length > 0 || importDiagnostics.length > 0) && (
          <section className="panel panel-top-gap import-review-panel" aria-live="polite">
            <div className="import-review-heading">
              <span className="import-analysis-icon is-warning"><AlertTriangle size={19} /></span>
              <div>
                <h3>Shënime për verifikim</h3>
                <p>{rowReviewIssues.length} shënime te pozicionet · {importDiagnostics.length} paralajmërime të fletës</p>
              </div>
            </div>
            <details className="import-review-details">
              <summary>Shfaq detajet dhe rreshtat burimorë</summary>
              <ul className="import-review-list">
                {rowReviewIssues.map((issue, index) => (
                  <li key={`row-${index}`}>
                    <span className="import-review-location">{issue.rowNumber ? `Rreshti ${issue.rowNumber}` : 'Pozicioni'}{issue.position !== '—' ? ` · Pozicioni ${issue.position}` : ''}</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
                {importDiagnostics.map((issue, index) => (
                  <li key={`sheet-${index}`}>
                    <span className="import-review-location">Fleta {issue.sheet_name}{issue.row_number ? ` · Rreshti ${issue.row_number}` : ''}</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        )}

        {rows.some((row) => row.source === 'libri') && (
          <div className="import-total-warning import-review-note">
            <strong>Shënim për Librin Ndërtimor:</strong> sasia për secilin pozicion merret nga shuma e kolonës A në matje;
            rezultatet A × B verifikohen veçmas. Çmimet nuk përfshihen në Librin burimor dhe duhen plotësuar/kombinuar veçmas.
            Kontrollo gjithmonë matjet kundrejt dokumentit origjinal.
          </div>
        )}

        {rows.length > 0 && !loading && detectedSections.length > 0 && (
          <section className="panel panel-top-gap import-sections-panel">
            <div className="import-sections-heading">
              <div>
                <span className="import-section-kicker">RISHIKIMI I STRUKTURËS</span>
                <h2>Kapitujt dhe seksionet</h2>
                <p>Kontrollo numrin dhe titullin e secilit kapitull. Ndryshimet ndikojnë në organizimin dhe faqosjen e Librit.</p>
              </div>
              <span className="import-sections-count">{detectedSections.length} seksione</span>
            </div>
            <div className="validation-section-list">
              {detectedSections.map((section) => {
                const value = sectionTitleOverrides[section.sectionKey] ?? section.sectionLabel;
                const parts = splitSectionTitle(value);
                const titleMissing = !parts.title;
                return (
                  <div key={section.sectionKey} className={`validation-section-row${titleMissing ? ' is-unverified' : ''}`}>
                    <div className="validation-section-count">
                      <strong>{section.rows.length}</strong>
                      <span>pozicione</span>
                    </div>
                    <label className="validation-section-number">
                      <span>Nr. i kapitullit</span>
                      <input
                        type="text"
                        value={parts.number}
                        aria-label={`Numri i kapitullit për ${section.sectionLabel}`}
                        placeholder="p.sh. II"
                        onChange={(e) => {
                          const nextNumber = e.target.value.trim();
                          const nextValue = [nextNumber, parts.title].filter(Boolean).join('. ');
                          setSectionTitleOverrides((current) => ({ ...current, [section.sectionKey]: nextValue }));
                        }}
                      />
                    </label>
                    <label className="validation-section-title">
                      <span>Titulli i kapitullit / seksionit</span>
                      <input
                        type="text"
                        value={parts.title}
                        aria-label={`Titulli i kapitullit për ${section.sectionLabel}`}
                        placeholder={titleMissing ? 'Titulli nuk u gjet — plotësoje nga Excel-i origjinal' : 'Titulli i kapitullit'}
                        onChange={(e) => {
                          const nextValue = [parts.number ? `${parts.number}.` : '', e.target.value.trim()].filter(Boolean).join(' ');
                          setSectionTitleOverrides((current) => ({ ...current, [section.sectionKey]: nextValue }));
                        }}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {rows.length > 0 && !loading && (
          <div className="import-preview-toolbar import-preview-head import-view-heading">
            <div>
              <span className="import-section-kicker">PARAQITJA NË LIBËR</span>
              <strong>Kontrollo pozicionet dhe faqosjen</strong>
            </div>
            <div className="view-switch">
              <button type="button" aria-pressed={previewMode === 'preview'} className={`filter-chip ${previewMode === 'preview' ? 'active' : ''}`} onClick={() => setPreviewMode('preview')}>
                Pamja e faqes
              </button>
              <button type="button" aria-pressed={previewMode === 'table'} className={`filter-chip ${previewMode === 'table' ? 'active' : ''}`} onClick={() => setPreviewMode('table')}>
                Tabela e të dhënave
              </button>
            </div>
          </div>
        )}

        {loading && <div className="muted import-status">Analizimi i të dhënave... prisni pak.</div>}

        {rows.length > 0 && !loading && (
          <div className="import-preview import-table-container">
            {previewMode === 'preview' ? (
              <>
                <div className="import-preview-head import-preview-toolbar">
                  <strong>U analizuan {rows.length} pozicione.</strong>
                  <span className="muted">Faqet paketohen automatikisht (auto) — motori i sigurt që s'i përzien seksionet.</span>
                </div>

                <ParamasaPreview
                  rows={rows}
                  meta={previewMeta}
                  sectionTitleOverrides={sectionTitleOverrides}
                  onUpdateRow={handleUpdateRow}
                  groupingMode={groupingMode}
                  onGroupingModeChange={handleGroupingModeChange}
                  manualPlan={manualPlan}
                  onManualPlanChange={setManualPlan}
                  onSaveLayout={handleSaveCurrentLayout}
                  onPlanError={(message) => showToast(message, 'error')}
                />
              </>
            ) : (
              <>
                <div className="import-preview-head import-preview-toolbar">
                  <strong>U analizuan {rows.length} pozicione.</strong>
                </div>

                <table className="import-table">
                  <thead>
                    <tr className="import-table-head-row">
                      <th className="import-table-cell">Poz.</th>
                      <th className="import-table-cell">Përshkrimi</th>
                      <th className="import-table-cell">Njësia</th>
                      <th className="import-table-cell">Sasia</th>
                      <th className="import-table-cell">Çmimi</th>
                      <th className="import-table-cell">Totali</th>
                      <th className="import-table-cell">Statusi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((row, index) => (
                      <tr key={`${row.position_number}-${index}`} className="import-table-body-row">
                        <td className="import-table-cell">{row.position_number}</td>
                        <td className="import-table-cell">{row.description}</td>
                        <td className="import-table-cell">{row.unit}</td>
                        <td className="import-table-cell">{row.quantity}</td>
                        <td className="import-table-cell">{Number(row.unit_price).toLocaleString('sq-AL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                        <td className="import-table-cell col-bold">{Number(row.total_price).toLocaleString('sq-AL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                        <td className="import-table-cell">
                          {(row.issues ?? []).some((issue) => issue !== LIBRI_PRICE_NOTE) ? (
                            <span className="import-row-status is-warning"><AlertTriangle size={14} /> Verifiko</span>
                          ) : row.source !== 'libri' && row.quantity > 0 && row.unit_price === 0 ? (
                            <span className="import-row-status is-neutral"><Info size={14} /> Pa çmim</span>
                          ) : (
                            <span className="import-row-status is-success"><CheckCircle2 size={14} /> Në rregull</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {rows.length > 20 && <div className="muted import-table-more">Po shfaqen 20 nga {rows.length} pozicionet. Përdor pamjen e faqes për të kontrolluar dokumentin e plotë.</div>}
              </>
            )}

            <div className="import-actions">
              <button className="card import-cancel-btn" type="button" onClick={handlePrint} disabled={loading || rows.length === 0}>Print</button>
              <button className="card import-cancel-btn" type="button" onClick={handleDownloadLibriNdertimor} disabled={loading || libriExportLoading || rows.length === 0}>
                {libriExportLoading ? 'Duke gjeneruar…' : 'Shkarko Libër Ndërtimor (.xlsx origjinal)'}
              </button>
              <button className="card import-cancel-btn" type="button" onClick={handleDownloadLibriNdertimorZip} disabled={loading || zipExportLoading || rows.length === 0}>
                {zipExportLoading ? 'Duke gjeneruar…' : 'Shkarko çdo faqe veç e veç (.zip)'}
              </button>
              <button className="card import-cancel-btn" type="button" onClick={handleCancelImport} disabled={loading}>Anulo</button>
              <button
                className="primary-button import-finish-btn"
                type="button"
                onClick={handleFinish}
                disabled={loading || rows.length === 0 || libriExportLoading || zipExportLoading}
              >
                <Check size={16} />
                Përfundo
              </button>
            </div>
          </div>
        )}

        {libriHistory.length > 0 && (
          <section className="panel panel-top-gap">
            <h3 className="panel-heading-accent">Librat Ndërtimor të ruajtur</h3>
            <p className="muted">Çdo paramasë e analizuar ruhet automatikisht këtu — mund ta rishkarkosh më vonë pa e ringarkuar skedarin origjinal.</p>
            <div className="libri-history-list">
              {visibleLibriHistory.map((record) => (
                <div key={record.id} className="libri-history-row">
                  <div className="libri-history-info">
                    <strong>{record.fileName}</strong>
                    <span className="muted">
                      {new Date(record.createdAt).toLocaleDateString('sq-AL')} · {record.positionsCount} pozicione ·{' '}
                      {record.totalValue.toLocaleString('sq-AL', { maximumFractionDigits: 0 })}€
                    </span>
                  </div>
                  <div className="form-actions-row">
                    <button
                      type="button"
                      className="card libri-history-action-btn"
                      onClick={() => handleToggleHistoryPreview(record)}
                    >
                      <Eye size={15} />
                      {viewingHistoryId === record.id ? 'Mbyll pamjen' : 'Shiko'}
                    </button>
                    <button
                      type="button"
                      className="card libri-history-action-btn"
                      onClick={() => handleRedownloadHistory(record)}
                      disabled={historyActionId === record.id}
                    >
                      <Download size={15} />
                      {historyActionId === record.id ? 'Duke u gjeneruar…' : 'Shkarko përsëri'}
                    </button>
                    <button
                      type="button"
                      className="card import-cancel-btn libri-history-action-btn danger-action-btn"
                      onClick={() => handleDeleteHistory(record.id)}
                      disabled={historyActionId === record.id}
                    >
                      <Trash2 size={15} />
                      Fshi
                    </button>
                  </div>

                  {viewingHistoryId === record.id && (
                    <div className="libri-history-preview">
                      <ParamasaPreview
                        rows={record.rows}
                        meta={record.meta}
                        groupingMode={historyGroupingMode}
                        onGroupingModeChange={(mode) => {
                          setHistoryGroupingMode(mode);
                          if (mode === 'manual' && !historyManualPlan) {
                            setHistoryManualPlan(planLibriExport(record.rows));
                          }
                        }}
                        manualPlan={historyManualPlan}
                        onManualPlanChange={setHistoryManualPlan}
                        onSaveLayout={() => handleSaveHistoryLayout(record)}
                        onPlanError={(message) => showToast(message, 'error')}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {libriHistoryPageCount > 1 && (
              <div className="libri-history-pagination" aria-label="Faqet e librave të ruajtur">
                <button
                  type="button"
                  className="card libri-history-page-btn"
                  onClick={() => setLibriHistoryPage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={libriHistoryPage === 1}
                  aria-label="Faqja e mëparshme"
                >
                  <ChevronLeft size={16} />
                  Para
                </button>
                <span className="libri-history-page-status">
                  Faqja {libriHistoryPage} / {libriHistoryPageCount}
                </span>
                <button
                  type="button"
                  className="card libri-history-page-btn"
                  onClick={() => setLibriHistoryPage((currentPage) => Math.min(libriHistoryPageCount, currentPage + 1))}
                  disabled={libriHistoryPage === libriHistoryPageCount}
                  aria-label="Faqja tjetër"
                >
                  Pas
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </section>
        )}
      </div>
        </div>
      )}

    </Shell>
  );
}