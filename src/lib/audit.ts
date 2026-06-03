export type AdjustLog = {
  source: 'register' | 'position';
  mode: 'proportional' | 'labor-first' | 'material-first';
  weight?: number; // fraction applied to labor (0..1)
  target: number;
  before: Record<string, number>;
  after: Record<string, number>;
  timestamp: string;
};

const LOCAL_KEY = 'graniti_adjust_logs_v1';

export function readAdjustLogs(): AdjustLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AdjustLog[];
  } catch (e) {
    console.error('readAdjustLogs error', e);
    return [];
  }
}

export function pushAdjustLog(entry: AdjustLog) {
  try {
    const logs = readAdjustLogs();
    logs.push(entry);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('pushAdjustLog error', e);
  }
}

export function clearAdjustLogs() {
  localStorage.removeItem(LOCAL_KEY);
}

export default { readAdjustLogs, pushAdjustLog, clearAdjustLogs };
