import { useMemo, useState, type ChangeEvent } from 'react';
import { FileText, Upload, Sparkles, CalendarDays, UserRound, Building2, Hash } from 'lucide-react';
import { Shell } from '../components/Shell';

type InvoiceDraft = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  clientAddress: string;
  projectName: string;
  reference: string;
};

const initialDraft: InvoiceDraft = {
  invoiceNumber: 'FAT-2026-001',
  invoiceDate: new Date().toLocaleDateString('sq-AL'),
  dueDate: new Date().toLocaleDateString('sq-AL'),
  clientName: '',
  clientAddress: '',
  projectName: '',
  reference: '',
};

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  const kilobytes = size / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function fileTypeLabel(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'xlsx' || extension === 'xls') return 'Excel';
  if (extension === 'pdf') return 'PDF';
  if (extension === 'docx' || extension === 'doc') return 'Word';
  return extension ? extension.toUpperCase() : 'Skedar';
}

export function InvoicePage() {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<InvoiceDraft>(initialDraft);

  const fileSummary = useMemo(() => {
    if (!templateFile) return 'Nuk ka shabllon të zgjedhur ende.';
    return `${fileTypeLabel(templateFile.name)} • ${formatFileSize(templateFile.size)}`;
  }, [templateFile]);

  const handleTemplateUpload = (event: ChangeEvent<HTMLInputElement>) => {
    setTemplateFile(event.target.files?.[0] ?? null);
  };

  const handleReset = () => {
    setTemplateFile(null);
    setDraft(initialDraft);
  };

  return (
    <Shell>
      <section className="page-header">
        <div className="eyebrow accent">Fatura</div>
        <h1>Krijo fature</h1>
        <p className="muted">
          Ngarko një shabllon fature dhe mbush vetëm të dhënat që ndryshojnë nga njëra faturë te tjetra.
        </p>
      </section>

      <div className="panel invoice-page">
        <section className="invoice-upload-panel">
          <div className="invoice-upload-head">
            <div>
              <h3 className="panel-heading-accent"><Upload size={17} className="panel-heading-icon" /> Shablloni i faturës</h3>
              <p className="muted">Ngarko dokumentin bazë që ruan të njëjtin format çdo herë.</p>
            </div>
            <span className="invoice-upload-badge">Template</span>
          </div>

          <label className="invoice-upload-dropzone">
            <FileText size={22} />
            <strong>Zgjidh shabllonin</strong>
            <span className="muted">Mbështet .xlsx, .pdf, .docx dhe skedarë të ngjashëm.</span>
            <span className="invoice-upload-action">Kliko për të ngarkuar</span>
            <input
              className="invoice-upload-input"
              type="file"
              accept=".xlsx,.xls,.pdf,.doc,.docx,.csv,image/*"
              onChange={handleTemplateUpload}
            />
          </label>

          <div className="invoice-file-card">
            <div>
              <strong>{templateFile ? templateFile.name : 'Asnjë skedar nuk është zgjedhur'}</strong>
              <p className="muted">{fileSummary}</p>
            </div>
            <button type="button" className="link-button" onClick={handleReset}>
              Pastro
            </button>
          </div>
        </section>

        <section className="invoice-fields-panel">
          <h3 className="panel-heading-accent"><Sparkles size={17} className="panel-heading-icon" /> Të dhënat që ndryshojnë</h3>
          <div className="form-grid invoice-form-grid">
            <label>
              <span><Hash size={14} className="invoice-label-icon" /> Numri i faturës</span>
              <input value={draft.invoiceNumber} onChange={(event) => setDraft((current) => ({ ...current, invoiceNumber: event.target.value }))} placeholder="FAT-2026-001" />
            </label>
            <label>
              <span><CalendarDays size={14} className="invoice-label-icon" /> Data e faturës</span>
              <input value={draft.invoiceDate} onChange={(event) => setDraft((current) => ({ ...current, invoiceDate: event.target.value }))} placeholder="14.07.2026" />
            </label>
            <label>
              <span><CalendarDays size={14} className="invoice-label-icon" /> Afati i pagesës</span>
              <input value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} placeholder="28.07.2026" />
            </label>
            <label>
              <span><UserRound size={14} className="invoice-label-icon" /> Klienti</span>
              <input value={draft.clientName} onChange={(event) => setDraft((current) => ({ ...current, clientName: event.target.value }))} placeholder="Emri i klientit" />
            </label>
            <label className="full-width-field">
              <span><Building2 size={14} className="invoice-label-icon" /> Adresa e klientit</span>
              <input value={draft.clientAddress} onChange={(event) => setDraft((current) => ({ ...current, clientAddress: event.target.value }))} placeholder="Rruga, qyteti, shteti" />
            </label>
            <label className="full-width-field">
              <span><FileText size={14} className="invoice-label-icon" /> Projekti / përshkrimi</span>
              <input value={draft.projectName} onChange={(event) => setDraft((current) => ({ ...current, projectName: event.target.value }))} placeholder="Emri i projektit ose shërbimit" />
            </label>
            <label className="full-width-field">
              <span><FileText size={14} className="invoice-label-icon" /> Referenca</span>
              <input value={draft.reference} onChange={(event) => setDraft((current) => ({ ...current, reference: event.target.value }))} placeholder="Shënim, numër porosie ose referencë" />
            </label>
          </div>
        </section>

        <section className="invoice-preview-panel card">
          <div className="invoice-preview-head">
            <div>
              <div className="eyebrow accent">Parapamje</div>
              <h3>Si do të duket fatura</h3>
            </div>
            <span className="invoice-preview-badge">Gati për automatizim</span>
          </div>

          <div className="invoice-preview-grid">
            <div>
              <span className="muted">Shablloni</span>
              <strong>{templateFile ? templateFile.name : 'Nuk është ngarkuar'}</strong>
            </div>
            <div>
              <span className="muted">Numri</span>
              <strong>{draft.invoiceNumber || '—'}</strong>
            </div>
            <div>
              <span className="muted">Klienti</span>
              <strong>{draft.clientName || '—'}</strong>
            </div>
            <div>
              <span className="muted">Data</span>
              <strong>{draft.invoiceDate || '—'}</strong>
            </div>
            <div>
              <span className="muted">Afati</span>
              <strong>{draft.dueDate || '—'}</strong>
            </div>
            <div>
              <span className="muted">Projekti</span>
              <strong>{draft.projectName || '—'}</strong>
            </div>
          </div>

          <p className="muted invoice-preview-note">
            Këtu më vonë mund të shtohet gjenerimi automatik i faturës mbi shabllon, pa ndryshuar formatin.
          </p>
        </section>
      </div>
    </Shell>
  );
}