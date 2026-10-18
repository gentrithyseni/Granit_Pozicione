import { supabase } from '../lib/supabase';
import type { ParsedRow } from '../lib/excel';
import {
  planLibriExport,
  restoreLibriExportPlan,
  serializeLibriExportPlan,
  type StoredLibriExportPlanPage,
} from '../lib/libriExportPlan';
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
  pageLayout: StoredLibriExportPlanPage[] | null;
  manualPageLayout: StoredLibriExportPlanPage[] | null;
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
  const { __libriPageLayout, __libriManualPageLayout, ...meta } = row.meta || {};
  const rows = row.rows as unknown as ParsedRow[];
  const restoredPlan = restoreLibriExportPlan(__libriPageLayout, rows);
  const restoredManualPlan = restoreLibriExportPlan(__libriManualPageLayout, rows) ?? restoredPlan;
  return {
    id: row.id,
    fileName: row.file_name,
    positionsCount: row.positions_count,
    totalValue: Number(row.total_value) || 0,
    meta: meta as unknown as ParamasaPreviewMeta,
    pageLayout: restoredPlan ? serializeLibriExportPlan(restoredPlan, rows) : null,
    manualPageLayout: restoredManualPlan ? serializeLibriExportPlan(restoredManualPlan, rows) : null,
    rows,
    createdAt: row.created_at,
  };
}

function getPagesCount(rows: ParsedRow[] | undefined | null, pageLayout?: StoredLibriExportPlanPage[] | null): number {
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  const validRows = rows.filter((row): row is ParsedRow => Boolean(row) && typeof row === 'object' && 'position_number' in row);
  if (validRows.length === 0) return rows.length;

  const restoredPlan = restoreLibriExportPlan(pageLayout, validRows);
  if (restoredPlan) return restoredPlan.length;

  try {
    return planLibriExport(validRows).length;
  } catch {
    return Math.max(validRows.length, 0);
  }
}

/** Ruani të dhënat e paramasës dhe ktheni identifikuesin për lidhjen e ndarjes manuale. */
export async function saveLibriExportRecord(fileName: string, rows: ParsedRow[], meta: ParamasaPreviewMeta): Promise<string | null> {
  if (!supabase) return null;
  const totalValue = rows.reduce((sum, row) => sum + (Number(row.total_price) || 0), 0);
  const id = crypto.randomUUID();
  const { error } = await supabase.from('libri_exports').insert([
    {
      id,
      file_name: fileName,
      positions_count: rows.length,
      total_value: Number(totalValue.toFixed(2)),
      meta,
      rows,
    },
  ]);
  if (error) throw error;
  invalidateCache(LIBRI_EXPORTS_CACHE_KEY);
  return id;
}

export async function saveLibriExportPageLayout(
  id: string,
  meta: ParamasaPreviewMeta,
  pageLayout: StoredLibriExportPlanPage[] | null,
  manualPageLayout: StoredLibriExportPlanPage[] | null = pageLayout
): Promise<void> {
  if (!supabase) throw new Error('Supabase nuk është i lidhur.');
  const storedMeta = {
    ...meta,
    __libriPageLayout: pageLayout,
    __libriManualPageLayout: manualPageLayout,
  };
  const { data, error } = await supabase
    .from('libri_exports')
    .update({ meta: storedMeta })
    .eq('id', id)
    .select('id')
    .single();
  if (error) throw error;
  if (!data?.id) throw new Error('Ndarja e faqeve nuk u ruajt në regjistrin e Librit.');
  invalidateCache(LIBRI_EXPORTS_CACHE_KEY);
}

export function summarizeLibriExportRecords(records: LibriExportRecord[]): LibriDashboardSummary {
  const byBook = [...records]
    .sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0))
    .map((record) => ({
      id: record.id,
      fileName: record.fileName,
      positionsCount: Number(record.positionsCount) || 0,
      pagesCount: getPagesCount(record.rows, record.pageLayout),
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
      if (error) throw new Error(`Historiku i Librit nuk u ngarkua: ${error.message}`);
      if (!data) throw new Error('Databaza nuk ktheu të dhëna për historikun e Librit.');
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
