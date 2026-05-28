import type { DbProjectItem } from '../types/database';

type Group = {
  projectId: string;
  projectName: string;
  items: DbProjectItem[];
  subtotal: number;
};

export function CategoryProjectCompare({ groups, categoryName }: { groups: Group[]; categoryName: string }) {
  if (groups.length < 2) return null;

  const sorted = [...groups].sort((a, b) => b.subtotal - a.subtotal);
  const reference = sorted[0]?.subtotal ?? 0;

  return (
    <div className="panel category-compare-panel">
      <h3 className="panel-title">Krahasim ofertash: {categoryName}</h3>
      <p className="muted">Çmimi final i kësaj kategorie në çdo projekt (p.sh. Qkuk vs Polici).</p>
      <table className="import-table">
        <thead>
          <tr className="import-table-head-row">
            <th>Projekti</th>
            <th>Pozicione</th>
            <th>Ëmes. / njësi</th>
            <th>Totali kategorie</th>
            <th>Dallimi</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((group) => {
            const avgUnit =
              group.items.length > 0
                ? group.items.reduce((s, i) => s + Number(i.unit_price), 0) / group.items.length
                : 0;
            const diff = group.subtotal - reference;
            return (
              <tr key={group.projectId} className="import-table-body-row">
                <td className="import-table-cell"><strong>{group.projectName}</strong></td>
                <td>{group.items.length}</td>
                <td>{avgUnit.toFixed(2)} €</td>
                <td className="col-bold">{group.subtotal.toLocaleString('de-DE')} €</td>
                <td className={diff === 0 ? 'diff-neutral' : diff > 0 ? 'diff-up' : 'diff-down'}>
                  {diff === 0 ? 'më i larti' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('de-DE')} €`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
