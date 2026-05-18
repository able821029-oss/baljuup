/**
 * 발주 예측 점수 계산
 *
 * 핵심 가정 (한국 공동주택 방수 공사):
 *   - 옥상/외벽 방수의 평균 재공사 주기: 약 15년 (보수적), 표준 사이클 17년
 *   - 사용승인(준공) 후 첫 방수공사: 보통 12~17년차
 *   - 장기수선충당금 1억 이상이면 즉시 발주 가능성 ↑
 *
 * 점수 산식 (0 ~ 100):
 *   - cycleScore (방수 사이클): 마지막 방수 후 경과 / 15년  ×  100   (가중 0.65)
 *   - ageScore   (단지 노후): 준공 후 경과 / 20년         ×  50    (가중 0.25)
 *   - fundScore  (충당금):   1억 이상 +10  /  3억 이상 +20
 *   - activeBidsBonus       : 활성 입찰공고 있으면 +15 (캡 안)
 *
 *   최종 점수는 0~100 으로 클램프.
 *
 * 색상 임계:
 *   80~100  → 즉시 접촉  (#DC2626)
 *   60~79   → 6개월 내   (#EA580C)
 *   40~59   → 1년 내     (#CA8A04)
 *    0~39   → 장기 모니터링 (#6B7280)
 */

// ============================================================
// 입력
// ============================================================
export interface PredictionInput {
  builtYear: number | null;         // 준공연도 (없으면 점수 0)
  lastWaterproofYear?: number | null; // 마지막 방수 공사 연도 (없으면 builtYear 사용)
  fundBalance?: number | null;        // 장기수선충당금 잔액 (원)
  activeBids?: number;                // 현재 활성 입찰공고 수
  currentYear?: number;               // 테스트용 — 미지정 시 new Date().getFullYear()
}

// ============================================================
// 출력
// ============================================================
export interface PredictionResult {
  score: number;                    // 0~100
  tier: 'critical' | 'high' | 'medium' | 'low';
  tierLabel: string;                // 사용자에게 보여주는 한국어 라벨
  color: { bg: string; border: string; text: string };
  expectedOrderYear: number;        // 예상 발주 연도 (lastWaterproof + 17)
  yearsUntilExpected: number;       // 현재 기준 남은 연수 (음수면 이미 지남)
  reasons: string[];                // 점수 산출 근거 (UI 툴팁용)
  breakdown: {
    cycleScore: number;
    ageScore: number;
    fundScore: number;
    bidsBonus: number;
  };
}

