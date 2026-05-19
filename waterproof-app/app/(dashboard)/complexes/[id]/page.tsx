/**
 * /complexes/[id] — 단지 상세 (Server Component)
 *
 * Stitch 디자인 반영:
 *   1) 상단: 뒤로/공유/더보기
 *   2) AI 수주 분석 리포트 (다크 카드 + 원형 차트)
 *   3) 단지 기본 정보 (아파트 배지 + 단지명 + 주소 + 세대수/준공)
 *   4) 주요 분석 지표 (3행 — 노후도/인근 발주/장기수선계획)
 *   5) 공사 이력 타임라인 (방수 공사 강조)
 *   6) 단지 전경 placeholder
 *   7) 고정 하단 CTA — "AI 제안서 자동 생성"
 *
 * Supabase 데이터 그대로 사용 (complexes / maintenance_history / maintenance_funds / bid_announcements)
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Share2,
  MoreVertical,
  Brain,
  MapPin,
  Info,
  Building2,
  BarChart3,
  CalendarCheck,
  Sparkles,
  Phone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { calcPredictionScore } from "@/lib/prediction";
import { isWaterproofWork } from "@/lib/kapt-api";
import { extractLastWorkByCategory } from "@/lib/work-categories";
import { RecommendedWorkSpectrum } from "@/components/complexes/RecommendedWorkSpectrum";
import { ComplexSatelliteView } from "@/components/complexes/ComplexSatelliteView";
import { TrackingStar } from "@/components/tracking/TrackingStar";
import { StatusSelect, PrioritySelect } from "@/components/tracking/StatusBadge";
import {
  MemoEditor,
  NextActionInput,
  LastContactInput,
  LogContactNowButton,
} from "@/components/tracking/TrackingDetails";
import type { SalesTracking } from "@/lib/supabase/database.types";

export const revalidate = 60;

type Params = { id: string };

export default async function ComplexDetailPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  const { id } = await Promise.resolve(params);
  const supabase = await createClient();

  const [complexRes, historyRes, fundsRes, bidsRes, trackingRes] = await Promise.all([
    supabase.from("complexes").select("*").eq("id", id).maybeSingle(),
    supabase.from("maintenance_history").select("*").eq("complex_id", id)
      .order("work_year", { ascending: false }).limit(20),
    supabase.from("maintenance_funds").select("*").eq("complex_id", id)
      .order("year_month", { ascending: false }).limit(12),
    supabase.from("bid_announcements").select("*").eq("complex_id", id)
      .order("announced_at", { ascending: false }).limit(5),
    // RLS 로 본인 행만 반환 — maybeSingle 로 0 또는 1건
    supabase.from("sales_tracking").select("*").eq("complex_id", id).maybeSingle(),
  ]);

  if (!complexRes.data) notFound();

  const tracking = (trackingRes.data ?? null) as SalesTracking | null;

  type ComplexRow = {
    id: string; name: string; address: string | null;
    sido: string | null; sigungu: string | null;
    built_year: number | null; households: number | null; buildings: number | null;
    management_type: string | null; management_company: string | null; phone: string | null;
  };
  const c = complexRes.data as unknown as ComplexRow;

  type HistoryRow = {
    id: string; work_type: string | null; work_year: number | null;
    work_amount: number | null; is_waterproof: boolean;
  };
  const history = ((historyRes.data ?? []) as unknown) as HistoryRow[];

  type FundRow = { fund_balance: number | null };
  const funds = ((fundsRes.data ?? []) as unknown) as FundRow[];

  type BidRow = {
    id: string; status: string; deadline_at: string | null; announced_at: string | null;
  };
  const bids = ((bidsRes.data ?? []) as unknown) as BidRow[];

  // ── 라이브 예측 점수 계산 ────────────────────────────────
  const waterproofYears = history
    .filter((h) => h.is_waterproof || isWaterproofWork(h.work_type ?? ""))
    .map((h) => h.work_year ?? 0)
    .filter((y) => y > 0);
  const lastWaterproofYear = waterproofYears.length ? Math.max(...waterproofYears) : null;

  const latestFund = funds[0]?.fund_balance ?? null;
  const activeBids = bids.filter((b) => b.status === "active").length;

  const prediction = calcPredictionScore({
    builtYear: c.built_year,
    lastWaterproofYear,
    fundBalance: latestFund,
    activeBids,
    households: c.households,
    buildings: c.buildings,
  });

  // ── 표시값 가공 ─────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const ageYears = c.built_year ? currentYear - c.built_year : null;
  const tierLabel =
    prediction.score >= 80 ? "매우 높음"
    : prediction.score >= 60 ? "높음"
    : prediction.score >= 40 ? "보통" : "낮음";
  const expectedHalf = prediction.expectedOrderYear
    ? `${prediction.expectedOrderYear}년 ${prediction.yearsUntilExpected <= 0 ? "도래" : "예정"}`
    : "—";

  const summarySentence = buildSummary({
    name: c.name,
    ageYears,
    lastWaterproofYear,
    fundEok: latestFund != null ? Math.round(latestFund / 100_000_000) : null,
    activeBids,
  });

  // 인근 발주 — 같은 시군구의 최근 3개월 입찰공고 카운트
  let nearbyBidsCount = 0;
  if (c.sigungu) {
    const threeMonthAgo = new Date();
    threeMonthAgo.setMonth(threeMonthAgo.getMonth() - 3);
    const { count } = await supabase
      .from("bid_announcements")
      .select("id, complexes!inner(sigungu)", { count: "exact", head: true })
      .eq("complexes.sigungu", c.sigungu)
      .gte("announced_at", threeMonthAgo.toISOString());
    nearbyBidsCount = count ?? 0;
  }

  return (
    <div className="pb-[calc(88px+env(safe-area-inset-bottom))]">
      {/* ── 상단 헤더 ───────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-slate-200 bg-white/80 px-4 backdrop-blur-lg">
        <div className="flex flex-1 items-center">
          <Link
            href="/complexes"
            className="-ml-2 flex items-center justify-center rounded-full p-2 transition-all hover:bg-slate-100 active:scale-90"
            aria-label="뒤로"
          >
            <ArrowLeft size={22} className="text-on-surface" />
          </Link>
          <h1 className="ml-1 truncate text-base font-bold text-on-surface">단지 상세 분석</h1>
        </div>
        <div className="flex items-center gap-1">
          <TrackingStar complexId={c.id} initialTracked={tracking != null} />
          <button
            type="button"
            className="flex items-center justify-center rounded-full p-2 transition-all hover:bg-slate-100 active:scale-90"
            aria-label="공유"
          >
            <Share2 size={20} className="text-on-surface" />
          </button>
          <button
            type="button"
            className="flex items-center justify-center rounded-full p-2 transition-all hover:bg-slate-100 active:scale-90"
            aria-label="더 보기"
          >
            <MoreVertical size={20} className="text-on-surface" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md space-y-6 px-4 pt-4 lg:max-w-2xl">
        {/* ── AI 수주 분석 리포트 (다크 카드 — Stitch: black + 라이트 블루 보더) ───────────── */}
        <section className="overflow-hidden rounded-2xl border-2 border-blue-200 bg-black text-white shadow-xl shadow-slate-900/10">
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain size={20} className="text-blue-200" />
                <h3 className="text-base font-bold tracking-tight">AI 수주 분석 리포트</h3>
              </div>
              <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                최신 업데이트
              </span>
            </div>

            <div className="mb-5 flex items-center gap-6">
              {/* 원형 차트 */}
              <ScoreRing score={prediction.score} />

              <div className="flex-1">
                <p className="mb-0.5 text-xs font-medium text-slate-400">예상 수주 확률</p>
                <p className="mb-2 text-2xl font-extrabold text-blue-200">{tierLabel}</p>
                <div className="rounded-lg border border-white/10 bg-accent/20 p-2.5">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-blue-100/80">
                    예상 발주 시점
                  </p>
                  <span className="text-sm font-bold text-white">{expectedHalf}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-white/10 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                핵심 분석 요약
              </p>
              <p className="text-sm leading-relaxed text-white/90">
                {summarySentence.before}
                <span className="font-bold text-blue-200"> {summarySentence.highlight}</span>
                {summarySentence.after}
              </p>
            </div>
          </div>
        </section>

        {/* ── 관심단지 영업 추적 패널 ─────────────────────── */}
        <SalesTrackingPanel complexId={c.id} tracking={tracking} />

        {/* ── 단지 기본 정보 카드 ─────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none tracking-wider text-white">
                아파트
              </span>
              <h2 className="text-xl font-bold text-on-surface">{c.name}</h2>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-on-surface-var">
              <MapPin size={16} className="text-slate-400" />
              {c.address ?? "주소 정보 없음"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-var">
                  세대수 및 규모
                </p>
                <p className="text-sm font-bold text-on-surface">
                  {c.households ? `${c.households.toLocaleString()}세대` : "—"}
                  {c.buildings ? ` / ${c.buildings}개동` : ""}
                </p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-var">
                  준공 연도
                </p>
                <p className="text-sm font-bold text-red-600">
                  {c.built_year ? `${c.built_year}년` : "—"}
                  {ageYears != null && (
                    <span className="ml-1 text-xs font-normal text-on-surface-var">
                      ({ageYears}년차)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* 관리사무소 정보 — 단지 목록에서 옮겨온 영업 핵심 정보 */}
            {(c.phone || c.management_type) && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-var">
                    관리사무소
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-on-surface">
                    {c.management_type ?? "관리 방식 정보 없음"}
                    {c.management_company ? ` · ${c.management_company}` : ""}
                  </p>
                </div>
                {c.phone && (
                  <a
                    href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white shadow-md shadow-accent/20 transition-all hover:bg-accent/90 active:scale-[0.98]"
                    aria-label={`관리사무소 ${c.phone} 전화 걸기`}
                  >
                    <Phone size={14} />
                    <span className="tabular-nums">{c.phone}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── 주요 분석 지표 ───────────────────────────── */}
        <section className="space-y-3">
          <h3 className="flex items-center justify-between px-1 text-base font-bold">
            <span>주요 분석 지표</span>
            <Info size={20} className="text-slate-400" />
          </h3>
          <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <MetricRow
              icon={Building2}
              iconBg="bg-red-50"
              iconColor="text-red-600"
              label="건물 노후도"
              value={`${prediction.score}점`}
              valueColor="text-red-600"
              sub={prediction.score >= 90 ? "상위 1%" : prediction.score >= 70 ? "상위 10%" : undefined}
            />
            <MetricRow
              icon={BarChart3}
              iconBg="bg-slate-100"
              iconColor="text-slate-600"
              label="인근 발주 현황"
              value={`최근 3개월 내 ${nearbyBidsCount}건`}
              valueColor="text-on-surface"
            />
            <MetricRow
              icon={CalendarCheck}
              iconBg="bg-blue-50"
              iconColor="text-accent"
              label="장기수선계획"
              value={latestFund && latestFund >= 100_000_000 ? "포함됨 (집행 예정)" : "확인 필요"}
              valueColor={latestFund && latestFund >= 100_000_000 ? "text-accent" : "text-on-surface-var"}
            />
          </div>
        </section>

        {/* ── 공사 이력 타임라인 ───────────────────────── */}
        <section className="space-y-4">
          <h3 className="px-1 text-base font-bold">공사 이력 (히스토리)</h3>
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-50">
                <CalendarCheck size={22} className="text-slate-400" />
              </div>
              <p className="text-sm font-bold text-on-surface">유지관리 이력 데이터 없음</p>
              <p className="mt-1.5 text-xs leading-relaxed text-on-surface-var">
                공공데이터에서 이 단지의 공사 이력을 아직 받지 못했습니다.<br />
                준공 후 첫 공사 시점이 아직 안 됐거나, 단지가 등록 직후일 수 있어요.
              </p>
              <p className="mt-3 text-[11px] font-medium text-accent">
                → 아래 <strong>추천 공종 스펙트럼</strong>에서 노후도 기준 자동 추천을 확인하세요.
              </p>
            </div>
          ) : (
            <div className="relative space-y-6 pl-6 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-0.5 before:bg-slate-200">
              {history.slice(0, 6).map((h) => {
                const isWp = h.is_waterproof || isWaterproofWork(h.work_type ?? "");
                const yearsAgo = h.work_year ? currentYear - h.work_year : null;
                return (
                  <div key={h.id} className="relative">
                    <div
                      className={[
                        "absolute -left-[20px] top-1.5 size-3.5 rounded-full border-4 border-white",
                        isWp ? "bg-red-600 ring-1 ring-red-300" : "bg-slate-400 ring-1 ring-slate-300",
                      ].join(" ")}
                    />
                    <div
                      className={[
                        "rounded-xl border bg-white p-5 shadow-sm",
                        isWp ? "border-y border-r border-l-4 border-l-red-600 border-slate-200" : "border-slate-200",
                      ].join(" ")}
                    >
                      <div className="mb-1 flex items-start justify-between">
                        <p className="text-[11px] font-extrabold uppercase tracking-wide text-on-surface-var">
                          {h.work_year ? `${h.work_year}년` : "연도 미상"}
                        </p>
                        {isWp && yearsAgo != null && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 shadow-sm">
                            {yearsAgo}년 경과
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold leading-snug text-on-surface">
                        {h.work_type ?? "공사 내역"}
                      </h4>
                      {h.work_amount && (
                        <p className="mt-1.5 text-xs leading-relaxed text-on-surface-var">
                          공사 금액: {(h.work_amount / 100_000_000).toFixed(1)}억원
                        </p>
                      )}
                      {isWp && yearsAgo != null && yearsAgo >= 15 && (
                        <p className="mt-1.5 text-xs font-medium leading-relaxed text-red-600">
                          내구 연한 초과로 즉시 교체 권장
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 추천 공종 스펙트럼 (6대 공종) ─────────────── */}
        <RecommendedWorkSpectrum
          builtYear={c.built_year}
          households={c.households}
          lastWorkByCategory={extractLastWorkByCategory(
            history.map((h) => ({ workType: h.work_type, workYear: h.work_year })),
          )}
        />

        {/* ── 단지 외관 — 카카오 로드뷰(실제 외관 사진) 우선, 없으면 위성 fallback ── */}
        <ComplexSatelliteView name={c.name} address={c.address} />
      </main>

      {/* ── 고정 하단 CTA + 모바일 nav 자리 ──────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:left-64">
        <div className="mx-auto max-w-md px-4 pb-4 lg:max-w-2xl">
          <Link
            href={`/proposals/new?complexId=${c.id}`}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-accent/50 bg-accent text-white shadow-xl shadow-accent/30 transition-all active:scale-95"
          >
            <Sparkles size={22} fill="currentColor" />
            <span className="text-base font-bold tracking-tight">AI 제안서 자동 생성</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 원형 점수 차트 (SVG) — Stitch 디자인:
//   - 블루→시안 그라데이션 stroke
//   - 드롭쉐도우 글로우 효과
//   - 점수 글자 흰색 + 블루 텍스트 글로우
// ============================================================
function ScoreRing({ score }: { score: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  // 고유 gradient id (페이지 내 여러 ring 출현 대비)
  const gradId = `progressGradient-${score}`;
  return (
    <div className="relative flex size-24 shrink-0 items-center justify-center">
      <svg
        className="size-full -rotate-90"
        style={{ filter: "drop-shadow(0 0 8px rgba(37,99,235,0.6))" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="transparent"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="transparent"
          stroke={`url(#${gradId})`}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-3xl font-bold leading-none tabular-nums text-white"
          style={{ textShadow: "0 0 20px rgba(37,99,235,0.7)" }}
        >
          {score}%
        </span>
      </div>
    </div>
  );
}

// ============================================================
// 지표 행
// ============================================================
import type { LucideIcon } from "lucide-react";

function MetricRow({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  valueColor,
  sub,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 transition-colors active:bg-slate-50">
      <div className="flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-full ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
        <span className="text-sm font-semibold text-on-surface">{label}</span>
      </div>
      <div className="text-right">
        <p className={`text-base font-bold leading-tight ${valueColor}`}>{value}</p>
        {sub && <p className="text-[11px] text-on-surface-var">{sub}</p>}
      </div>
    </div>
  );
}

// ============================================================
// 핵심 분석 요약 문장 빌더
// ============================================================
function buildSummary(input: {
  name: string;
  ageYears: number | null;
  lastWaterproofYear: number | null;
  fundEok: number | null;
  activeBids: number;
}): { before: string; highlight: string; after: string } {
  const parts: string[] = [];
  if (input.ageYears != null && input.ageYears >= 20) {
    parts.push(`준공 ${input.ageYears}년차의 노후 단지로`);
  }
  if (!input.lastWaterproofYear) {
    parts.push("최근 10년간 대규모 방수 공사 이력이 없으며");
  } else {
    const since = new Date().getFullYear() - input.lastWaterproofYear;
    if (since >= 15) parts.push(`마지막 방수 공사 후 ${since}년이 경과했고`);
  }
  if (input.fundEok != null && input.fundEok >= 2) {
    parts.push(`충당금이 ${input.fundEok}억원 이상 적립되어`);
  }
  if (input.activeBids > 0) {
    parts.push(`현재 ${input.activeBids}건의 활성 입찰공고가 있어`);
  }

  const before = parts.length > 0
    ? parts.join(", ") + " "
    : "현재 보유한 공공데이터를 기반으로 분석한 결과 ";

  return {
    before,
    highlight: "발주 가능성이 매우 높은",
    after: " 단지입니다.",
  };
}

// ============================================================
// 관심단지 영업 추적 패널
//
// - 추적 중이 아닐 때: 추가 CTA 카드 (TrackingStar variant=detail)
// - 추적 중일 때: 상태/우선순위/일정/메모 인라인 편집 UI
// ============================================================
import { Target as TargetIcon } from "lucide-react";

function SalesTrackingPanel({
  complexId,
  tracking,
}: {
  complexId: string;
  tracking: SalesTracking | null;
}) {
  if (!tracking) {
    return (
      <section className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <TargetIcon size={18} className="text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-on-surface">관심단지로 추가</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-on-surface-var">
              영업 단계, 우선순위, 다음 액션 일정을 따로 관리할 수 있습니다.{" "}
              <Link href="/tracking" className="font-semibold text-accent hover:underline">
                영업추적 페이지
              </Link>
              에서 한 번에 확인하세요.
            </p>
            <div className="mt-3">
              <TrackingStar complexId={complexId} initialTracked={false} variant="detail" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-amber-50/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <TargetIcon size={16} className="text-amber-600" />
          <h3 className="text-sm font-bold text-on-surface">영업 추적</h3>
        </div>
        <Link
          href="/tracking"
          className="text-[11px] font-semibold text-accent hover:underline"
        >
          전체 보기 →
        </Link>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect trackingId={tracking.id} initial={tracking.status} />
          <PrioritySelect trackingId={tracking.id} initial={tracking.priority} />
          <LogContactNowButton trackingId={tracking.id} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NextActionInput trackingId={tracking.id} initial={tracking.next_action_at} />
          <LastContactInput trackingId={tracking.id} initial={tracking.last_contact_at} />
        </div>

        <MemoEditor trackingId={tracking.id} initial={tracking.memo} rows={3} />
      </div>
    </section>
  );
}
