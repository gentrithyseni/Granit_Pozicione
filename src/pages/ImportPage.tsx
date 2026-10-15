import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Download, Eye, Trash2 } from 'lucide-react';
import { ParamasaPreview, type ParamasaPreviewMeta, type PageGroupingMode } from '../components/ParamasaPreview';
import { ManualPageBuilder } from '../components/ManualPageBuilder';
import { Shell } from '../components/Shell';
import { useToast } from '../context/ToastContext';
import { parseExcelWithValidation, type ParsedRow } from '../lib/excel';
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

function extractPrimarySection(rows: ParsedRow[]): string {
  const firstPosition = rows.find((row) => row.position_number)?.position_number || '';
  return firstPosition ? firstPosition.split('.')[0].trim() : '';
}

function suggestPreviewMeta(rows: ParsedRow[], fileName: string, projectName: string): ParamasaPreviewMeta {
  const baseName = normalizeBaseName(fileName);
  const positions = rows.map((row) => row.position_number).filter(Boolean).slice(0, 8);
  const objectName = projectName || toTitleCase(baseName || 'Paramasa');
  const primarySection = extractPrimarySection(rows);
  const sectionLabel = primarySection ? `${primarySection}.` : 'Paramasa';

  return {
    executorName: projectName || toTitleCase(baseName.split(' ').slice(0, 3).join(' ') || 'Kryesi i punes'),
    month: new Date().toLocaleDateString('sq-AL', { month: 'long', year: 'numeric' }),
    date: new Date().toLocaleDateString('sq-AL'),
    objectName,
    offerAccount: baseName ? `No ${baseName}` : 'No —',
    offerPositions: positions.length > 0 ? positions.join(', ') : '—',
    sectionTitle: primarySection ? `${sectionLabel} ${baseName || 'Paramasa'}` : (baseName ? `Paramasa / ${baseName}` : 'Paramasa'),
  };
}

function mergeBlankFields(current: ParamasaPreviewMeta, suggested: ParamasaPreviewMeta): ParamasaPreviewMeta {
  return {
    executorName: current.executorName || suggested.executorName,
    month: current.month || suggested.month,
    date: current.date || suggested.date,
    objectName: current.objectName || suggested.objectName,
    offerAccount: current.offerAccount || suggested.offerAccount,
    offerPositions: current.offerPositions || suggested.offerPositions,
    sectionTitle: current.sectionTitle || suggested.sectionTitle,
  };
}

