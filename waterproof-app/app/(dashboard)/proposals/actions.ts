'use server';

/**
 * 제안서 Server Actions
 *   - saveProposal:      신규 저장 (draft 상태)
 *   - updateStatus:      상태 변경 (draft / sent / won / lost)
 *   - deleteProposal:    삭제
 */

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { GeneratedProposal } from '@/lib/claude';

export type SaveProposalInput = {
  proposal: GeneratedProposal;
  complex: {
    name: string;
    address?: string;
    built_year: number;
    households: number;
  };
  userCompany: { name: string; owner: string };
  workScope: { scope: string; areaSqm?: number; estimatedBudget?: number };
};

export type SaveProposalResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function saveProposal(input: SaveProposalInput): Promise<SaveProposalResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다.' };

  // 단지 매칭 시도 — 같은 이름의 단지가 있으면 연결, 없으면 null
  let complexId: string | null = null;
  const { data: matched } = await supabase
    .from('complexes')
    .select('id')
    .ilike('name', input.complex.name)
    .limit(1);
  if (matched && (matched as unknown as { id: string }[]).length) {
    complexId = (matched as unknown as { id: string }[])[0].id;
  }

  // proposals 테이블은 RLS 가 켜져 있으므로 본인 user_id 로 INSERT 가능
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('proposals') as any).insert({
    user_id: user.id,
    complex_id: complexId,
    title: input.proposal.title,
    status: 'draft',
    content: {
      proposal: input.proposal,
      input: {
        complex: input.complex,
        userCompany: input.userCompany,
        workScope: input.workScope,
      },
    },
  }).select('id').single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? '저장 실패' };
  }

  revalidatePath('/proposals');
  return { ok: true, id: (data as { id: string }).id };
}

// ============================================================

export type ProposalStatus = 'draft' | 'sent' | 'won' | 'lost';

export async function updateProposalStatus(id: string, status: ProposalStatus): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다.' };

  const updates: Record<string, unknown> = { status };
  if (status === 'won') updates.won_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('proposals') as any)
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/proposals');
  revalidatePath('/dashboard');
  return { ok: true };
}

// ============================================================

export async function deleteProposal(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다.' };

  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/proposals');
  return { ok: true };
}
