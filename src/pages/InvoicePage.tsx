import { useState, type ReactNode } from 'react';
import {
  Building2,
  CalendarDays,
  Download,
  FileText,
  Hash,
  Landmark,
  MapPin,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Shell } from '../components/Shell';
import { useToast } from '../context/ToastContext';
import { downloadKontrateInvoice, downloadPozicioneInvoice } from '../lib/faturaExport';
import {
  sanitizeDecimalInput,
  sanitizeDigitsInput,
  validateKontrate,
  validatePozicione,
  type FaturaFieldErrors,
} from '../lib/faturaValidation';
import {
  createEmptyPosition,
  createKontrateDefaults,
  createPozicioneDefaults,
  type FaturaKind,
  type FaturaKontrateFields,
  type FaturaPozicioneFields,
  type FaturaPositionRow,
} from '../types/fatura';

function FieldLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="invoice-field-label">
      {icon}
      {children}
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="field-error">{message}</span>;
}

function fieldClass(hasError: boolean): string {
  return hasError ? 'input-invalid' : '';
}

function IssuerFields({
  issuer,
  errors,
  onChange,
}: {
  issuer: FaturaKontrateFields['issuer'];
  errors: FaturaFieldErrors;
  onChange: (issuer: FaturaKontrateFields['issuer']) => void;
}) {
  return (
    <div className="invoice-section">
      <h3 className="panel-heading-accent">
        <Building2 size={17} className="panel-heading-icon" />
        Të dhënat e Megrant ING (default)
      </h3>
      <div className="form-grid invoice-form-grid">
        <label className="full-width-field">
          <FieldLabel>Emri i kompanisë</FieldLabel>
          <input
            className={fieldClass(Boolean(errors['issuer.companyName']))}
            value={issuer.companyName}
            onChange={(event) => onChange({ ...issuer, companyName: event.target.value })}
          />
          <FieldError message={errors['issuer.companyName']} />
        </label>
        <label>
          <FieldLabel>Numri unik identifikues</FieldLabel>
          <input
            className={fieldClass(Boolean(errors['issuer.nui']))}
            value={issuer.nui}
            inputMode="numeric"
            onChange={(event) => onChange({ ...issuer, nui: sanitizeDigitsInput(event.target.value) })}
          />
          <FieldError message={errors['issuer.nui']} />
        </label>
        <label>
          <FieldLabel icon={<Landmark size={14} className="invoice-label-icon" />}>NLB BANKA</FieldLabel>
          <input
            className={fieldClass(Boolean(errors['issuer.bankAccount']))}
            value={issuer.bankAccount}
            inputMode="numeric"
            onChange={(event) => onChange({ ...issuer, bankAccount: sanitizeDigitsInput(event.target.value) })}
          />
          <FieldError message={errors['issuer.bankAccount']} />
        </label>
      </div>
    </div>
  );
}

