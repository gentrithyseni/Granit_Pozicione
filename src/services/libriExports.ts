import { supabase } from '../lib/supabase';
import type { ParsedRow } from '../lib/excel';
import { planLibriExport } from '../lib/libriExportPlan';
import { getCached, invalidateCache } from '../lib/cache';
import type { ParamasaPreviewMeta } from '../types/paramasaMeta';
import type { DbLibriExport } from '../types/database';

const LIBRI_EXPORTS_CACHE_KEY = 'libri-exports';
const LIBRI_EXPORTS_CACHE_TTL_MS = 2 * 60 * 1000;

export type LibriExportRecord = {
  id: string;
  fileName: string;
  positionsCount: number;
  totalValue: number;
  meta: ParamasaPreviewMeta;
  rows: ParsedRow[];
  createdAt: string;
};

export type LibriSummaryBook = {
  id: string;
  fileName: string;
  positionsCount: number;
  pagesCount: number;
  totalValue: number;
  createdAt: string;
};

export type LibriDashboardSummary = {
  totalBooks: number;
  totalEntries: number;
  averageEntriesPerBook: number;
  totalValue: number;
  byBook: LibriSummaryBook[];
};

function mapRecord(row: DbLibriExport): LibriExportRecord {
  return {
    id: row.id,
    fileName: row.file_name,
    positionsCount: row.positions_count,
    totalValue: Number(row.total_value) || 0,
    meta: row.meta as unknown as ParamasaPreviewMeta,
    rows: row.rows as unknown as ParsedRow[],
    createdAt: row.created_at,
  };
}

function getPagesCount(rows: ParsedRow[] | undefined | null): number {
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  const validRows = rows.filter((row): row is ParsedRow => Boolean(row) && typeof row === 'object' && 'position_number' in row);
  if (validRows.length === 0) return rows.length;

  try {
    return planLibriExport(validRows).length;
  } catch {
    return Math.max(validRows.length, 0);
  }
}

/** Ruan një "libër ndërtimor" të analizuar (rows + meta), për t'u rishkarkuar më vonë pa
 * ringarkuar skedarin origjinal. Thirret çdo herë që një paramasë analizohet me sukses,
 * jo vetëm kur shkarkohet — dështon në heshtje nëse tabela s'ekziston ende (migrim i pa bërë). */
export async function saveLibriExportRecord(fileName: string, rows: ParsedRow[], meta: ParamasaPreviewMeta): Promise<void> {
  if (!supabase) return;
  const totalValue = rows.reduce((sum, row) => sum + (Number(row.total_price) || 0), 0);
  try {
    const { error } = await supabase.from('libri_exports').insert([
      {
        file_name: fileName,
        positions_count: rows.length,
        total_value: Number(totalValue.toFixed(2)),
        meta,
        rows,
      },
    ]);
    if (!error) invalidateCache(LIBRI_EXPORTS_CACHE_KEY);
  } catch {
    // tabela libri_exports mund të mos ekzistojë ende (migrim i pa ekzekutuar) — s'duam ta
    // ndalojmë rrjedhën kryesore të importit për këtë.
  }
}

export function summarizeLibriExportRecords(records: LibriExportRecord[]): LibriDashboardSummary {
  const byBook = [...records]
    .sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0))
    .map((record) => ({
      id: record.id,
      fileName: record.fileName,
      positionsCount: Number(record.positionsCount) || 0,
      pagesCount: getPagesCount(record.rows),
      totalValue: Number(record.totalValue) || 0,
      createdAt: record.createdAt,
    }));

  const totalEntries = byBook.reduce((sum, item) => sum + item.positionsCount, 0);
  const totalValue = byBook.reduce((sum, item) => sum + item.totalValue, 0);
  const averageEntriesPerBook = byBook.length > 0 ? totalEntries / byBook.length : 0;

  return {
    totalBooks: byBook.length,
    totalEntries,
    averageEntriesPerBook,
    totalValue,
    byBook,
  };
}

export async function fetchLibriExportRecords(): Promise<LibriExportRecord[]> {
  if (!supabase) return [];
  const client = supabase;
  return getCached(
    LIBRI_EXPORTS_CACHE_KEY,
    async () => {
      const { data, error } = await client.from('libri_exports').select('*').order('created_at', { ascending: false }).limit(50);
      if (error || !data) return [];
      return (data as DbLibriExport[]).map(mapRecord);
    },
    LIBRI_EXPORTS_CACHE_TTL_MS
  );
}

export async function deleteLibriExportRecord(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('libri_exports').delete().eq('id', id);
  if (!error) invalidateCache(LIBRI_EXPORTS_CACHE_KEY);
}