export function ImportPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [declaredTotal, setDeclaredTotal] = useState<number | null>(null);
  const [sectionTitleOverrides, setSectionTitleOverrides] = useState<Record<string, string>>({});
  const [groupingMode, setGroupingMode] = useState<PageGroupingMode>('auto');
  const [manualPlan, setManualPlan] = useState<LibriExportPlanPage[] | null>(null);
  const [currentLibriExportId, setCurrentLibriExportId] = useState<string | null>(null);

  const detectedSections = useMemo(() => groupRowsBySection(rows), [rows]);
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
    executorName: 'Megrant ING SH.P.K',
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
  const { showToast } = useToast();
  const layoutSaveQueue = useRef<Promise<void>>(Promise.resolve());

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
    const storedPlan = currentMode === 'manual' && currentPlan
      ? serializeLibriExportPlan(currentPlan, sourceRows)
      : null;
    const persistedRecord = libriHistory.find((record) => record.id === targetId);

    if (currentMode === 'manual' && currentPlan && !storedPlan) {
      showToast('Ndarja e faqeve nuk u ruajt sepse disa pozicione mungojnë ose janë të përsëritura.', 'error');
      return;
    }
    if (persistedRecord && JSON.stringify(persistedRecord.pageLayout) === JSON.stringify(storedPlan)) return;

    let active = true;
    const timeoutId = window.setTimeout(() => {
      const saveOperation = layoutSaveQueue.current
        .then(() => saveLibriExportPageLayout(targetId, meta, storedPlan))
        .then(() => {
          if (!active) return;
          setLibriHistory((current) => {
            const record = current.find((item) => item.id === targetId);
            if (!record || JSON.stringify(record.pageLayout) === JSON.stringify(storedPlan)) return current;
            return current.map((item) => item.id === targetId ? { ...item, pageLayout: storedPlan } : item);
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
    plan: LibriExportPlanPage[] | null
  ): Promise<boolean> => {
    const storedPlan = mode === 'manual' && plan
      ? serializeLibriExportPlan(plan, sourceRows)
      : null;
    if (mode === 'manual' && plan && !storedPlan) {
      showToast('Ndarja e faqeve nuk u ruajt sepse disa pozicione mungojnë ose janë të përsëritura.', 'error');
      return false;
    }
    const persistedRecord = libriHistory.find((record) => record.id === id);
    if (persistedRecord && JSON.stringify(persistedRecord.pageLayout) === JSON.stringify(storedPlan)) return true;

    const saveOperation = layoutSaveQueue.current.then(() => saveLibriExportPageLayout(id, meta, storedPlan));
    layoutSaveQueue.current = saveOperation.catch(() => undefined);
    try {
      await saveOperation;
      setLibriHistory((current) => {
        const record = current.find((item) => item.id === id);
        if (!record || JSON.stringify(record.pageLayout) === JSON.stringify(storedPlan)) return current;
        return current.map((item) => item.id === id ? { ...item, pageLayout: storedPlan } : item);
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
      objectName: current.objectName || selectedProject.name,
    }));
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
    setSectionTitleOverrides({});
    try {
      const { rows: parsedRows, declaredTotal: fileTotal } = await parseExcelWithValidation(file);
      if (parsedRows.length === 0) {
        setFileName('');
        event.target.value = '';
        showToast('Nuk u gjet asnjë pozicion në këtë Excel. Kontrollo që skedari të ketë kolonat e pozicionit, përshkrimit, sasisë dhe çmimit.', 'error');
        return;
      }
      setRows(parsedRows);
      setDeclaredTotal(fileTotal);
      const selectedProject = projects.find((project) => project.id === selectedProjectId);
      const suggested = suggestPreviewMeta(parsedRows, file.name, selectedProject?.name || '');
      const mergedMeta = mergeBlankFields(previewMeta, suggested);
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
    } catch {
      showToast('Gabim gjatë leximit të Excel-it.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    setManualPlan(null);
    setGroupingMode('auto');
  }, [rows]);

  const handleGroupingModeChange = (mode: PageGroupingMode) => {
    setGroupingMode(mode);
    if (mode === 'manual') {
      setManualPlan(autoPlan);
    } else {
      setManualPlan(null);
    }
  };

  const handleDownloadLibriNdertimor = async () => {
    if (rows.length === 0) return;
    setLibriExportLoading(true);
    try {
      const plan = activePlan;
      const layoutSaved = currentLibriExportId
        ? await persistLayoutNow(currentLibriExportId, previewMeta, rows, groupingMode, plan)
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
        ? await persistLayoutNow(currentLibriExportId, previewMeta, rows, groupingMode, plan)
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
    setRows((current) => current.map((r) => (r === row ? updatedRow : r)));
    setManualPlan((current) => current?.map((page) => ({
      ...page,
      rows: page.rows.map((planRow) => (planRow === row ? updatedRow : planRow)),
    })) ?? null);
  };

  const handleRedownloadHistory = async (record: LibriExportRecord) => {
    setHistoryActionId(record.id);
    try {
      const pageLayout = viewingHistoryId === record.id && historyGroupingMode === 'manual'
        ? historyManualPlan
        : restoreLibriExportPlan(record.pageLayout, record.rows);
      if (viewingHistoryId === record.id && historyGroupingMode === 'manual') {
        await persistLayoutNow(record.id, record.meta, record.rows, historyGroupingMode, historyManualPlan);
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
          historyManualPlan
        );
        if (!saved) return;
      }
      if (viewingHistoryId === record.id) {
        setViewingHistoryId(null);
        return;
      }
    }

    const savedPlan = restoreLibriExportPlan(record.pageLayout, record.rows);
    setHistoryGroupingMode(savedPlan ? 'manual' : 'auto');
    setHistoryManualPlan(savedPlan);
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
      const saved = await persistLayoutNow(currentLibriExportId, previewMeta, rows, groupingMode, activePlan);
      if (!saved) return;
    }
    navigate('/');
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
            <strong>Metadata e paramasës</strong>
            <span className="muted">Sugjerohen automatikisht nga sistemi, pastaj mund t'i ndryshosh manualisht.</span>
          </div>
          <div className="form-grid import-meta-grid">
            <label className="full-width-field">
              Kryesi i punes
              <input value={previewMeta.executorName} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, executorName: e.target.value }))} placeholder="p.sh. Megrant ING SH.P.K" />
            </label>
            <label>
              Muaji
              <input value={previewMeta.month} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, month: e.target.value }))} placeholder="p.sh. Korrik 2026" />
            </label>
            <label>
              Data
              <input value={previewMeta.date} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, date: e.target.value }))} placeholder="03.07.2026" />
            </label>
            <label className="full-width-field">
              Objekti
              <input value={previewMeta.objectName} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, objectName: e.target.value }))} placeholder="p.sh Renovimi i dyshemesë në MIQ" />
            </label>
            <label>
              Numri i kapitullit ne paramase
              <input value={previewMeta.offerAccount} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, offerAccount: e.target.value }))} placeholder="p.sh I ose II" />
            </label>
            <label>
              Pozicioni me oferte
              <input value={previewMeta.offerPositions} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, offerPositions: e.target.value }))} placeholder="p.sh 1.1, 1.2" />
            </label>
            <label className="full-width-field">
              Titulli i seksionit-kapitullit
              <input value={previewMeta.sectionTitle} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, sectionTitle: e.target.value }))} placeholder="p.sh I. Punimet përgatitore" />
            </label>
          </div>
        </div>

        <div className="import-controls">
          <label className="import-label-select">
            Zgjidh Projektin (opsional)
            <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
              <option value="">-- Krijo Projekt të Ri --</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label className="import-label-input">
            Zgjidh Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={loading} className="import-file-input" />
          </label>
        </div>

        {rows.length > 0 && !loading && declaredTotal !== null && (() => {
          const computedTotal = rows.reduce((sum, row) => sum + (Number(row.total_price) || 0), 0);
          const mismatch = Math.abs(declaredTotal - computedTotal) > Math.max(1, declaredTotal * 0.005);
          if (!mismatch) return null;
          return (
            <div className="import-total-warning">
              ⚠ <strong>Kujdes:</strong> skedari vetë thotë totali është <strong>{declaredTotal.toFixed(2)}€</strong>, por sistemi llogariti{' '}
              <strong>{computedTotal.toFixed(2)}€</strong> — kontrollo Tabelën, diçka mund të mungojë ose të jetë lexuar gabim.
            </div>
          );
        })()}

        {rows.length > 0 && !loading && detectedSections.length > 0 && (
          <section className="panel panel-top-gap">
            <h3 className="panel-title">Paneli i Validimit — kontrollo titujt e seksioneve</h3>
            <p className="muted field-hint">
              Kontrollo titujt e mëposhtëm para se të krijohen faqet e Librit — nëse ndonjë del bosh ose gabim (p.sh. "3." në vend të
              "3. Punët e Ujit"), redaktoje këtu; ndryshimi zbatohet automatikisht te Preview dhe te çdo shkarkim.
            </p>
            <div className="validation-section-list">
              {detectedSections.map((section) => (
                <label key={section.sectionKey} className="validation-section-row">
                  <span className="muted">{section.rows.length} poz.</span>
                  <input
                    type="text"
                    value={sectionTitleOverrides[section.sectionKey] ?? section.sectionLabel}
                    onChange={(e) =>
                      setSectionTitleOverrides((current) => ({ ...current, [section.sectionKey]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
          </section>
        )}

        {rows.length > 0 && !loading && (
          <div className="import-preview-toolbar import-preview-head">
            <strong>Preview i paramasës</strong>
            <div className="view-switch">
              <button type="button" className={`filter-chip ${previewMode === 'preview' ? 'active' : ''}`} onClick={() => setPreviewMode('preview')}>
                Preview
              </button>
              <button type="button" className={`filter-chip ${previewMode === 'table' ? 'active' : ''}`} onClick={() => setPreviewMode('table')}>
                Tabelë
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
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((row, index) => (
                      <tr key={`${row.position_number}-${index}`} className="import-table-body-row">
                        <td className="import-table-cell">{row.position_number}</td>
                        <td className="import-table-cell">{row.description}</td>
                        <td className="import-table-cell">{row.unit}</td>
                        <td className="import-table-cell">{row.quantity}</td>
                        <td className="import-table-cell">{Number(row.unit_price).toFixed(2)}€</td>
                        <td className="import-table-cell col-bold">{Number(row.total_price).toFixed(2)}€</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {rows.length > 20 && <div className="muted import-table-more">...dhe {rows.length - 20} rreshta të tjerë.</div>}
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
              <button className="card import-cancel-btn" type="button" onClick={() => setRows([])} disabled={loading}>Anulo</button>
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
                        onGroupingModeChange={setHistoryGroupingMode}
                        manualPlan={historyManualPlan}
                        onManualPlanChange={setHistoryManualPlan}
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