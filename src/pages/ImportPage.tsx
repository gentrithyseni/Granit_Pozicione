import { useEffect, useState, type ChangeEvent } from 'react';
import { ParamasaPreview, type ParamasaPreviewMeta } from '../components/ParamasaPreview';
import { Shell } from '../components/Shell';
import { useToast } from '../context/ToastContext';
import { parseExcelWithValidation, type ParsedRow } from '../lib/excel';
import { buildLibriNdertimorWorkbook, buildLibriNdertimorZip, downloadWorkbookBuffer, downloadBlob, planLibriExport } from '../lib/libriExport';
import { saveLibriExportRecord, fetchLibriExportRecords, deleteLibriExportRecord, type LibriExportRecord } from '../services/libriExports';
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
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [declaredTotal, setDeclaredTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [previewMode, setPreviewMode] = useState<'table' | 'preview'>('preview');
  const [libriExportLoading, setLibriExportLoading] = useState(false);
  const [zipExportLoading, setZipExportLoading] = useState(false);
  const [previewMeta, setPreviewMeta] = useState<ParamasaPreviewMeta>({
    executorName: '',
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
  const [historyActionId, setHistoryActionId] = useState<string | null>(null);
  const { showToast } = useToast();

  const reloadLibriHistory = () => {
    fetchLibriExportRecords().then(setLibriHistory);
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.from('projects').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setProjects(data));
    reloadLibriHistory();
  }, []);

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
    setFileName(file.name);
    setRows([]);
    setDeclaredTotal(null);
    try {
      const { rows: parsedRows, declaredTotal: fileTotal } = await parseExcelWithValidation(file);
      setRows(parsedRows);
      setDeclaredTotal(fileTotal);
      const selectedProject = projects.find((project) => project.id === selectedProjectId);
      const suggested = suggestPreviewMeta(parsedRows, file.name, selectedProject?.name || '');
      setPreviewMeta((current) => mergeBlankFields(current, suggested));

      const computedTotal = parsedRows.reduce((sum, row) => sum + (Number(row.total_price) || 0), 0);
      if (fileTotal !== null && Math.abs(fileTotal - computedTotal) > Math.max(1, fileTotal * 0.005)) {
        showToast(
          `⚠ Kujdes: skedari thotë totali është ${fileTotal.toFixed(2)}€, por sistemi llogariti ${computedTotal.toFixed(2)}€ — diçka mund të mungojë.`,
          'error'
        );
      }

      if (parsedRows.length > 0) {
        const mergedMeta = mergeBlankFields(previewMeta, suggested);
        await saveLibriExportRecord(file.name, parsedRows, mergedMeta);
        reloadLibriHistory();
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

  const handleDownloadLibriNdertimor = async () => {
    if (rows.length === 0) return;
    setLibriExportLoading(true);
    try {
      const plan = planLibriExport(rows);
      const buffer = await buildLibriNdertimorWorkbook(rows, previewMeta);
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
      const plan = planLibriExport(rows);
      const blob = await buildLibriNdertimorZip(rows, previewMeta);
      downloadBlob(blob, `${normalizeBaseName(fileName) || 'Paramasa'}-Libri-Ndertimor-faqet.zip`);
      showToast(`ZIP u shkarkua: ${plan.length} skedarë, një për çdo faqe.`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gabim gjatë gjenerimit të ZIP.', 'error');
    } finally {
      setZipExportLoading(false);
    }
  };

  const handleAutoSuggestMeta = () => {
    const selectedProject = projects.find((project) => project.id === selectedProjectId);
    setPreviewMeta(suggestPreviewMeta(rows, fileName, selectedProject?.name || ''));
  };

  const handleRedownloadHistory = async (record: LibriExportRecord) => {
    setHistoryActionId(record.id);
    try {
      const buffer = await buildLibriNdertimorWorkbook(record.rows, record.meta);
      downloadWorkbookBuffer(buffer, `${normalizeBaseName(record.fileName) || 'Paramasa'}-Libri-Ndertimor.xlsx`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gabim gjatë rigjenerimit.', 'error');
    } finally {
      setHistoryActionId(null);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    setHistoryActionId(id);
    try {
      await deleteLibriExportRecord(id);
      reloadLibriHistory();
    } finally {
      setHistoryActionId(null);
    }
  };

  const handlePageStartSuggestion = () => {
    const selectedProject = projects.find((project) => project.id === selectedProjectId);
    setPreviewMeta((meta) => ({
      ...suggestPreviewMeta(rows, fileName, selectedProject?.name || ''),
      sectionTitle: meta.sectionTitle || suggestPreviewMeta(rows, fileName, selectedProject?.name || '').sectionTitle,
    }));
  };

  return (
    <Shell>
      <div className="page-header">
        <h1>Ngarko Excel</h1>
        <p className="muted">Ngarko Excel-in, lejo sugjerimin automatik të metadata-s, dhe kalo nga preview në final për pamjen e plotë.</p>
      </div>

      <div className="panel import-panel">
        <div className="import-meta-panel">
          <div className="import-meta-panel-head">
            <strong>Metadata e paramasës</strong>
            <span className="muted">Sugjerohen automatikisht nga sistemi, pastaj mund t'i ndryshosh manualisht.</span>
          </div>
          <div className="form-grid import-meta-grid">
            <label className="full-width-field">
              Kryesi i punes
              <input value={previewMeta.executorName} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, executorName: e.target.value }))} placeholder="p.sh. Graniti SH.P.K." />
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
              <input value={previewMeta.objectName} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, objectName: e.target.value }))} placeholder="p.sh. Renovimi i dyshemesë në MIQ" />
            </label>
            <label>
              Llogaria me oferte
              <input value={previewMeta.offerAccount} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, offerAccount: e.target.value }))} placeholder="p.sh. No 01/2026" />
            </label>
            <label>
              Pozicioni me oferte
              <input value={previewMeta.offerPositions} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, offerPositions: e.target.value }))} placeholder="p.sh. 1.1, 1.2" />
            </label>
            <label className="full-width-field">
              Titulli i seksionit
              <input value={previewMeta.sectionTitle} onChange={(e) => setPreviewMeta((meta) => ({ ...meta, sectionTitle: e.target.value }))} placeholder="p.sh. I. Punimet përgatitore" />
            </label>
          </div>
          <div className="import-meta-actions">
            <button type="button" className="card" onClick={handleAutoSuggestMeta} disabled={loading || rows.length === 0}>
              Sugjero automatikisht
            </button>
            <button type="button" className="card" onClick={handlePageStartSuggestion} disabled={loading || rows.length === 0}>
              Sugjero fillimin e faqes
            </button>
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

                <ParamasaPreview rows={rows} meta={previewMeta} />
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
            </div>
          </div>
        )}

        {libriHistory.length > 0 && (
          <section className="panel panel-top-gap">
            <h3 className="panel-heading-accent">Librat Ndërtimor të ruajtur</h3>
            <p className="muted">Çdo paramasë e analizuar ruhet automatikisht këtu — mund ta rishkarkosh më vonë pa e ringarkuar skedarin origjinal.</p>
            <div className="libri-history-list">
              {libriHistory.map((record) => (
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
                      className="card"
                      onClick={() => handleRedownloadHistory(record)}
                      disabled={historyActionId === record.id}
                    >
                      {historyActionId === record.id ? 'Duke u gjeneruar…' : 'Shkarko përsëri'}
                    </button>
                    <button
                      type="button"
                      className="card import-cancel-btn"
                      onClick={() => handleDeleteHistory(record.id)}
                      disabled={historyActionId === record.id}
                    >
                      Fshi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Shell>
  );
}