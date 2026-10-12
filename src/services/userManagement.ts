import { supabase } from '../lib/supabase';
import type { DbProfile, UserApprovalStatus } from '../types/database';

export async function fetchMyProfile(userId: string): Promise<DbProfile | null> {
  if (!supabase) return null;
  const request = supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000));
  const result = await Promise.race([request, timeout]);
  if (!result || !('data' in result)) return null;
  const { data, error } = result;
  if (error || !data) return null;
  return data as DbProfile;
}

export async function markApprovalNoticeSeen(): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nuk është i lidhur' };
  const { error } = await supabase.rpc('mark_approval_notice_seen');
  return { error: error?.message ?? null };
}

export async function fetchUserProfiles(): Promise<{ data: DbProfile[]; error: string | null }> {
  if (!supabase) return { data: [], error: 'Supabase nuk është i lidhur' };
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  return { data: (data || []) as DbProfile[], error: error?.message ?? null };
}

export async function updateUserApproval(
  id: string,
  status: Extract<UserApprovalStatus, 'approved' | 'rejected' | 'suspended'>,
  rejectionReason?: string
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nuk është i lidhur' };
  const { error } = await supabase
    .from('profiles')
    .update({
      status,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      rejection_reason: status === 'rejected' ? rejectionReason?.trim() || null : null,
      approval_notice_seen_at: null,
    })
    .eq('id', id);
  return { error: error?.message ?? null };
}