import { useState, useMemo } from 'react';
import { buildLibriSinglePageWorkbook, downloadWorkbookBuffer, extractSectionAccountNumber, type LibriExportPlanPage } from '../lib/libriExport';
import { ParamasaPreview } from './ParamasaPreview';
import type { ParsedRow } from '../lib/excel';
import type { ParamasaPreviewMeta } from '../types/paramasaMeta';
import type { TemplateId } from '../lib/libriPaging';

const TEMPLATE_INFO: Record<TemplateId, { label: string; maxPositions: number }> = {
  1: { label: 'Shablloni 1 — 1 pozicion/faqe', maxPositions: 1 },
  2: { label: 'Shablloni 2 — 2 pozicione/faqe', maxPositions: 2 },
  3: { label: 'Shablloni 3 — 3 pozicione/faqe', maxPositions: 3 },
  4: { label: 'Shablloni 4 — 4 pozicione/faqe', maxPositions: 4 },
  5: { label: 'Shablloni 5 — 5 pozicione/faqe', maxPositions: 5 },
};

const DEFAULT_TEMPLATE: TemplateId = 1;

function templateCapacity(templateId: TemplateId): number {
  return TEMPLATE_INFO[templateId].maxPositions;
}

/** Rregullon listën e rreshtave sipas kapacitetit të shabllonit (1–5), duke ruajtur të dhënat ekzistuese. */
function syncRowsToTemplate(current: ManualRow[], templateId: TemplateId): ManualRow[] {
  const targetCount = templateCapacity(templateId);
  if (current.length === targetCount) return current;
  if (current.length > targetCount) return current.slice(0, targetCount);
  return [...current, ...Array.from({ length: targetCount - current.length }, (_, i) => emptyRow(current.length + i))];
}

function chunkRows<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

type ManualRow = {
  id: string;
  position_number: string;
  description: string;
  unit: string;
  quantity: string;
  unit_price: string;
};

function emptyRow(index: number): ManualRow {
  return { id: `r${index}-${Date.now()}`, position_number: '', description: '', unit: '', quantity: '', unit_price: '' };
}

function toParsedRow(r: ManualRow): ParsedRow {
  const qty = Number(r.quantity) || 0;
  const price = Number(r.unit_price) || 0;
  return {
    position_number: r.position_number,
    description: r.description,
    unit: r.unit,
    quantity: qty,
    unit_price: price,
    total_price: qty * price,
    source: 'paramasa' as const,
  };
}

