/**
 * /proposals/[id] — 저장된 제안서 상세 (Server Component)
 *
 *   - proposals 테이블에서 조회 (RLS 로 본인 것만)
 *   - content.proposal 을 GeneratedProposal 로 복원
 *   - 클라이언트 래퍼 ProposalDetailView 에 위임 (상태 변경 / PDF / 삭제)
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ProposalDetailView } from '@/components/proposals/ProposalDetailView';
import type { GeneratedProposal } from '@/lib/claude';
import type { ProposalStatus } from '@/app/(dashboard)/proposals/actions';

export const revalidate = 0; // 항상 최신 상태 (저장 직후 잘못된 캐시 방지)

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = await Promise.resolve(params);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('proposals')
    .select('id, title, status, content, won_at, created_at, complex_id, complexes(name)')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  type Row = {
    id: string;
    title: string | null;
    status: string;
    content: {
      proposal?: GeneratedProposal;
      input?: {
        complex?: { name?: string; address?: string };
        userCompany?: { name?: string; owner?: string };
        workScope?: { scope?: string };
      };
    } | null;
    won_at: string | null;
    created_at: string;
    complex_id: string | null;
    complexes: { name: string } | { name: string }[] | null;
  };
  const row = data as unknown as Row;

  if (!row.content?.proposal) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        제안서 데이터가 손상되었습니다. (content.proposal 누락)
      </div>
    );
  }

  const complexFromJoin = Array.isArray(row.complexes) ? row.complexes[0] : row.complexes;
  const complexName = complexFromJoin?.name ?? row.content.input?.complex?.name ?? '(단지 정보 없음)';
  const companyName = row.content.input?.userCompany?.name ?? '';
  const ownerName = row.content.input?.userCompany?.owner ?? '';
  const workScope = row.content.input?.workScope?.scope ?? '';

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href="/proposals"
        className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-[#0F4C8A]"
      >
        <ArrowLeft size={12} />
        제안서 목록으로
      </Link>

      <ProposalDetailView
        id={row.id}
        proposal={row.content.proposal}
        status={(row.status as ProposalStatus) ?? 'draft'}
        complexName={complexName}
        companyName={companyName}
        ownerName={ownerName}
        workScope={workScope}
        createdAt={row.created_at}
        wonAt={row.won_at}
      />
    </div>
  );
}