function SharedHeaderFields({
  invoiceNumber,
  invoiceDate,
  clientName,
  clientNameLine2,
  clientAddress,
  place,
  showPlace,
  errors,
  onChange,
}: {
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  clientNameLine2: string;
  clientAddress: string;
  place?: string;
  showPlace?: boolean;
  errors: FaturaFieldErrors;
  onChange: (patch: Partial<FaturaKontrateFields & { place: string }>) => void;
}) {
  return (
    <>
      <div className="invoice-section">
        <h3 className="panel-heading-accent">
          <Hash size={17} className="panel-heading-icon" />
          Fatura
        </h3>
        <div className="form-grid invoice-form-grid">
          <label>
            <FieldLabel icon={<Hash size={14} className="invoice-label-icon" />}>FATURA Nr =</FieldLabel>
            <input
              className={fieldClass(Boolean(errors.invoiceNumber))}
              value={invoiceNumber}
              onChange={(event) => onChange({ invoiceNumber: event.target.value })}
              placeholder="010 / 26"
            />
            <FieldError message={errors.invoiceNumber} />
          </label>
          <label>
            <FieldLabel icon={<CalendarDays size={14} className="invoice-label-icon" />}>Data</FieldLabel>
            <input
              className={fieldClass(Boolean(errors.invoiceDate))}
              type="date"
              value={toInputDate(invoiceDate)}
              onChange={(event) => onChange({ invoiceDate: fromInputDate(event.target.value) })}
            />
            <FieldError message={errors.invoiceDate} />
          </label>
          {showPlace ? (
            <label>
              <FieldLabel icon={<MapPin size={14} className="invoice-label-icon" />}>Vendi (para datës)</FieldLabel>
              <input
                className={fieldClass(Boolean(errors.place))}
                value={place || ''}
                onChange={(event) => onChange({ place: event.target.value })}
                placeholder="Prishtinë"
              />
              <FieldError message={errors.place} />
            </label>
          ) : null}
        </div>
      </div>

      <div className="invoice-section">
        <h3 className="panel-heading-accent">
          <UserRound size={17} className="panel-heading-icon" />
          PËR
        </h3>
        <div className="form-grid invoice-form-grid">
          <label className="full-width-field">
            <FieldLabel icon={<UserRound size={14} className="invoice-label-icon" />}>Emri i klientit (rreshti 1)</FieldLabel>
            <input
              className={fieldClass(Boolean(errors.clientName))}
              value={clientName}
              onChange={(event) => onChange({ clientName: event.target.value })}
              placeholder="KORPORATA ENERGJETIKE E KOSOVËS Sh.a"
            />
            <FieldError message={errors.clientName} />
          </label>
          <label className="full-width-field">
            <FieldLabel>Emri i klientit (rreshti 2, opsional)</FieldLabel>
            <input value={clientNameLine2} onChange={(event) => onChange({ clientNameLine2: event.target.value })} />
          </label>
          <label className="full-width-field">
            <FieldLabel icon={<MapPin size={14} className="invoice-label-icon" />}>Adresa</FieldLabel>
            <input
              className={fieldClass(Boolean(errors.clientAddress))}
              value={clientAddress}
              onChange={(event) => onChange({ clientAddress: event.target.value })}
              placeholder='rr. "Nëna Terez" nr 36 Prishtinë'
            />
            <FieldError message={errors.clientAddress} />
          </label>
        </div>
      </div>
    </>
  );
}

