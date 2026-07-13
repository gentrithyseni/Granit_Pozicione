import { VictoryAxis, VictoryBar, VictoryChart, VictoryContainer, VictoryPie, VictoryTheme, VictoryLabel } from 'victory';
import type { CategorySummary, ProjectSummary } from '../types/database';

const emerald = '#10b981';
const categoryColors = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#6366f1'];

type Props = {
  projectSummaries: ProjectSummary[];
  categorySummaries: CategorySummary[];
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

export function InsightsCharts({ projectSummaries, categorySummaries }: Props) {
  if (projectSummaries.length === 0 && categorySummaries.length === 0) {
    return <p className="muted chart-empty">Shto te dhena per grafiket.</p>;
  }

  const sortedProjects = [...projectSummaries].sort((a, b) => b.total - a.total).slice(0, 8);
  const sortedCategories = [...categorySummaries].sort((a, b) => b.count - a.count);
  const sortedCategoriesByValue = [...categorySummaries].sort((a, b) => b.total - a.total);
  const totalProjectValue = projectSummaries.reduce((sum, project) => sum + project.total, 0);
  const totalCategoryValue = categorySummaries.reduce((sum, category) => sum + category.total, 0);
  const totalCategoryCount = categorySummaries.reduce((sum, c) => sum + c.count, 0);
  const topProject = sortedProjects[0];
  const topCategoryByValue = sortedCategoriesByValue[0];
  const averageProjectValue = projectSummaries.length > 0 ? totalProjectValue / projectSummaries.length : 0;
  const topProjectShare = topProject && totalProjectValue > 0 ? Math.round((topProject.total / totalProjectValue) * 100) : 0;

  return (
    <>
      <div className="insight-metric-grid">
        <div className="insight-metric">
          <span className="muted">Vlera ne projekte</span>
          <strong>{totalProjectValue.toLocaleString('sq-AL', { maximumFractionDigits: 0 })}€</strong>
          <small>{projectSummaries.length} projekte me vlere</small>
        </div>
        <div className="insight-metric">
          <span className="muted">Mesatarja per projekt</span>
          <strong>{averageProjectValue.toLocaleString('sq-AL', { maximumFractionDigits: 0 })}€</strong>
          <small>per projekte aktive ne statistika</small>
        </div>
        <div className="insight-metric">
          <span className="muted">Koncentrimi kryesor</span>
          <strong>{topProjectShare}%</strong>
          <small>{topProject ? truncate(topProject.name, 28) : 'Pa projekt'}</small>
        </div>
        <div className="insight-metric">
          <span className="muted">Kategoria me vlere</span>
          <strong>{topCategoryByValue ? truncate(topCategoryByValue.name, 20) : '-'}</strong>
          <small>{topCategoryByValue ? `${topCategoryByValue.total.toLocaleString('sq-AL', { maximumFractionDigits: 0 })}€` : 'Pa te dhena'}</small>
        </div>
      </div>

      <div className="charts-row">
        {sortedProjects.length > 0 && (
          <div className="chart-panel panel">
            <h3 className="chart-title">Vlera sipas projektit (€)</h3>
            <p className="muted chart-subtitle">
              {sortedProjects.length < projectSummaries.length
                ? `Top ${sortedProjects.length} nga ${projectSummaries.length} projekte, sipas vleres.`
                : 'Te gjitha projektet, renditur sipas vleres.'}
            </p>
            <VictoryChart
              theme={VictoryTheme.material}
              width={300}
              height={250}
              domainPadding={{ x: 18 }}
              padding={{ top: 24, bottom: 64, left: 54, right: 12 }}
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
                data={sortedProjects.map((p) => ({ x: truncate(p.name, 14), y: p.total }))}
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

        {sortedCategoriesByValue.length > 0 && (
          <div className="chart-panel panel">
            <h3 className="chart-title">Vlera sipas kategorise (€)</h3>
            <p className="muted chart-subtitle">Tregon kategorite qe peshojne me shume ne buxhetin total.</p>
            <VictoryChart
              theme={VictoryTheme.material}
              width={300}
              height={250}
              domainPadding={{ x: 16 }}
              padding={{ top: 24, bottom: 64, left: 54, right: 12 }}
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
                data={sortedCategoriesByValue.map((c) => ({ x: truncate(c.name, 14), y: c.total }))}
                style={{ data: { fill: '#3b82f6' } }}
                labels={({ datum }: { datum: { y: number } }) => `${datum.y.toLocaleString('sq-AL', { maximumFractionDigits: 0 })}€`}
                labelComponent={<VictoryLabel dy={-8} style={{ fontSize: 9, fontWeight: 700, fill: '#3b82f6' }} />}
              />
            </VictoryChart>
            <div className="chart-legend-list">
              {sortedCategoriesByValue.map((c) => (
                <div key={c.id} className="chart-legend-row">
                  <span>{c.name}</span>
                  <span className="muted">{totalCategoryValue > 0 ? Math.round((c.total / totalCategoryValue) * 100) : 0}%</span>
                  <strong>{c.total.toLocaleString('sq-AL', { maximumFractionDigits: 0 })}€</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {sortedCategories.length > 0 && (
          <div className="chart-panel panel">
            <h3 className="chart-title">Pozicione sipas kategorise</h3>
            <p className="muted chart-subtitle">{totalCategoryCount} pozicione gjithsej, ne {sortedCategories.length} kategori.</p>
            <VictoryPie
              width={320}
              height={220}
              innerRadius={52}
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
    </>
  );
}
