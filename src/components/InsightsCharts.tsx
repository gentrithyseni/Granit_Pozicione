import { VictoryAxis, VictoryBar, VictoryChart, VictoryContainer, VictoryPie, VictoryTheme, VictoryLabel } from 'victory';
import type { CategorySummary, ProjectSummary } from '../types/database';

const emerald = '#10b981';
// Paleta e mëparshme ishte vetëm nuanca jeshile (vështirë të dallohen mes tyre në një grafik
// me disa kategori) — kjo përdor ngjyra me hue të ndryshëm, duke ruajtur jeshilen si të parën
// (për konsistencë me temën) por pjesa tjetër qartazi e dallueshme.
const categoryColors = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#6366f1'];

type Props = {
  projectSummaries: ProjectSummary[];
  categorySummaries: CategorySummary[];
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function InsightsCharts({ projectSummaries, categorySummaries }: Props) {
  if (projectSummaries.length === 0 && categorySummaries.length === 0) {
    return <p className="muted chart-empty">Shto të dhëna për grafikët.</p>;
  }

  const sortedProjects = [...projectSummaries].sort((a, b) => b.total - a.total).slice(0, 8);
  const totalCategoryCount = categorySummaries.reduce((sum, c) => sum + c.count, 0);
  const sortedCategories = [...categorySummaries].sort((a, b) => b.count - a.count);

  return (
    <div className="charts-row">
      {sortedProjects.length > 0 && (
        <div className="chart-panel panel">
          <h3 className="chart-title">Vlera sipas projektit (€)</h3>
          <p className="muted chart-subtitle">
            {sortedProjects.length < projectSummaries.length
              ? `Top ${sortedProjects.length} nga ${projectSummaries.length} projekte, sipas vlerës.`
              : 'Të gjitha projektet, renditur sipas vlerës.'}
          </p>
          <VictoryChart
            theme={VictoryTheme.material}
            width={280}
            height={220}
            domainPadding={{ x: 18 }}
            padding={{ top: 20, bottom: 60, left: 50, right: 10 }}
            containerComponent={<VictoryContainer responsive={false} />}
          >
            <VictoryAxis
              tickFormat={(t: string) => truncate(t, 10)}
              style={{ tickLabels: { fontSize: 9, angle: -35, textAnchor: 'end' } }}
            />
            <VictoryAxis
              dependentAxis
              tickFormat={(t: number) => `${(t / 1000).toFixed(t >= 1000 ? 0 : 1)}k€`}
              style={{ tickLabels: { fontSize: 10, fill: 'var(--muted)' }, grid: { stroke: 'var(--border)' } }}
            />
            <VictoryBar
              data={sortedProjects.map((p) => ({ x: truncate(p.name, 14), y: p.total, fullName: p.name }))}
              style={{ data: { fill: emerald } }}
              labels={({ datum }: { datum: { y: number } }) => `${datum.y.toLocaleString('sq-AL', { maximumFractionDigits: 0 })}€`}
              labelComponent={<VictoryLabel dy={-8} style={{ fontSize: 9, fontWeight: 700, fill: emerald }} />}
            />
          </VictoryChart>
          <div className="chart-legend-list">
            {sortedProjects.map((p) => (
              <div key={p.id} className="chart-legend-row">
                <span>{p.name}</span>
                <strong>{p.total.toLocaleString('sq-AL', { maximumFractionDigits: 0 })}€</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {sortedCategories.length > 0 && (
        <div className="chart-panel panel">
          <h3 className="chart-title">Pozicione sipas kategorisë</h3>
          <p className="muted chart-subtitle">{totalCategoryCount} pozicione gjithsej, në {sortedCategories.length} kategori.</p>
          <VictoryPie
            width={280}
            height={200}
            innerRadius={45}
            padAngle={2}
            colorScale={categoryColors}
            data={sortedCategories.map((c) => ({ x: '', y: c.count }))}
            labels={() => ''}
            containerComponent={<VictoryContainer responsive={false} />}
          />
          <div className="chart-legend-list">
            {sortedCategories.map((c, i) => (
              <div key={c.id} className="chart-legend-row">
                <span className="chart-legend-label">
                  <span className="chart-legend-dot" style={{ background: categoryColors[i % categoryColors.length] }} />
                  {c.name}
                </span>
                <span className="muted">{totalCategoryCount > 0 ? Math.round((c.count / totalCategoryCount) * 100) : 0}%</span>
                <strong>{c.count}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}