function toInputDate(displayDate: string): string {
  const match = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(displayDate.trim());
  if (!match) return '';
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function fromInputDate(value: string): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

function KontrateForm({
  data,
  errors,
  onChange,
  onExport,
  exporting,
}: {
  data: FaturaKontrateFields;
  errors: FaturaFieldErrors;
  onChange: (data: FaturaKontrateFields) => void;
  onExport: () => void;
  exporting: boolean;
}) {
  const patch = (partial: Partial<FaturaKontrateFields>) => onChange({ ...data, ...partial });

  return (
    <>
      <IssuerFields issuer={data.issuer} errors={errors} onChange={(issuer) => patch({ issuer })} />
      <SharedHeaderFields
        invoiceNumber={data.invoiceNumber}
        invoiceDate={data.invoiceDate}
        clientName={data.clientName}
        clientNameLine2={data.clientNameLine2}
        clientAddress={data.clientAddress}
        errors={errors}
        onChange={patch}
      />

      <div className="invoice-section">
        <h3 className="panel-heading-accent">
          <FileText size={17} className="panel-heading-icon" />
          Fatura sipas kontratës
        </h3>
        <div className="form-grid invoice-form-grid">
          <label>
            <FieldLabel>Numri i kontratës</FieldLabel>
            <input
              className={fieldClass(Boolean(errors.contractBlockNumber))}
              value={data.contractBlockNumber}
              onChange={(event) => patch({ contractBlockNumber: event.target.value })}
              placeholder="KEK-25-8087-5-2-1/C3501"
            />
            <FieldError message={errors.contractBlockNumber} />
          </label>
          <label>
            <FieldLabel>Data e kontratës (dt)</FieldLabel>
            <input
              className={fieldClass(Boolean(errors.contractBlockDate))}
              type="date"
              value={toInputDate(data.contractBlockDate)}
              onChange={(event) => patch({ contractBlockDate: fromInputDate(event.target.value) })}
            />
            <FieldError message={errors.contractBlockDate} />
          </label>
          <label className="full-width-field">
            <FieldLabel>Titulli</FieldLabel>
            <input
              className={fieldClass(Boolean(errors.contractBlockTitle))}
              value={data.contractBlockTitle}
              onChange={(event) => patch({ contractBlockTitle: event.target.value })}
              placeholder="Renovimi i nyjave sanitare në divizionin e prodhimit të qymyrit"
            />
            <FieldError message={errors.contractBlockTitle} />
          </label>
          <label>
            <FieldLabel>Referenca e protokollit të kontratës</FieldLabel>
            <input
              value={data.contractProtocolReference}
              onChange={(event) => patch({ contractProtocolReference: event.target.value })}
              placeholder="2134"
            />
          </label>
          <label className="full-width-field">
            <FieldLabel>Adresa e vendit të kryerjes së punëve</FieldLabel>
            <input
              value={data.contractWorkSiteAddress}
              onChange={(event) => patch({ contractWorkSiteAddress: event.target.value })}
              placeholder="DPQ"
            />
          </label>
          <p className="muted invoice-section-note">
            Datën e faturës e merr automatikisht nga fusha &quot;Data&quot; sipër (shfaqet si &quot;Datën e faturës&quot; në kuti).
          </p>
        </div>
      </div>

      <div className="invoice-section">
        <h3 className="panel-heading-accent">
          <FileText size={17} className="panel-heading-icon" />
          Tabela e faturës
        </h3>
        <p className="muted invoice-section-note">
          Titulli i kontratës, numri i kontratës dhe fatura mbushin kolonat poshtë header-it. Vlera pa TVSH dhe TVSH
          llogariten automatikisht nga shuma me TVSH.
        </p>
        <div className="form-grid invoice-form-grid">
          <label className="full-width-field">
            <FieldLabel>Titulli i kontratës (kolona A, shumë-rresht)</FieldLabel>
            <textarea
              className={fieldClass(Boolean(errors.tableTitle))}
              rows={5}
              value={data.tableTitle}
              onChange={(event) => patch({ tableTitle: event.target.value })}
              placeholder={'Renovimi i nyjave\nsanitare në divizionin\ne prodhimit të qymyrit'}
            />
            <FieldError message={errors.tableTitle} />
          </label>
          <label>
            <FieldLabel>Numri i kontratës (kolona D)</FieldLabel>
            <input
              className={fieldClass(Boolean(errors.tableContractNumber))}
              value={data.tableContractNumber}
              onChange={(event) => patch({ tableContractNumber: event.target.value })}
              placeholder="KEK-25-8087-5-2-1/C3501"
            />
            <FieldError message={errors.tableContractNumber} />
          </label>
          <label>
            <FieldLabel>Gjithsej me TVSH (kolona J)</FieldLabel>
            <input
              className={fieldClass(Boolean(errors.totalWithVat))}
              value={data.totalWithVat}
              onChange={(event) => patch({ totalWithVat: sanitizeDecimalInput(event.target.value) })}
              placeholder="6409.76"
              inputMode="decimal"
            />
            <FieldError message={errors.totalWithVat} />
          </label>
          <label className="full-width-field">
            <FieldLabel>Fatura / referenca (kolona F, shumë-rresht)</FieldLabel>
            <textarea
              className={fieldClass(Boolean(errors.tableInvoiceReference))}
              rows={5}
              value={data.tableInvoiceReference}
              onChange={(event) => patch({ tableInvoiceReference: event.target.value })}
              placeholder={'Në bazë të\nsituacionit nr 2.\npërfundimtarë dhe\nraportit të punës\nnga projekt menaxheri.'}
            />
            <FieldError message={errors.tableInvoiceReference} />
          </label>
        </div>
      </div>

      <div className="invoice-actions">
        <button type="button" className="primary-button" onClick={onExport} disabled={exporting}>
          <Download size={16} />
          {exporting ? 'Duke gjeneruar...' : 'Shkarko faturën (.xlsx)'}
        </button>
      </div>
    </>
  );
}

function PozicioneForm({
  data,
  errors,
  onChange,
  onExport,
  exporting,
}: {
  data: FaturaPozicioneFields;
  errors: FaturaFieldErrors;
  onChange: (data: FaturaPozicioneFields) => void;
  onExport: () => void;
  exporting: boolean;
}) {
  const patch = (partial: Partial<FaturaPozicioneFields>) => onChange({ ...data, ...partial });

  const updatePosition = (id: string, partial: Partial<FaturaPositionRow>) => {
    patch({
      positions: data.positions.map((row) => (row.id === id ? { ...row, ...partial } : row)),
    });
  };

  const addPosition = () => {
    patch({ positions: [...data.positions, createEmptyPosition(data.positions.length + 1)] });
  };

  const removePosition = (id: string) => {
    if (data.positions.length <= 1) return;
    patch({ positions: data.positions.filter((row) => row.id !== id) });
  };

  return (
    <>
      <IssuerFields issuer={data.issuer} errors={errors} onChange={(issuer) => patch({ issuer })} />
      <SharedHeaderFields
        invoiceNumber={data.invoiceNumber}
        invoiceDate={data.invoiceDate}
        clientName={data.clientName}
        clientNameLine2={data.clientNameLine2}
        clientAddress={data.clientAddress}
        place={data.place}
        showPlace
        errors={errors}
        onChange={patch}
      />

      <div className="invoice-section">
        <h3 className="panel-heading-accent">
          <FileText size={17} className="panel-heading-icon" />
          Fatura për kontratën
        </h3>
        <div className="form-grid invoice-form-grid">
          <label className="full-width-field">
            <FieldLabel>Titulli / përshkrimi i kontratës</FieldLabel>
            <input
              className={fieldClass(Boolean(errors.contractTitle))}
              value={data.contractTitle}
              onChange={(event) => patch({ contractTitle: event.target.value })}
              placeholder="Demolimi dhe rregullimi në urgjencën e vjetër"
            />
            <FieldError message={errors.contractTitle} />
          </label>
          <label>
            <FieldLabel>Numri i kontratës</FieldLabel>
            <input
              className={fieldClass(Boolean(errors.contractNumber))}
              value={data.contractNumber}
              onChange={(event) => patch({ contractNumber: event.target.value })}
              placeholder="615-26-4983-5-2-1/C3501"
            />
            <FieldError message={errors.contractNumber} />
          </label>
        </div>
      </div>

      <div className="invoice-section">
        <div className="invoice-section-head">
          <h3 className="panel-heading-accent">
            <FileText size={17} className="panel-heading-icon" />
            Pozicionet
          </h3>
          <button type="button" className="card import-cancel-btn invoice-add-row-btn" onClick={addPosition}>
            <Plus size={15} />
            Shto pozicion
          </button>
        </div>
        <FieldError message={errors.positions} />

        <div className="invoice-positions-list">
          {data.positions.map((position, index) => {
            const prefix = `positions.${position.id}`;
            return (
            <div key={position.id} className="invoice-position-card">
              <div className="invoice-position-card-head">
                <strong>Pozicioni {index + 1}</strong>
                <button
                  type="button"
                  className="link-button danger-link"
                  onClick={() => removePosition(position.id)}
                  disabled={data.positions.length <= 1}
                >
                  <Trash2 size={14} />
                  Hiq
                </button>
              </div>
              <div className="form-grid invoice-form-grid">
                <label className="full-width-field">
                  <FieldLabel>Përshkrimi</FieldLabel>
                  <textarea
                    className={fieldClass(Boolean(errors[`${prefix}.description`]))}
                    rows={3}
                    value={position.description}
                    onChange={(event) => updatePosition(position.id, { description: event.target.value })}
                  />
                  <FieldError message={errors[`${prefix}.description`]} />
                </label>
                <label>
                  <FieldLabel>Njësia</FieldLabel>
                  <input
                    className={fieldClass(Boolean(errors[`${prefix}.unit`]))}
                    value={position.unit}
                    onChange={(event) => updatePosition(position.id, { unit: event.target.value })}
                    placeholder="m2, copë, komplet..."
                  />
                  <FieldError message={errors[`${prefix}.unit`]} />
                </label>
                <label>
                  <FieldLabel>Sasia</FieldLabel>
                  <input
                    className={fieldClass(Boolean(errors[`${prefix}.quantity`]))}
                    value={position.quantity}
                    onChange={(event) =>
                      updatePosition(position.id, { quantity: sanitizeDecimalInput(event.target.value) })
                    }
                    inputMode="decimal"
                    placeholder="82.5"
                  />
                  <FieldError message={errors[`${prefix}.quantity`]} />
                </label>
                <label>
                  <FieldLabel>Çmimi për njësi (€)</FieldLabel>
                  <input
                    className={fieldClass(Boolean(errors[`${prefix}.unitPrice`]))}
                    value={position.unitPrice}
                    onChange={(event) =>
                      updatePosition(position.id, { unitPrice: sanitizeDecimalInput(event.target.value) })
                    }
                    inputMode="decimal"
                    placeholder="9"
                  />
                  <FieldError message={errors[`${prefix}.unitPrice`]} />
                </label>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      <div className="invoice-actions">
        <button type="button" className="primary-button" onClick={onExport} disabled={exporting}>
          <Download size={16} />
          {exporting ? 'Duke gjeneruar...' : 'Shkarko fletë-dërgesën (.xlsx)'}
        </button>
      </div>
    </>
  );
}

export function InvoicePage() {
  const { showToast } = useToast();
  const [kind, setKind] = useState<FaturaKind>('kontrate');
  const [kontrateData, setKontrateData] = useState<FaturaKontrateFields>(createKontrateDefaults);
  const [pozicioneData, setPozicioneData] = useState<FaturaPozicioneFields>(createPozicioneDefaults);
  const [kontrateErrors, setKontrateErrors] = useState<FaturaFieldErrors>({});
  const [pozicioneErrors, setPozicioneErrors] = useState<FaturaFieldErrors>({});
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (kind === 'kontrate') {
        const validation = validateKontrate(kontrateData);
        setKontrateErrors(validation.errors);
        if (!validation.valid) {
          showToast(validation.firstError || 'Plotëso fushat e detyrueshme.', 'error');
          return;
        }
        await downloadKontrateInvoice(kontrateData);
        showToast('Fatura u shkarkua me sukses.', 'success');
      } else {
        const validation = validatePozicione(pozicioneData);
        setPozicioneErrors(validation.errors);
        if (!validation.valid) {
          showToast(validation.firstError || 'Plotëso fushat e detyrueshme.', 'error');
          return;
        }
        await downloadPozicioneInvoice(pozicioneData);
        showToast('Fletë-dërgesa u shkarkua me sukses.', 'success');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Eksporti dështoi.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleKindChange = (nextKind: FaturaKind) => {
    setKind(nextKind);
    setKontrateErrors({});
    setPozicioneErrors({});
  };

  return (
    <Shell>
      <section className="page-header">
        <div className="eyebrow accent">Fatura</div>
        <h1>Krijo faturë / fletë-dërgesë</h1>
        <p className="muted">
          Zgjidh llojin e dokumentit, plotëso fushat me etiketa individuale dhe shkarko Excel-in me të njëjtin format si
          shablloni origjinal — gati për printim A4.
        </p>
      </section>

      <div className="panel invoice-page">
        <section className="invoice-type-panel">
          <h3 className="panel-heading-accent">
            <FileText size={17} className="panel-heading-icon" />
            Lloji i dokumentit
          </h3>
          <div className="invoice-type-switch" role="tablist" aria-label="Lloji i dokumentit">
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'kontrate'}
              className={kind === 'kontrate' ? 'invoice-type-btn active' : 'invoice-type-btn'}
              onClick={() => handleKindChange('kontrate')}
            >
              Faturë (kontratë e plotë)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'pozicione'}
              className={kind === 'pozicione' ? 'invoice-type-btn active' : 'invoice-type-btn'}
              onClick={() => handleKindChange('pozicione')}
            >
              Fletë-dërgesë (pozicione)
            </button>
          </div>
          <p className="muted invoice-section-note">
            {kind === 'kontrate'
              ? 'Për fatura që mbulojnë komplet kontratën — me shumë totale dhe ndarje TVSH.'
              : 'Për fletë-dërgesë me tabelë artikujsh — përshkrimi i çdo pozicioni ndryshohet manualisht.'}
          </p>
        </section>

        <section className="invoice-fields-panel">
          {kind === 'kontrate' ? (
            <KontrateForm
              data={kontrateData}
              errors={kontrateErrors}
              onChange={(data) => {
                setKontrateData(data);
                if (Object.keys(kontrateErrors).length > 0) setKontrateErrors({});
              }}
              onExport={handleExport}
              exporting={exporting}
            />
          ) : (
            <PozicioneForm
              data={pozicioneData}
              errors={pozicioneErrors}
              onChange={(data) => {
                setPozicioneData(data);
                if (Object.keys(pozicioneErrors).length > 0) setPozicioneErrors({});
              }}
              onExport={handleExport}
              exporting={exporting}
            />
          )}
        </section>
      </div>
    </Shell>
  );
}
