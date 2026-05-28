import { useEffect, useRef, useState } from 'react';
import { Shell } from '../components/Shell';
import { useToast } from '../context/ToastContext';
import { parseExcel, type ParsedRow } from '../lib/excel';
import { supabase } from '../lib/supabase';
import type { DbProject } from '../types/database';

export function ImportPage() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [savedImport, setSavedImport] = useState<{ projectId: string; itemIds: string[]; projectCreated: boolean; historyId?: string } | null>(null);
  const undoTimer = useRef<number | null>(null);
  const { showToast } = useToast();

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

  return (
    <Shell>
      <div className="page-header">
        <h1>Ngarko Excel</h1>
        <p className="muted">Preview tregon vetëm Njësia, Sasia, Çmimi dhe Totali.</p>
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

        {loading && <div className="muted import-status">Analizimi i të dhënave... prisni pak.</div>}

        {rows.length > 0 && !loading && (
          <div className="import-preview import-table-container">
            <div className="import-preview-head"><strong>U analizuan {rows.length} pozicione.</strong></div>
            <table className="import-table">
              <thead>
                <tr className="import-table-head-row">
                  <th className="import-table-cell">Njësia</th>
                  <th className="import-table-cell">Sasia</th>
                  <th className="import-table-cell">Çmimi</th>
                  <th className="import-table-cell">Totali</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((row, index) => (
                  <tr key={`${row.position_number}-${index}`} className="import-table-body-row">
                    <td className="import-table-cell">{row.unit}</td>
                    <td className="import-table-cell">{row.quantity}</td>
                    <td className="import-table-cell">{Number(row.unit_price).toFixed(2)}€</td>
                    <td className="import-table-cell col-bold">{Number(row.total_price).toFixed(2)}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && <div className="muted import-table-more">...dhe {rows.length - 20} rreshta të tjerë.</div>}
            <div className="import-actions">
              <button className="primary-button import-save-btn" type="button" onClick={handleSave} disabled={loading}>Aprovo dhe Shto Pozicionet</button>
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
