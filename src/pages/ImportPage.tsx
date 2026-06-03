import { useEffect, useRef, useState } from 'react';
import { Shell } from '../components/Shell';
import { LibriPagePreview } from '../components/LibriPagePreview';
import { useToast } from '../context/ToastContext';
import { parseExcel, type ParsedRow } from '../lib/excel';
import { createLibriExport } from '../lib/libriExport';
import type { LibriPreviewMeta } from '../lib/libriPages';
import { supabase } from '../lib/supabase';
import type { DbProject } from '../types/database';

export function ImportPage() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [bookMeta, setBookMeta] = useState({
    title: 'Paramasa për librin ndërtimor',
    company: '',
    organ: '',
    documentNumber: '',
    romanNumber: '',
    date: new Date().toLocaleDateString('sq-AL'),
    footerLeft: 'Përgatiti',
    footerMiddle: 'Kontrolloi',
    footerRight: 'Miratoi',
  });
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [savedImport, setSavedImport] = useState<{ projectId: string; itemIds: string[]; projectCreated: boolean; historyId?: string } | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'pages'>('pages');
  const [exportBusy, setExportBusy] = useState(false);
  const undoTimer = useRef<number | null>(null);
  const { showToast } = useToast();

  const exportMeta: LibriPreviewMeta = bookMeta;

  useEffect(() => {
    if (!supabase) return;
    supabase.from('projects').select('*').order('created_at', { ascending: false }).then(({ data }) => data && setProjects(data));
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setFileName(file.name);
    setRows([]);
    try {
      setRows(await parseExcel(file));
    } catch {
      showToast('Gabim gjatë leximit të Excel-it', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!supabase) return showToast('Supabase nuk është i lidhur', 'error');
    if (rows.length === 0) return showToast('Nuk ka të dhëna për t\'u importuar', 'error');
    setLoading(true);
    try {
      let projectId = selectedProjectId;
      let projectCreated = false;
      if (!projectId) {
        const projectName = `${fileName.replace(/\.[^/.]+$/, '') || 'Import'} - ${new Date().toLocaleDateString()}`;
        const { data, error } = await supabase.from('projects').insert([{ name: projectName }]).select().single();
        if (error) throw error;
        projectId = data.id;
        projectCreated = true;
      }

      const { data, error } = await supabase.from('project_items').insert(
        rows.map((row) => ({
          project_id: projectId,
          position_number: row.position_number,
          description: row.description,
          unit: row.unit,
          quantity: row.quantity,
          unit_price: row.unit_price,
          total_price: row.total_price,
        }))
      ).select();
      if (error) throw error;

      const itemIds = (data || []).map((item) => item.id).filter(Boolean);
      const { data: history } = await supabase.from('import_history').insert([{ project_id: projectId, file_name: fileName, item_ids: itemIds }]).select().single();
      setSavedImport({ projectId, itemIds, projectCreated, historyId: history?.id });
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setSavedImport(null), 10000);
      setRows([]);
      showToast('Importimi u përfundua me sukses.', 'success');
    } catch (err: unknown) {
      showToast(`Gabim gjatë ruajtjes: ${err instanceof Error ? err.message : 'Gabim'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!supabase || !savedImport) return;
    setLoading(true);
    try {
      if (savedImport.itemIds.length > 0) await supabase.from('project_items').delete().in('id', savedImport.itemIds);
      if (savedImport.projectCreated) await supabase.from('projects').delete().eq('id', savedImport.projectId);
      if (savedImport.historyId) await supabase.from('import_history').update({ undone: true }).eq('id', savedImport.historyId);
      setSavedImport(null);
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      showToast('Importi u rikthye me sukses.', 'success');
    } catch (err: unknown) {
      showToast(`Gabim gjatë undo: ${err instanceof Error ? err.message : 'Gabim'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadText = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const handleExportPages = () => {
    if (rows.length === 0) {
      showToast('Nuk ka faqe për t’u eksportuar', 'error');
      return;
    }

    setExportBusy(true);
    try {
      const exportData = createLibriExport(rows, exportMeta);
      const baseName = (fileName || 'libri-pages').replace(/\.[^/.]+$/, '');
      downloadText(exportData.html, `${baseName}-pages.html`, 'text/html;charset=utf-8');
      downloadText(exportData.json, `${baseName}-pages.json`, 'application/json;charset=utf-8');
      showToast(`Faqet u eksportuan (${exportData.pageCount} faqe).`, 'success');
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <Shell>
      <div className="page-header">
        <h1>Ngarko Excel</h1>
        <p className="muted">Shiko paraprakisht si faqe libri, pastaj aprovo importin.</p>
      </div>

      <div className="panel import-panel">
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

        <div className="import-meta-panel">
          <div className="import-meta-panel-head">
            <strong>Metadata e faqes</strong>
            <span className="muted">Këto fusha shfaqen në pamjen e printueshme A4.</span>
          </div>
          <div className="form-grid import-meta-grid">
            <label className="full-width-field">
              Titulli
              <input value={bookMeta.title} onChange={(e) => setBookMeta((meta) => ({ ...meta, title: e.target.value }))} />
            </label>
            <label>
              Kompania
              <input value={bookMeta.company} onChange={(e) => setBookMeta((meta) => ({ ...meta, company: e.target.value }))} placeholder="p.sh. Kompania ABC" />
            </label>
            <label>
              Organi
              <input value={bookMeta.organ} onChange={(e) => setBookMeta((meta) => ({ ...meta, organ: e.target.value }))} placeholder="p.sh. Organi mbikëqyrës" />
            </label>
            <label>
              Nr. dokumentit
              <input value={bookMeta.documentNumber} onChange={(e) => setBookMeta((meta) => ({ ...meta, documentNumber: e.target.value }))} placeholder="p.sh. 01/2026" />
            </label>
            <label>
              Nr. romak
              <input value={bookMeta.romanNumber} onChange={(e) => setBookMeta((meta) => ({ ...meta, romanNumber: e.target.value }))} placeholder="p.sh. IV" />
            </label>
            <label>
              Data
              <input value={bookMeta.date} onChange={(e) => setBookMeta((meta) => ({ ...meta, date: e.target.value }))} placeholder="28.05.2026" />
            </label>
            <label>
              Nënshkrimi majtas
              <input value={bookMeta.footerLeft} onChange={(e) => setBookMeta((meta) => ({ ...meta, footerLeft: e.target.value }))} />
            </label>
            <label>
              Nënshkrimi në mes
              <input value={bookMeta.footerMiddle} onChange={(e) => setBookMeta((meta) => ({ ...meta, footerMiddle: e.target.value }))} />
            </label>
            <label>
              Nënshkrimi djathtas
              <input value={bookMeta.footerRight} onChange={(e) => setBookMeta((meta) => ({ ...meta, footerRight: e.target.value }))} />
            </label>
          </div>
        </div>

        {loading && <div className="muted import-status">Analizimi i të dhënave... prisni pak.</div>}

        {rows.length > 0 && !loading && (
          <div className="import-preview import-table-container">
            <div className="import-preview-head import-preview-toolbar">
              <strong>U analizuan {rows.length} pozicione.</strong>
              <div className="view-switch">
                <button type="button" className={`filter-chip ${viewMode === 'pages' ? 'active' : ''}`} onClick={() => setViewMode('pages')}>
                  Faqe
                </button>
                <button type="button" className={`filter-chip ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>
                  Tabelë
                </button>
              </div>
            </div>

            {viewMode === 'pages' ? (
              <LibriPagePreview rows={rows} meta={bookMeta} />
            ) : (
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
            )}

            {viewMode === 'table' && rows.length > 20 && <div className="muted import-table-more">...dhe {rows.length - 20} rreshta të tjerë.</div>}
            <div className="import-actions">
              <button className="primary-button import-save-btn" type="button" onClick={handleSave} disabled={loading}>Aprovo dhe Shto Pozicionet</button>
              <button className="card import-cancel-btn" type="button" onClick={handleExportPages} disabled={loading || exportBusy || rows.length === 0}>Eksporto faqet</button>
              <button className="card import-cancel-btn" type="button" onClick={() => setRows([])} disabled={loading}>Anulo</button>
            </div>
          </div>
        )}

        {savedImport && (
          <div className="import-undo-toast">
            <span>Importi u ruajt. </span>
            <button className="link-button" type="button" onClick={handleUndo} disabled={loading}>Undo</button>
            <button className="link-button" type="button" onClick={() => setSavedImport(null)}>Mbyll</button>
          </div>
        )}
      </div>
    </Shell>
  );
}
