/**
 * /dashboard — 메인 대시보드 (Server Component)
 *
 * Stitch 디자인 반영 — 모바일 first, 데스크탑은 max-w-md 컨테이너 유지.
 * Supabase 쿼리 7개는 그대로 유지 (실데이터 연동).
 */

import Link from "next/link";
import {
  AlertTriangle,
  BellRing,
  Megaphone,
  Zap,
  BarChart3,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/Logo";

// 쿠키 기반 인증 + 사용자별 데이터가 있어 ISR 캐싱 불가 → dynamic 명시
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  // ── 사용자 + 프로필 조회 (히어로 액션 분기용) ────────────
  // 어떤 이유로든 실패하면 히어로는 안 보이고 나머지 대시보드는 정상 렌더되도록 격리.
  let isTrialUser = false;
  let hasRegions = false;
  let companyName: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_profiles")
        .select("company_name, plan, region")
        .eq("id", user.id)
        .maybeSingle();
      const profile = (data as unknown) as {
        company_name: string | null;
        plan: string | null;
        region: string[] | null;
      } | null;
      isTrialUser = profile?.plan === "trial";
      hasRegions = (profile?.region?.length ?? 0) > 0;
      companyName = profile?.company_name ?? null;
    }
  } catch (err) {
    // 운영에서 디버깅 가능하도록 로그 — 페이지는 계속 렌더
    console.error("[dashboard] user profile lookup failed:", err);
  }

  // ── 병렬 조회 (기존 그대로) ─────────────────────────────
  const [
    totalRes,
    criticalRes,
    alertsMonthRes,
    wonRes,
    topRes,
    recentBidsRes,
  ] = await Promise.all([
    supabase.from("complexes").select("id", { count: "exact", head: true }),
    supabase.from("complexes").select("id", { count: "exact", head: true }).gte("prediction_score", 80),
    supabase.from("bid_announcements").select("id", { count: "exact", head: true }).gte("announced_at", startOfMonthIso()),
    supabase.from("proposals").select("id", { count: "exact", head: true }).eq("status", "won"),
    supabase.from("complex_predictions").select("id, name, prediction_score, expected_order_year")
      .order("prediction_score", { ascending: false }).limit(3),
    supabase.from("bid_announcements").select("id, title, work_type, announced_at, complex_id, complexes(name)")
      .order("announced_at", { ascending: false }).limit(3),
  ]);

  const total = totalRes.count ?? 0;
  const critical = criticalRes.count ?? 0;
  const alertsMonth = alertsMonthRes.count ?? 0;
  const won = wonRes.count ?? 0;

  type TopRow = { id: string; name: string; prediction_score: number; expected_order_year: number | null };
  const top3 = ((topRes.data ?? []) as unknown) as TopRow[];

  type BidRow = {
    id: string; title: string | null; work_type: string | null; announced_at: string | null;
    complex_id: string; complexes: { name: string } | { name: string }[] | null;
  };
  const bids = (((recentBidsRes.data ?? []) as unknown) as BidRow[]).map((b) => {
    const cx = Array.isArray(b.complexes) ? b.complexes[0] : b.complexes;
    return { ...b, complexName: cx?.name ?? "단지" };
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-6 pb-6 space-y-8 lg:max-w-5xl">
      {/* ── 0. 히어로 액션 (체험 사용자 전용 — 첫 로그인 환영 + 다음 행동 유도) ── */}
      {isTrialUser && (
        <HeroAction
          companyName={companyName}
          hasRegions={hasRegions}
        />
      )}

      {/* ── 1. 지표 카드 4종 (2x2 모바일 / 4열 데스크탑) ──────── */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard variant="glass"  label="모니터링 단지" value={total} unit="개소" />
        <MetricCard variant="alert"  label="즉시 접촉"    value={critical} unit="건" sub="긴급 대응 필요" />
        <MetricCard variant="glass"  label="이번 달 알림"  value={alertsMonth} unit="회" />
        <MetricCard variant="accent" label="수주 성공"     value={won} unit="건" />
      </section>

      {/* ── 2. 즉시 접촉 TOP 5 (다크 네이비 그라데이션 헤더 + 흰 리스트) ─── */}
      <section className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-primary px-6 py-5 text-white shadow-xl shadow-slate-900/10">
          <div className="absolute right-0 top-0 p-4 opacity-10">
            <Zap size={80} strokeWidth={1.5} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <Zap size={20} className="text-blue-400" fill="currentColor" />
              <h3 className="text-lg font-bold tracking-tight">즉시 접촉 TOP 5</h3>
            </div>
            <p className="mt-1.5 text-xs font-medium text-slate-400">
              인공지능 정밀 분석 수주 가능성 상위 현장
            </p>
          </div>
        </div>

        <div className="premium-shadow divide-y divide-slate-50 rounded-2xl border border-slate-100 bg-white">
          {top3.length === 0 && (
            <p className="px-5 py-10 text-center text-xs text-slate-400">
              수집된 단지가 없습니다. 공공데이터 수집 스크립트를 먼저 실행해주세요.
            </p>
          )}
          {top3.map((c, i) => (
            <Link
              key={c.id}
              href={`/complexes/${c.id}`}
              className="flex items-center justify-between p-5 transition-colors active:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-5">
                <RankBadge rank={i + 1} />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-on-surface">{c.name}</p>
                  <p className="text-[11px] font-medium text-on-surface-var">
                    예상 발주 {c.expected_order_year ?? new Date().getFullYear()}년
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-baseline gap-1">
                <span className="font-data text-2xl font-black text-accent tabular-nums">{c.prediction_score}</span>
                <span className="text-[10px] font-bold uppercase text-blue-600/50">Score</span>
              </div>
            </Link>
          ))}
          {top3.length > 0 && (
            <Link
              href="/complexes?tier=critical"
              className="block w-full rounded-b-2xl bg-slate-50/50 py-4 text-center text-xs font-bold uppercase tracking-widest text-accent transition-colors hover:bg-slate-50"
            >
              View All Analysis
            </Link>
          )}
        </div>
      </section>

      {/* ── 3. 실시간 알림 ─────────────────────────────────── */}
      <section className="premium-shadow overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <header className="flex items-center justify-between border-b border-slate-50 px-6 py-5">
          <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-primary">
            <BellRing size={20} className="text-accent" />
            실시간 알림
          </h3>
          <Link
            href="/alerts"
            className="rounded px-2 py-1 text-xs font-bold text-accent transition-colors hover:bg-blue-50"
          >
            전체보기
          </Link>
        </header>
        <div className="divide-y divide-slate-50">
          {bids.length === 0 && (
            <p className="px-6 py-10 text-center text-xs text-slate-400">
              최근 알림이 없습니다.
            </p>
          )}
          {bids.map((b) => (
            <Link
              key={b.id}
              href={`/complexes/${b.complex_id}`}
              className="flex items-start gap-4 p-5 transition-colors active:bg-slate-50"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                <Megaphone size={22} className="text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-start justify-between">
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                    신규 공고
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    {relativeTime(b.announced_at)}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-800">{b.complexName}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {b.title ?? `${b.work_type ?? "공사"} 입찰공고`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 4. 트렌드 차트 (placeholder — 추후 실데이터 연결) ── */}
      <section className="premium-shadow rounded-2xl border border-slate-100 bg-white p-6">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-primary">
              <BarChart3 size={20} className="text-slate-400" />
              월별 수주 트렌드
            </h3>
            <p className="mt-1 text-[11px] font-medium text-slate-400">
              직전 6개월 데이터 기반 분석
            </p>
          </div>
          <div className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-bold text-slate-500">
            {currentQuarter()}
          </div>
        </div>
        <TrendChart />
      </section>
    </div>
  );
}

// ============================================================
// 히어로 액션 — 체험 사용자 첫 로그인 환영 + 다음 행동 유도
// ============================================================
function HeroAction({
  companyName,
  hasRegions,
}: {
  companyName: string | null;
  hasRegions: boolean;
}) {
  // 관심 지역 설정 전: 셋업이 1순위 / 설정 후: 즉시 접촉 단지로 안내
  const primaryHref = hasRegions ? "/complexes?tier=critical" : "/settings";
  const primaryLabel = hasRegions ? "즉시 접촉 단지 보기" : "관심 지역 설정하기";
  const secondaryHref = hasRegions ? "/proposals/new" : "/complexes";
  const secondaryLabel = hasRegions ? "제안서 만들기" : "단지 둘러보기";
  const subtitle = hasRegions
    ? "관심 지역의 단지 분석이 진행 중입니다. 점수 80점 이상 단지부터 살펴보세요."
    : "관심 지역만 설정하면 매주 발주가 날 단지를 분석해드립니다.";

  return (
    <section className="premium-shadow relative overflow-hidden rounded-3xl border border-blue-100/60 bg-gradient-to-br from-white via-blue-50/30 to-white p-6 sm:p-8">
      {/* 우상단 미세 광선 */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 size-56 rounded-full bg-accent/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* 로고 (밝은 배경 — 원본 색상 그대로) */}
        <div className="flex shrink-0 items-center justify-center sm:justify-start">
          <Logo size="lg" priority />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          {/* 체험 배지 */}
          <div className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
            <Sparkles size={11} />
            7일 무료 체험 중
          </div>

          {/* 인사 + 설명 */}
          <h2 className="mt-2 text-xl font-extrabold tracking-tight text-on-surface sm:text-2xl">
            {companyName ? `${companyName} 대표님, 환영합니다` : "발주Up에 오신 것을 환영합니다"}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-on-surface-var">
            {subtitle}
          </p>

          {/* CTA 2개 */}
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Link
              href={primaryHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent/90 active:scale-[0.98]"
            >
              {primaryLabel}
              <ArrowRight size={14} />
            </Link>
            <Link
              href={secondaryHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// 지표 카드 컴포넌트 — 4종 변형
// ============================================================
function MetricCard({
  variant,
  label,
  value,
  unit,
  sub,
}: {
  variant: "glass" | "alert" | "dark" | "accent";
  label: string;
  value: number;
  unit: string;
  sub?: string;
}) {
  if (variant === "alert") {
    return (
      <div className="rounded-2xl border border-red-500 bg-white p-5 shadow-xl shadow-red-900/5">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-red-600">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="font-data text-3xl font-black text-red-700 tabular-nums">{value.toLocaleString()}</span>
          <span className="text-xs font-bold text-red-700/70">{unit}</span>
        </div>
        {sub && (
          <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-500">
            <AlertTriangle size={12} />
            {sub}
          </div>
        )}
      </div>
    );
  }
  if (variant === "accent") {
    // Stitch 디자인의 "수주 성공" — 파란 강조 카드
    return (
      <div className="rounded-2xl border border-white/20 bg-accent p-5 shadow-xl shadow-accent/30">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/80">{label}</p>
        <div className="flex items-baseline gap-1 text-white">
          <span className="font-data text-3xl font-black tabular-nums">{value.toLocaleString()}</span>
          <span className="text-xs font-bold opacity-80">{unit}</span>
        </div>
      </div>
    );
  }
  if (variant === "dark") {
    return (
      <div className="rounded-2xl bg-primary p-5 shadow-xl shadow-primary/10">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/70">{label}</p>
        <div className="flex items-baseline gap-1 text-white">
          <span className="font-data text-3xl font-black tabular-nums">{value.toLocaleString()}</span>
          <span className="text-xs font-bold opacity-70">{unit}</span>
        </div>
      </div>
    );
  }
  // glass (default: 흰 카드, 짙은 그림자)
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-var">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="font-data text-3xl font-black text-primary tabular-nums">{value.toLocaleString()}</span>
        <span className="text-xs font-bold text-on-surface-var">{unit}</span>
      </div>
    </div>
  );
}

// ============================================================
// 랭킹 배지 (1, 2, 3...)
// ============================================================
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white shadow-md">
        {rank}
      </div>
    );
  }
  return (
    <div className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-500">
      {rank}
    </div>
  );
}

// ============================================================
// 트렌드 차트 (mock — 추후 proposals 월별 카운트로 교체)
// ============================================================
function TrendChart() {
  const months = ["10월", "11월", "12월", "1월", "2월", "3월"];
  const data = [40, 65, 50, 85, 60, 70];
  const highlights = [1, 3, 5]; // 강조할 인덱스

  return (
    <div className="flex h-44 w-full items-end gap-3 border-b border-slate-100 px-2 pb-2">
      {data.map((h, i) => {
        const isHighlight = highlights.includes(i);
        return (
          <div key={i} className="group flex flex-1 flex-col items-center justify-end gap-2">
            <div
              className={
                isHighlight
                  ? "w-full rounded-lg bg-accent shadow-lg shadow-blue-500/20 transition-all group-hover:scale-105"
                  : "w-full rounded-lg bg-slate-100 transition-all group-hover:bg-slate-200"
              }
              style={{ height: `${h}%` }}
            />
            <span
              className={
                isHighlight
                  ? "text-[10px] font-black text-accent"
                  : "text-[10px] font-bold text-slate-400"
              }
            >
              {months[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 헬퍼
// ============================================================
function startOfMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function currentQuarter(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}.Q${q}`;
}

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
