import { VictoryAxis, VictoryBar, VictoryChart, VictoryContainer, VictoryPie, VictoryTheme } from 'victory';
import type { CategorySummary, ProjectSummary } from '../types/database';

const emerald = '#10b981';
const emeraldLight = '#6ee7b7';

type Props = {
  projectSummaries: ProjectSummary[];
  categorySummaries: CategorySummary[];
};

export function InsightsCharts({ projectSummaries, categorySummaries }: Props) {
  if (projectSummaries.length === 0 && categorySummaries.length === 0) {
    return <p className="muted chart-empty">Shto të dhëna për grafikët.</p>;
  }

  return (
    <div className="charts-row">
      {projectSummaries.length > 0 && (
        <div className="chart-panel panel">
          <h3 className="chart-title">Vlera sipas projektit (€)</h3>
          <VictoryChart
            theme={VictoryTheme.material}
            domainPadding={{ x: 24 }}
            height={220}
            containerComponent={<VictoryContainer responsive={false} />}
          >
            <VictoryAxis tickFormat={() => ''} style={{ axis: { stroke: 'transparent' } }} />
            <VictoryAxis dependentAxis style={{ tickLabels: { fontSize: 10, fill: 'var(--muted)' }, grid: { stroke: 'var(--border)' } }} />
            <VictoryBar
              data={projectSummaries.map((p) => ({ x: p.name.slice(0, 12), y: p.total }))}
              style={{ data: { fill: emerald, width: 28 }, labels: { fontSize: 9, fill: emeraldLight } }}
              labels={({ datum }) => `${Math.round(datum.y / 1000)}k`}
            />
          </VictoryChart>
        </div>
      )}

      {categorySummaries.length > 0 && (
        <div className="chart-panel panel">
          <h3 className="chart-title">Pozicione sipas kategorisë</h3>
          <VictoryPie
            height={220}
            innerRadius={50}
            padAngle={2}
            colorScale={[emerald, '#059669', '#34d399', '#047857', '#a7f3d0', '#064e3b']}
            data={categorySummaries.map((c) => ({ x: c.name, y: c.count }))}
            labels={({ datum }) => `${datum.x}: ${datum.y}`}
            style={{ labels: { fontSize: 9, fill: 'var(--text)' } }}
          />
        </div>
      )}
    </div>
  );
}
