/**
 * /alerts — 알림 센터 (Server Component)
 *
 * Stitch 디자인 반영:
 *   - 상단: 발주Up + 알림 + 모두 읽음 / 알림 설정
 *   - 요약 카운트 3종 (읽지않음 / 신규입찰 / 피드백)
 *   - 카테고리 칩 (전체 / 비즈니스 기회 / 제안서 관리 / 시스템)
 *   - 알림 리스트 — 24시간 이내는 안읽음 (강조), 그 이상은 읽음 (희미)
 *   - 안내 로딩 표시
 */

import Link from "next/link";
import { CheckCheck, BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AlertFilters } from "@/components/alerts/AlertFilters";
import { AlertCard, type AlertCategory } from "@/components/alerts/AlertCard";

export const revalidate = 30;

const VALID_TYPES = ["bid", "won", "system"];

type SearchParams = { type?: string };

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const sp = await Promise.resolve(searchParams);
  const filterType = VALID_TYPES.includes(sp.type ?? "") ? sp.type! : "";

  const supabase = await createClient();
  const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [bidsRes, wonsRes] = await Promise.all([
    supabase
      .from("bid_announcements")
      .select("id, title, work_type, deadline_at, announced_at, estimated_amount, complex_id, complexes(name, sigungu)")
      .gte("announced_at", SEVEN_DAYS_AGO)
      .order("announced_at", { ascending: false })
      .limit(30),
    supabase
      .from("proposals")
      .select("id, title, status, won_at, complex_id, complexes(name)")
      .eq("status", "won")
      .not("won_at", "is", null)
      .order("won_at", { ascending: false })
      .limit(30),
  ]);

  type BidRow = {
    id: string; title: string | null; work_type: string | null;
    deadline_at: string | null; announced_at: string | null;
    estimated_amount: number | null;
    complex_id: string;
    complexes: { name: string; sigungu: string | null } | { name: string; sigungu: string | null }[] | null;
  };
  type WonRow = {
    id: string; title: string | null; won_at: string | null;
    complex_id: string;
    complexes: { name: string } | { name: string }[] | null;
  };

  const now = Date.now();
  const ONE_DAY_MS = 86_400_000;

  type Item = {
    id: string;
    category: AlertCategory;
    title: string;
    message: string;
    timeAgo: string;
    href: string;
    sortKey: number;
    unread: boolean;
  };

  const bidItems: Item[] = (((bidsRes.data ?? []) as unknown) as BidRow[]).map((b) => {
    const cx = Array.isArray(b.complexes) ? b.complexes[0] : b.complexes;
    const region = cx?.sigungu ? `${cx.sigungu} ` : "";
    const eok = b.estimated_amount ? ` 추정 공사비 ${(b.estimated_amount / 100_000_000).toFixed(1)}억 규모의` : "";
    const t = b.announced_at ? new Date(b.announced_at).getTime() : 0;
    return {
      id: "b-" + b.id,
      category: "bid",
      title: `${region}${cx?.name ?? "단지"} ${b.work_type ?? "공사"} 입찰 공고`,
      message: `${eok ? eok.trim() + " 입찰이 게시되었습니다." : "입찰 공고가 게시되었습니다."}${b.deadline_at ? ` 마감 ${b.deadline_at}` : ""}`,
      timeAgo: relativeTime(b.announced_at),
      href: `/complexes/${b.complex_id}`,
      sortKey: t,
      unread: now - t < ONE_DAY_MS,
    };
  });

  const wonItems: Item[] = (((wonsRes.data ?? []) as unknown) as WonRow[]).map((p) => {
    const cx = Array.isArray(p.complexes) ? p.complexes[0] : p.complexes;
    const t = p.won_at ? new Date(p.won_at).getTime() : 0;
    return {
      id: "w-" + p.id,
      category: "proposal",
      title: `${cx?.name ?? "단지"} 제안서 수주 성공`,
      message: `${p.title ?? "제안서"}가 수주로 확정되었습니다.`,
      timeAgo: relativeTime(p.won_at),
      href: `/proposals/${p.id}`,
      sortKey: t,
      unread: now - t < ONE_DAY_MS,
    };
  });

  let items = [...bidItems, ...wonItems];

  // 카테고리 필터
  if (filterType === "bid") items = items.filter((i) => i.category === "bid");
  else if (filterType === "won") items = items.filter((i) => i.category === "proposal");
  else if (filterType === "system") items = items.filter((i) => i.category === "system");

  items.sort((a, b) => b.sortKey - a.sortKey);

  // 카운트
  const unreadCount = items.filter((i) => i.unread).length;
  const newBidsCount = bidItems.filter((i) => i.unread).length;
  const wonsCount = wonItems.filter((i) => i.unread).length;

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 pb-12 lg:max-w-2xl">
      {/* 상단 액션 행 */}
      <div className="mb-4 flex items-center justify-end gap-1">
        <button
          type="button"
          className="rounded-full p-2 transition-colors hover:bg-slate-100 active:scale-95"
          title="모두 읽음 표시"
          aria-label="모두 읽음"
        >
          <CheckCheck size={22} className="text-on-surface-var" />
        </button>
        <Link
          href="/settings"
          className="relative rounded-full p-2 transition-colors hover:bg-slate-100 active:scale-95"
          title="알림 설정"
          aria-label="알림 설정"
        >
          <BellRing size={22} className="text-accent" fill="currentColor" />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full border-2 border-white bg-red-500" />
        </Link>
      </div>

      {/* 요약 카운트 3종 */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="읽지않음" value={unreadCount} barColor="bg-accent" textColor="text-accent" />
        <StatCard label="신규입찰" value={newBidsCount} barColor="bg-cyan-600" textColor="text-cyan-700" />
        <StatCard label="피드백"   value={wonsCount}    barColor="bg-slate-700" textColor="text-slate-800" />
      </div>

      {/* 카테고리 칩 */}
      <div className="mb-6">
        <AlertFilters currentType={filterType} />
      </div>

      {/* 알림 리스트 */}
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {items.map((i) => (
            <AlertCard
              key={i.id}
              category={i.category}
              title={i.title}
              message={i.message}
              timeAgo={i.timeAgo}
              href={i.href}
              unread={i.unread}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 요약 카드 (3종)
// ============================================================
function StatCard({
  label,
  value,
  barColor,
  textColor,
}: {
  label: string;
  value: number;
  barColor: string;
  textColor: string;
}) {
  return (
    <div className="relative flex flex-col items-center overflow-hidden rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm">
      <span className={`absolute bottom-0 left-0 top-0 w-1 ${barColor}`} />
      <p className="mb-1 text-[11px] font-semibold text-on-surface-var">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${textColor}`}>{String(value).padStart(2, "0")}</p>
    </div>
  );
}

// ============================================================
// 빈 상태
// ============================================================
function EmptyState() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100">
        <BellRing size={22} className="text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-on-surface">최근 알림이 없습니다</h3>
      <p className="mt-1 text-xs text-on-surface-var">
        새로운 입찰공고나 수주 이벤트가 발생하면 이 화면에 표시됩니다.
      </p>
    </div>
  );
}

// ============================================================
// 헬퍼
// ============================================================
function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const day = Math.floor(h / 24);
  if (day === 1) return "어제";
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}
