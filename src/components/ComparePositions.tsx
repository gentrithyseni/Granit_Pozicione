import { useMemo } from 'react';
import type { DbProjectItem } from '../types/database';
import { formatDateTime } from '../lib/dates';

type ItemWithMeta = DbProjectItem & {
  projects?: { name: string } | null;
  categories?: { name: string } | null;
};

type Props = {
  items: ItemWithMeta[];
  slotA: string;
  slotB: string;
  onSlotA: (id: string) => void;
  onSlotB: (id: string) => void;
};

function labelFor(item: ItemWithMeta) {
  const project = item.projects?.name || 'Projekt';
  const cat = item.categories?.name ? ` · ${item.categories.name}` : '';
  const desc = item.description.slice(0, 40);
  return `${project}${cat} — ${desc} — ${Number(item.total_price).toFixed(2)}€`;
}

function CompareColumn({ item, other }: { item: ItemWithMeta; other?: ItemWithMeta }) {
  const diffTotal = other ? Number(item.total_price) - Number(other.total_price) : null;
  const diffUnit = other ? Number(item.unit_price) - Number(other.unit_price) : null;

  return (
    <div className="compare-column">
      <h4 className="compare-column-title">{item.projects?.name || 'Projekt'}</h4>
      <p className="muted">{item.categories?.name || 'Pa kategori'}</p>
      <dl className="compare-dl">
        <dt>Përshkrimi</dt>
        <dd>{item.description}</dd>
        <dt>Sasia</dt>
        <dd>{item.quantity} {item.unit}</dd>
        <dt>Çmimi / njësi</dt>
        <dd>
          {Number(item.unit_price).toFixed(2)} €
          {diffUnit !== null && diffUnit !== 0 && (
            <span className={diffUnit > 0 ? 'diff-up' : 'diff-down'}>
              {' '}({diffUnit > 0 ? '+' : ''}{diffUnit.toFixed(2)} € vs tjetri)
            </span>
          )}
        </dd>
        <dt>Totali</dt>
        <dd className="compare-total">
          {Number(item.total_price).toFixed(2)} €
          {diffTotal !== null && diffTotal !== 0 && (
            <span className={diffTotal > 0 ? 'diff-up' : 'diff-down'}>
              {' '}({diffTotal > 0 ? '+' : ''}{diffTotal.toFixed(2)} €)
            </span>
          )}
        </dd>
        <dt>Krijuar</dt>
        <dd>{formatDateTime(item.created_at)}</dd>
        <dt>Përditësuar</dt>
        <dd>{formatDateTime(item.updated_at)}</dd>
      </dl>
    </div>
  );
}

export function ComparePositions({ items, slotA, slotB, onSlotA, onSlotB }: Props) {
  const itemA = useMemo(() => items.find((i) => i.id === slotA), [items, slotA]);
  const itemB = useMemo(() => items.find((i) => i.id === slotB), [items, slotB]);

  return (
    <div className="panel compare-panel">
      <h3 className="panel-heading-accent">Krahaso dy pozicione (oferta)</h3>
      <p className="muted compare-hint">
        Zgjidh dy rreshta nga projekte të ndryshme (p.sh. Pllaka në Qkuk vs Pllaka në Polici) për të parë dallimin e çmimit.
      </p>
      <div className="compare-selects">
        <label>
          Pozicioni A
          <select value={slotA} onChange={(e) => onSlotA(e.target.value)}>
            <option value="">— Zgjidh —</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{labelFor(item)}</option>
            ))}
          </select>
        </label>
        <label>
          Pozicioni B
          <select value={slotB} onChange={(e) => onSlotB(e.target.value)}>
            <option value="">— Zgjidh —</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{labelFor(item)}</option>
            ))}
          </select>
        </label>
      </div>

      {itemA && itemB && itemA.id !== itemB.id ? (
        <div className="compare-columns">
          <CompareColumn item={itemA} other={itemB} />
          <CompareColumn item={itemB} other={itemA} />
        </div>
      ) : (
        <p className="muted">Zgjidh dy pozicione të ndryshme për krahasim.</p>
      )}
    </div>
  );
}