// ============================================================
// 색상 팔레트 (브랜드 가이드)
// ============================================================
export const SCORE_TIERS = {
  critical: { min: 80, label: '즉시 접촉',     bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626' },
  high:     { min: 60, label: '6개월 내',     bg: '#FFF7ED', border: '#FED7AA', text: '#EA580C' },
  medium:   { min: 40, label: '1년 내',       bg: '#FEFCE8', border: '#FDE047', text: '#CA8A04' },
  low:      { min:  0, label: '장기 모니터링', bg: '#F9FAFB', border: '#E5E7EB', text: '#6B7280' },
} as const;

export type ScoreTier = keyof typeof SCORE_TIERS;

export function getTierFromScore(score: number): ScoreTier {
  if (score >= SCORE_TIERS.critical.min) return 'critical';
  if (score >= SCORE_TIERS.high.min)     return 'high';
  if (score >= SCORE_TIERS.medium.min)   return 'medium';
  return 'low';
}

// ============================================================
// 메인 함수
// ============================================================
const CYCLE_YEARS = 15;        // 사이클 정규화 분모
const AGE_REFERENCE = 20;      // 노후 정규화 분모
const EXPECTED_GAP = 17;       // 예상 발주 = 마지막 방수 + 17년

export function calcPredictionScore(input: PredictionInput): PredictionResult {
  const currentYear = input.currentYear ?? new Date().getFullYear();
  const builtYear = input.builtYear;
  const lastWaterproof = input.lastWaterproofYear ?? builtYear;
  const fund = input.fundBalance ?? 0;
  const bids = input.activeBids ?? 0;

  // 준공연도 + 마지막 방수공사 + 충당금 + 활성 입찰공고
  // 모두 없으면 진짜로 산정 불가 → 0점
  // 하나라도 있으면 가능한 만큼 점수 산출 (MVP — 추후 기본정보 API 추가로 보강)
  const hasBuilt = !!builtYear && Number.isFinite(builtYear);
  const hasWp = !!input.lastWaterproofYear && Number.isFinite(input.lastWaterproofYear);
  const hasAnySignal = hasBuilt || hasWp || fund > 0 || bids > 0;
  if (!hasAnySignal) {
    return zeroResult('수집된 분석 데이터 없음', currentYear);
  }

  // builtYear 없으면 lastWaterproof 를 기준 시점으로 사용,
  // 둘 다 없으면 현재 - 15년 으로 가정 (방수 사이클 = 15년)
  const baseYear =
    hasBuilt ? (builtYear as number)
    : hasWp ? (input.lastWaterproofYear as number)
    : currentYear - CYCLE_YEARS;

  const sinceBuilt = currentYear - baseYear;
  const sinceLastWaterproof = currentYear - ((lastWaterproof as number) ?? baseYear);

  // ── 1. 사이클 점수 (방수 후 경과 / 15년) — 0~100 ────────────
  const cycleScore = clamp((sinceLastWaterproof / CYCLE_YEARS) * 100, 0, 100);

  // ── 2. 노후 점수 (준공 경과 / 20년) — 0~50 ───────────────────
  const ageScore = clamp((sinceBuilt / AGE_REFERENCE) * 50, 0, 50);

  // ── 3. 충당금 점수 — 0/10/20 ─────────────────────────────────
  let fundScore = 0;
  if (fund >= 300_000_000) fundScore = 20;
  else if (fund >= 100_000_000) fundScore = 10;

  // ── 4. 활성 입찰공고 보너스 ──────────────────────────────────
  const bidsBonus = bids > 0 ? 15 : 0;

  // ── 가중합산 ─────────────────────────────────────────────────
  const rawScore = cycleScore * 0.65 + ageScore * 0.25 + fundScore + bidsBonus;
  const score = Math.round(clamp(rawScore, 0, 100));

  const tier = getTierFromScore(score);
  const palette = SCORE_TIERS[tier];

  const lastWpEffective = (lastWaterproof as number | null | undefined) ?? baseYear;
  const expectedOrderYear = lastWpEffective + EXPECTED_GAP;
  const yearsUntilExpected = expectedOrderYear - currentYear;

  return {
    score,
    tier,
    tierLabel: palette.label,
    color: { bg: palette.bg, border: palette.border, text: palette.text },
    expectedOrderYear,
    yearsUntilExpected,
    reasons: buildReasons({
      sinceBuilt,
      sinceLastWaterproof,
      lastWaterproof: lastWpEffective,
      builtYear: hasBuilt ? (builtYear as number) : baseYear,
      fund,
      bids,
      cycleScore,
      ageScore,
      fundScore,
      bidsBonus,
    }),
    breakdown: {
      cycleScore: Math.round(cycleScore),
      ageScore: Math.round(ageScore),
      fundScore,
      bidsBonus,
    },
  };
}

// ============================================================
// 헬퍼
// ============================================================
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function zeroResult(reason: string, currentYear: number): PredictionResult {
  return {
    score: 0,
    tier: 'low',
    tierLabel: SCORE_TIERS.low.label,
    color: {
      bg: SCORE_TIERS.low.bg,
      border: SCORE_TIERS.low.border,
      text: SCORE_TIERS.low.text,
    },
    expectedOrderYear: currentYear,
    yearsUntilExpected: 0,
    reasons: [reason],
    breakdown: { cycleScore: 0, ageScore: 0, fundScore: 0, bidsBonus: 0 },
  };
}

function buildReasons(o: {
  sinceBuilt: number;
  sinceLastWaterproof: number;
  lastWaterproof: number;
  builtYear: number;
  fund: number;
  bids: number;
  cycleScore: number;
  ageScore: number;
  fundScore: number;
  bidsBonus: number;
}): string[] {
  const r: string[] = [];

  // 사이클
  if (o.lastWaterproof === o.builtYear) {
    r.push(`준공 ${o.builtYear}년 — 방수 공사 이력 없음 (사이클 가정: 준공 시점)`);
  } else {
    r.push(`마지막 방수 공사 ${o.lastWaterproof}년 — ${o.sinceLastWaterproof}년 경과`);
  }

  // 노후
  r.push(`단지 노후 ${o.sinceBuilt}년 (준공 ${o.builtYear}년)`);

  // 충당금
  if (o.fund > 0) {
    const eok = (o.fund / 100_000_000).toFixed(1);
    if (o.fundScore === 20) r.push(`충당금 ${eok}억 — 발주 여력 충분 (+20)`);
    else if (o.fundScore === 10) r.push(`충당금 ${eok}억 — 발주 여력 있음 (+10)`);
    else r.push(`충당금 ${eok}억 — 발주 시 부족 가능`);
  } else {
    r.push('충당금 정보 없음');
  }

  // 입찰공고
  if (o.bids > 0) r.push(`현재 활성 입찰공고 ${o.bids}건 (+15)`);

  return r;
}

// ============================================================
// 일괄 처리용 헬퍼 (단지 배열 → 점수 배열)
// ============================================================
export function batchPredict<T extends PredictionInput & { id?: string | number }>(
  items: T[]
): Array<T & { prediction: PredictionResult }> {
  return items.map((it) => ({ ...it, prediction: calcPredictionScore(it) }));
}