export function ManualPageBuilder() {
  const [templateId, setTemplateId] = useState<TemplateId>(DEFAULT_TEMPLATE);
  const maxPos = templateCapacity(templateId);

  const [meta, setMeta] = useState<ParamasaPreviewMeta>({
    executorName: '',
    month: new Date().toLocaleDateString('sq-AL', { month: 'long', year: 'numeric' }),
    date: new Date().toLocaleDateString('sq-AL'),
    objectName: '',
    offerAccount: '',
    offerPositions: '',
    sectionTitle: '',
  });

  const [rows, setRows] = useState<ManualRow[]>(() =>
    syncRowsToTemplate([], DEFAULT_TEMPLATE)
  );
  const [downloading, setDownloading] = useState(false);

  const handleTemplateChange = (id: TemplateId) => {
    setTemplateId(id);
    setRows((current) => syncRowsToTemplate(current, id));
  };

  const updateRow = (index: number, field: keyof ManualRow, value: string) => {
    setRows((current) => current.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((r) => [...r, emptyRow(r.length)]);
  const removeRow = (index: number) => {
    setRows((current) => {
      if (current.length <= maxPos) return current;
      return current.filter((_, i) => i !== index);
    });
  };

  // Rreshtat e vlefshëm për preview (jo bosh plotësisht)
  const validRows = useMemo(
    () => rows.filter((r) => r.description.trim() || r.position_number.trim()),
    [rows]
  );

  const previewRows: ParsedRow[] = useMemo(() => validRows.map(toParsedRow), [validRows]);

  const manualPlan: LibriExportPlanPage[] = useMemo(() => {
    return chunkRows(previewRows, maxPos).map((chunk, ci) => ({
      templateId,
      sectionKey: `manual-${ci}`,
      sectionLabel: meta.sectionTitle || '',
      rows: chunk,
      overflowWarning: false,
      mixedUnitsWarning: false,
    }));
  }, [previewRows, maxPos, templateId, meta.sectionTitle]);

  // Meta për preview
  const previewMeta: ParamasaPreviewMeta = {
    ...meta,
    offerAccount: meta.offerAccount || (meta.sectionTitle ? extractSectionAccountNumber(meta.sectionTitle) : ''),
  };

  const handleDownload = async () => {
    if (validRows.length === 0) return;
    setDownloading(true);
    try {
      const chunks = chunkRows(validRows, maxPos);

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        const page = {
          templateId,
          sectionKey: `manual-${ci}`,
          sectionLabel: meta.sectionTitle || '',
          rows: chunk.map(toParsedRow),
          overflowWarning: false,
          mixedUnitsWarning: false,
        };
        const buf = await buildLibriSinglePageWorkbook(page, previewMeta);
        const label = meta.sectionTitle
          ? extractSectionAccountNumber(meta.sectionTitle)
          : `Faqja-${ci + 1}`;
        downloadWorkbookBuffer(buf, `Libri-${label}-${ci + 1}.xlsx`);
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="manual-builder">
      {/* ── Meta ── */}
      <section className="panel form-section">
        <h3 className="panel-title">1. Shablloni dhe metadata</h3>
        <div className="manual-template-chips">
          {([1, 2, 3, 4, 5] as TemplateId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`chip-button ${templateId === id ? 'chip-selected' : ''}`}
              onClick={() => handleTemplateChange(id)}
            >
              {id} poz.
            </button>
          ))}
          <span className="muted field-hint">{TEMPLATE_INFO[templateId].label}</span>
        </div>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <label>
            Kryesi i punëve
            <input value={meta.executorName} onChange={(e) => setMeta((m) => ({ ...m, executorName: e.target.value }))} placeholder="Kompania juaj" />
          </label>
          <label>
            Muaji / Data
            <input value={meta.month} onChange={(e) => setMeta((m) => ({ ...m, month: e.target.value }))} placeholder="Korrik 2026" />
          </label>
          <label>
            Objekti
            <input value={meta.objectName} onChange={(e) => setMeta((m) => ({ ...m, objectName: e.target.value }))} placeholder="Ndërtesa A" />
          </label>
          <label>
            Titulli i seksionit
            <input
              value={meta.sectionTitle}
              onChange={(e) => setMeta((m) => ({ ...m, sectionTitle: e.target.value }))}
              placeholder="2. Punët e betonit"
            />
            <span className="field-hint">P.sh. "2. Punët e betonit" — Llogaria me ofertë do të del si "II" automatikisht.</span>
          </label>
          <label>
            Poz. me ofertë
            <input value={meta.offerPositions} onChange={(e) => setMeta((m) => ({ ...m, offerPositions: e.target.value }))} placeholder="2.1, 2.2" />
          </label>
        </div>
      </section>

      {/* ── Pozicionet ── */}
      <section className="panel form-section">
        <h3 className="panel-title">2. Pozicionet</h3>
        <p className="muted field-hint">
          Shablloni {templateId} mban {maxPos} pozicion/faqe. Nëse shton më shumë, do të krijohen faqe shtesë automatikisht.
        </p>
        <div className="manual-rows-list">
          {/* Header */}
          <div className="manual-row-header">
            <span>Nr. Poz.</span>
            <span>Përshkrimi</span>
            <span>Njësia</span>
            <span>Sasia</span>
            <span>Çmimi (€)</span>
            <span>Totali</span>
            <span />
          </div>
          {rows.map((row, index) => {
            const qty = Number(row.quantity) || 0;
            const price = Number(row.unit_price) || 0;
            const total = qty * price;
            const pageNumber = Math.floor(index / maxPos) + 1;
            const showPageDivider = index > 0 && index % maxPos === 0;
            return (
              <div key={row.id}>
                {showPageDivider ? (
                  <div className="manual-page-divider muted">
                    Faqja {pageNumber} · Shablloni {templateId} ({maxPos} poz.)
                  </div>
                ) : null}
                <div className="manual-row">
                <input
                  type="text"
                  value={row.position_number}
                  onChange={(e) => updateRow(index, 'position_number', e.target.value)}
                  placeholder="2.1"
                  className="manual-cell-input"
                />
                <input
                  type="text"
                  value={row.description}
                  onChange={(e) => updateRow(index, 'description', e.target.value)}
                  placeholder="Përshkrimi i punës..."
                  className="manual-cell-input"
                />
                <input
                  type="text"
                  value={row.unit}
                  onChange={(e) => updateRow(index, 'unit', e.target.value)}
                  placeholder="m²"
                  className="manual-cell-input"
                />
                <input
                  type="number"
                  step="0.01"
                  value={row.quantity}
                  onChange={(e) => updateRow(index, 'quantity', e.target.value)}
                  placeholder="0"
                  className="manual-cell-input"
                />
                <input
                  type="number"
                  step="0.01"
                  value={row.unit_price}
                  onChange={(e) => updateRow(index, 'unit_price', e.target.value)}
                  placeholder="0.00"
                  className="manual-cell-input"
                />
                <span className="manual-cell-total">
                  {total > 0 ? `${total.toFixed(2)} €` : '—'}
                </span>
                <button
                  type="button"
                  className="card import-cancel-btn"
                  onClick={() => removeRow(index)}
                  disabled={rows.length <= maxPos}
                  title={rows.length <= maxPos ? `Shablloni ${templateId} kërkon të paktën ${maxPos} rreshta` : 'Fshi rreshtin'}
                >
                  ✕
                </button>
              </div>
              </div>
            );
          })}
        </div>
        <div className="form-actions-row" style={{ marginTop: 12 }}>
          <button type="button" className="card" onClick={addRow}>+ Shto pozicion</button>
          <button
            type="button"
            className="primary-button"
            onClick={handleDownload}
            disabled={validRows.length === 0 || downloading}
          >
            {downloading ? 'Duke gjeneruar…' : `Shkarko ${Math.ceil(validRows.length / maxPos)} faqe (.xlsx)`}
          </button>
        </div>
      </section>

      {/* ── Preview live ── */}
      {previewRows.length > 0 && (
        <section className="panel form-section">
          <h3 className="panel-title">3. Preview live</h3>
          <ParamasaPreview rows={previewRows} meta={previewMeta} planOverride={manualPlan} />
        </section>
      )}
    </div>
  );
}