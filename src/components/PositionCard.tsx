import { useState } from 'react';
import type { DbCategory } from '../types/database';
import type { DbProjectItem } from '../types/database';
import { formatDateTime, wasUpdated } from '../lib/dates';
import { PricingPreview } from './PricingPreview';
import EditModal from './EditModal';
import { pushAdjustLog } from '../lib/audit';

type ItemWithMeta = DbProjectItem & {
  projects?: { name: string } | null;
  categories?: { name: string } | null;
};

type Props = {
  item: ItemWithMeta;
  selected?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onCompareA?: () => void;
  onCompareB?: () => void;
  editing?: boolean;
  editForm?: {
    description: string;
    position_number: string;
    unit: string;
    quantity: number;
    category_id: string;
    materialPrice: number;
    laborPrice: number;
    days: number;
    foodPrice: number;
    location: string;
    transportPrice: number;
    otherPrice: number;
    profitPercent: number;
    vatPercent: number;
  };
  onEditFormChange?: (form: any) => void;
  onSave?: () => void;
  onCancel?: () => void;
  categories?: DbCategory[];
};

export function PositionCard({
  item,
  selected,
  onSelect,
  onEdit,
  onCompareA,
  onCompareB,
  editing,
  editForm,
  onEditFormChange,
  onSave,
  onCancel,
  categories = [],
}: Props) {
  const modified = wasUpdated(item.created_at, item.updated_at);
  const [targetTotal, setTargetTotal] = useState('');
  const [mode, setMode] = useState<'proportional' | 'labor-first' | 'material-first'>('proportional');
  const [weight, setWeight] = useState(0.7);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <article className={`position-card ${selected ? 'position-card-selected' : ''}`} onClick={onSelect}>
      <div className="position-card-head">
        <div>
          <strong>{item.description}</strong>
          {item.position_number && <span className="muted"> · Nr {item.position_number}</span>}
          {item.categories?.name && <> · <span className="accent">{item.categories.name}</span></>}
        </div>
      </div>

      <div className="position-card-meta muted" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
        <span>Njesia: <strong style={{ color: 'var(--text)' }}>{item.unit || '-'}</strong></span>
        <span>Sasia: <strong style={{ color: 'var(--text)' }}>{item.quantity}</strong></span>
        <span>Cmimi: <strong style={{ color: 'var(--text)' }}>{Number(item.unit_price).toFixed(2)} €</strong></span>
        <span className="position-card-total" style={{ marginLeft: 'auto' }}>TOTALI: <strong style={{ color: 'var(--text)' }}>{Number(item.total_price).toFixed(2)} €</strong></span>
      </div>

      <div className="position-card-dates">
        <span>Krijuar: {formatDateTime(item.created_at)}</span>
        {modified ? (
          <span className="date-updated">Përditësuar: {formatDateTime(item.updated_at)}</span>
        ) : (
          <span className="muted">Pa ndryshime pas krijimit</span>
        )}
      </div>

      {editing && editForm ? (
        <div className="position-card-edit" onClick={(e) => e.stopPropagation()}>
          <div className="edit-form-grid edit-form-grid-top">
            <label className="full-width-field">
              Përshkrimi
              <input type="text" value={editForm.description} onChange={(e) => onEditFormChange?.({ ...editForm, description: e.target.value })} />
            </label>
            <label>
              Nr. Poz.
              <input type="text" value={editForm.position_number} onChange={(e) => onEditFormChange?.({ ...editForm, position_number: e.target.value })} />
            </label>
          </div>

          <div className="edit-form-section">
            <label>
              Kategoria e pozicionit
              <select value={editForm.category_id} onChange={(e) => onEditFormChange?.({ ...editForm, category_id: e.target.value })}>
                <option value="">Pa kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="edit-form-grid edit-form-grid-fields">
            <label>
              Njësia
              <select value={editForm.unit} onChange={(e) => onEditFormChange?.({ ...editForm, unit: e.target.value })}>
                <option value="m2">m²</option>
                <option value="m3">m³</option>
                <option value="m'">m'</option>
                <option value="cop'">Cop'</option>
                <option value="komplet">Komplet</option>
                <option value="paushall">Paushall</option>
                <option value="kg">kg</option>
                <option value="lit�r">Lit�r</option>
              </select>
            </label>
            <label>
              Sasia
              <input type="number" step="0.01" value={editForm.quantity} onChange={(e) => onEditFormChange?.({ ...editForm, quantity: Number(e.target.value) })} />
            </label>

            <label>
              Materiali për njësi (€)
              <input type="number" step="0.01" value={editForm.materialPrice} onChange={(e) => onEditFormChange?.({ ...editForm, materialPrice: Number(e.target.value) })} />
            </label>
            <label>
              Puna për njësi (€)
              <input type="number" step="0.01" value={editForm.laborPrice} onChange={(e) => onEditFormChange?.({ ...editForm, laborPrice: Number(e.target.value) })} />
            </label>

            <label>
              Ditë pune
              <input type="number" step="0.5" value={editForm.days} onChange={(e) => onEditFormChange?.({ ...editForm, days: Number(e.target.value) })} />
            </label>
            <label>
              Ushqim ditor (€)
              <input type="number" step="0.01" value={editForm.foodPrice} onChange={(e) => onEditFormChange?.({ ...editForm, foodPrice: Number(e.target.value) })} />
            </label>

            <label>
              Shpenzime tjera (€)
              <input type="number" step="0.01" value={editForm.otherPrice} onChange={(e) => onEditFormChange?.({ ...editForm, otherPrice: Number(e.target.value) })} />
            </label>
            <label>
              Transport ditor (€)
              <input type="number" step="0.01" value={editForm.transportPrice} onChange={(e) => onEditFormChange?.({ ...editForm, transportPrice: Number(e.target.value) })} />
            </label>

            <label>
              Fitimi (%)
              <input type="number" step="0.01" value={editForm.profitPercent} onChange={(e) => onEditFormChange?.({ ...editForm, profitPercent: Number(e.target.value) })} />
            </label>
            <label>
              TVSH (%)
              <input type="number" step="0.01" value={editForm.vatPercent} onChange={(e) => onEditFormChange?.({ ...editForm, vatPercent: Number(e.target.value) })} />
            </label>
          </div>
          <div className="position-card-actions edit-form-actions">
            <button type="button" className="primary-button" onClick={onSave}>Ruaj</button>
            <button type="button" className="card" onClick={onCancel}>Anulo</button>
          </div>
          <div className="edit-form-section">
            <div className="target-controls">
              <label style={{ flex: 1 }}>
                Target total (€)
                <input type="number" step="0.01" value={targetTotal} onChange={(e) => setTargetTotal(e.target.value)} placeholder="p.sh. 20" />
              </label>
              <label>
                Mode
                <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
                  <option value="proportional">Proportional</option>
                  <option value="labor-first">Labor-first</option>
                  <option value="material-first">Material-first</option>
                </select>
              </label>
              <label className="weight-control">
                Weight
                <input type="range" min={0} max={1} step={0.05} value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
                <small>{Math.round(weight * 100)}% labor</small>
              </label>
            </div>

            <div className="edit-form-actions-inline">
              <button
                type="button"
                className="card"
                onClick={() => {
                  const qty = Number(editForm.quantity) || 0;
                  const days = Number(editForm.days) || 0;
                  const materialTotal = qty * (Number(editForm.materialPrice) || 0);
                  const laborTotal = qty * (Number(editForm.laborPrice) || 0);
                  const foodTotal = days * (Number(editForm.foodPrice) || 0);
                  const transportTotal = days * (Number(editForm.transportPrice) || 0);
                  const otherTotal = Number(editForm.otherPrice) || 0;
                  const profitPct = Number(editForm.profitPercent) || 0;
                  const vatPct = Number(editForm.vatPercent) || 18;
                  const K = (1 + profitPct / 100) * (1 + vatPct / 100);
                  const target = Number(targetTotal) || 0;
                  if (K <= 0 || qty <= 0) return;
                  const neededSubtotal = target / K;
                  const fixedOther = foodTotal + transportTotal + otherTotal;
                  let adjustableNeeded = neededSubtotal - fixedOther;
                  if (adjustableNeeded < 0) adjustableNeeded = 0;

                  let newMaterialPerUnit = Number(editForm.materialPrice) || 0;
                  let newLaborPerUnit = Number(editForm.laborPrice) || 0;

                  const adjustableCurrent = materialTotal + laborTotal;
                  if (adjustableCurrent > 0) {
                    if (mode === 'proportional') {
                      const scale = adjustableNeeded / adjustableCurrent;
                      newMaterialPerUnit = (Number(editForm.materialPrice) || 0) * scale;
                      newLaborPerUnit = (Number(editForm.laborPrice) || 0) * scale;
                    } else if (mode === 'labor-first') {
                      // allocate weight to labor first
                      const laborTargetTotal = adjustableNeeded * weight;
                      const materialTargetTotal = Math.max(0, adjustableNeeded - laborTargetTotal);
                      newLaborPerUnit = laborTargetTotal / qty;
                      newMaterialPerUnit = materialTargetTotal / qty;
                    } else if (mode === 'material-first') {
                      const materialTargetTotal = adjustableNeeded * weight;
                      const laborTargetTotal = Math.max(0, adjustableNeeded - materialTargetTotal);
                      newMaterialPerUnit = materialTargetTotal / qty;
                      newLaborPerUnit = laborTargetTotal / qty;
                    }
                  } else {
                    // fallback: adjust labor only
                    const neededLaborTotal = adjustableNeeded;
                    newLaborPerUnit = neededLaborTotal / qty;
                  }

                  const before = { materialPrice: Number(editForm.materialPrice) || 0, laborPrice: Number(editForm.laborPrice) || 0 };
                  const after = { materialPrice: Number(newMaterialPerUnit) || 0, laborPrice: Number(newLaborPerUnit) || 0 };
                  onEditFormChange?.({ ...editForm, materialPrice: Number(newMaterialPerUnit) || 0, laborPrice: Number(newLaborPerUnit) || 0 });

                  // audit
                  try {
                    pushAdjustLog({
                      source: 'position',
                      mode,
                      weight,
                      target: target,
                      before,
                      after,
                      timestamp: new Date().toISOString(),
                    });
                  } catch (e) {
                    // ignore
                  }
                }}
              >Adjust to target</button>
              <button type="button" className="card" onClick={() => setTargetTotal('')}>Clear</button>
            </div>
          </div>

          <div className="edit-form-section">
            <PricingPreview
              values={{
                quantity: Number(editForm.quantity) || 0,
                materialPrice: Number(editForm.materialPrice) || 0,
                laborPrice: Number(editForm.laborPrice) || 0,
                days: Number(editForm.days) || 0,
                foodPrice: Number(editForm.foodPrice) || 0,
                transportPrice: Number(editForm.transportPrice) || 0,
                otherPrice: Number(editForm.otherPrice) || 0,
                profitPercent: Number(editForm.profitPercent) || 0,
                vatPercent: Number(editForm.vatPercent) || 18,
              }}
              unit={editForm.unit}
            />
          </div>
        </div>
      ) : (
        <div className="position-card-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="primary-button" onClick={onEdit}>Ndrysho</button>
          {onCompareA && (
            <button type="button" className="card" onClick={onCompareA}>Krahasim A</button>
          )}
          {onCompareB && (
            <button type="button" className="card" onClick={onCompareB}>Krahasim B</button>
          )}
        </div>
      )}
    </article>
  );
}

