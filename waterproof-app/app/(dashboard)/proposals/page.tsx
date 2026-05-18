/**
 * /proposals — 내 제안서 관리 (Server Component)
 *
 * Stitch 디자인 반영:
 *   - 큰 헤딩 "제안서 관리"
 *   - 알약 칩 필터 (전체 / 검토중 / 발송완료 / 낙찰)
 *   - 카드 1열 — 좌측 컬러바 + 제안 금액 강조
 *   - 우측 하단 FAB (+ 버튼 → /proposals/new)
 */

import Link from "next/link";
import { Plus, FileText, ArrowDownUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProposalStatusFilter } from "@/components/proposals/ProposalStatusFilter";
import { ProposalCard } from "@/components/proposals/ProposalCard";

export const revalidate = 30;

const VALID_STATUSES = ["draft", "sent", "won", "lost"];

type SearchParams = { status?: string };

export default async function ProposalsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const sp = await Promise.resolve(searchParams);
  const status = VALID_STATUSES.includes(sp.status ?? "") ? sp.status! : "";

  const supabase = await createClient();

  let query = supabase
    .from("proposals")
    .select("id, title, status, content, won_at, created_at, complex_id, complexes(name, address)", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;

  if (error) {
    return (
      <div className="mx-auto max-w-md p-5">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          제안서 목록을 불러오지 못했습니다: {error.message}
        </div>
      </div>
    );
  }

  type Row = {
    id: string;
    title: string | null;
    status: string;
    content: {
      proposal?: { summary?: string };
      input?: {
        complex?: { name?: string; address?: string };
        workScope?: { estimatedBudget?: number };
      };
    } | null;
    won_at: string | null;
    created_at: string;
    complex_id: string | null;
    complexes: { name: string; address: string | null } | { name: string; address: string | null }[] | null;
  };
  const rows = ((data ?? []) as unknown) as Row[];
  const total = count ?? 0;

  return (
    <div className="mx-auto w-full max-w-md px-6 pt-6 pb-6 lg:max-w-2xl">
      {/* 헤더 */}
      <div className="mb-6 flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-on-surface sm:text-3xl">제안서 관리</h2>
      </div>

      {/* 필터 */}
      <ProposalStatusFilter currentStatus={status} />

      {/* 요약 + 정렬 */}
      <div className="mt-4 mb-4 flex items-center justify-between px-1">
        <p className="text-sm text-on-surface">
          총 <span className="font-bold text-accent">{total.toLocaleString()}</span>건
        </p>
        <div className="flex cursor-pointer items-center gap-1 text-on-surface">
          <ArrowDownUp size={14} />
          <span className="text-sm font-medium">최신순</span>
        </div>
      </div>

      {/* 리스트 */}
      {rows.length === 0 ? (
        <EmptyState hasFilter={!!status} />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {rows.map((p) => {
            const cx = Array.isArray(p.complexes) ? p.complexes[0] : p.complexes;
            const complexName = cx?.name ?? p.content?.input?.complex?.name ?? "단지 미상";
            const address = cx?.address ?? p.content?.input?.complex?.address ?? null;
            const amount = p.content?.input?.workScope?.estimatedBudget ?? null;
            return (
              <ProposalCard
                key={p.id}
                id={p.id}
                title={p.title ?? "(제목 없음)"}
                complexName={complexName}
                address={address}
                status={p.status}
                createdAt={p.created_at}
                wonAt={p.won_at}
                amount={amount}
              />
            );
          })}
        </div>
      )}

      {/* FAB — 우측 하단 (모바일 nav 위에 위치) */}
      <Link
        href="/proposals/new"
        className="fixed bottom-[96px] right-6 z-40 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-xl shadow-accent/30 transition-transform hover:scale-110 active:scale-95 md:bottom-6"
        aria-label="새 제안서 작성"
      >
        <Plus size={28} />
      </Link>
    </div>
  );
}

// ============================================================
function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100">
        <FileText size={24} className="text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-on-surface">
        {hasFilter ? "이 상태의 제안서가 없습니다" : "아직 만든 제안서가 없습니다"}
      </h3>
      <p className="mt-1 text-xs text-on-surface-var">
        {hasFilter
          ? "다른 상태를 선택하거나 새 제안서를 만들어보세요."
          : "단지 정보와 공사 범위만 입력하면 30초 내에 AI 가 작성합니다."}
      </p>
      <Link
        href="/proposals/new"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <Plus size={14} />
        제안서 만들기
      </Link>
    </div>
  );
}
