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
  households?: number | null;         // 세대수 (대단지 가산점, 결정적 지터 시드)
  buildings?: number | null;          // 동수 (대단지 보강)
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
    cycleScore: number;             // 방수 사이클 (0~100)
    ageScore: number;               // 준공 노후 (0~50)
    fundScore: number;              // 충당금 (0~12)
    bidsBonus: number;              // 활성 입찰 (0/15)
    sizeBonus: number;              // 대단지 (0~8)
    jitter: number;                 // 결정적 미세 변동 (-3~+3)
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
const EXPECTED_GAP = 17;       // 예상 발주 = 마지막 방수 + 17년

export function calcPredictionScore(input: PredictionInput): PredictionResult {
  const currentYear = input.currentYear ?? new Date().getFullYear();
  const builtYear = input.builtYear;
  const lastWaterproof = input.lastWaterproofYear ?? builtYear;
  const fund = input.fundBalance ?? 0;
  const bids = input.activeBids ?? 0;
  const households = input.households ?? null;
  const buildings = input.buildings ?? null;

  // 준공연도 + 마지막 방수공사 + 충당금 + 활성 입찰공고
  // 모두 없으면 진짜로 산정 불가 → 0점
  const hasBuilt = !!builtYear && Number.isFinite(builtYear);
  const hasWp = !!input.lastWaterproofYear && Number.isFinite(input.lastWaterproofYear);
  const hasAnySignal = hasBuilt || hasWp || fund > 0 || bids > 0;
  if (!hasAnySignal) {
    return zeroResult('수집된 분석 데이터 없음', currentYear);
  }

  const baseYear =
    hasBuilt ? (builtYear as number)
    : hasWp ? (input.lastWaterproofYear as number)
    : currentYear - 15;

  const sinceBuilt = currentYear - baseYear;
  const sinceLastWaterproof = currentYear - ((lastWaterproof as number) ?? baseYear);

  // ── 1. 사이클 점수 (방수 후 경과) — piecewise, 0~100 ──────────
  // 0-8년: 신축 직후, 발주 가능성 낮음 (0→30)
  // 8-12년: 일부 단지가 첫 시공 시작 (30→60)
  // 12-15년: 표준 사이클 도래 (60→90)
  // 15-22년: 오버 시즌 — 가장 시급 (90→100)
  // 22-30년: 이미 했을 수도 (기록 없음) (100→88)
  // 30년+: 2차 사이클 도래 가능성 (88→95, 다시 상승)
  let cycleScore: number;
  const wp = sinceLastWaterproof;
  if (wp < 8) cycleScore = wp * (30 / 8);
  else if (wp < 12) cycleScore = 30 + (wp - 8) * (30 / 4);
  else if (wp < 15) cycleScore = 60 + (wp - 12) * (30 / 3);
  else if (wp < 22) cycleScore = 90 + (wp - 15) * (10 / 7);
  else if (wp < 30) cycleScore = 100 - (wp - 22) * (12 / 8);
  else cycleScore = Math.min(95, 88 + (wp - 30) * 0.7);
  cycleScore = clamp(cycleScore, 0, 100);

  // ── 2. 노후 점수 (준공 경과) — 0~50, 동일 곡선 패턴 ───────────
  // 0-10년: 0→10 / 10-20년: 10→30 / 20-30년: 30→45 / 30년+: 천천히 45→50
  let ageScore: number;
  const a = sinceBuilt;
  if (a < 10) ageScore = a * 1.0;
  else if (a < 20) ageScore = 10 + (a - 10) * 2.0;
  else if (a < 30) ageScore = 30 + (a - 20) * 1.5;
  else ageScore = Math.min(50, 45 + (a - 30) * 0.3);
  ageScore = clamp(ageScore, 0, 50);

  // ── 3. 충당금 점수 — 단계적 (0~12) ───────────────────────────
  let fundScore = 0;
  if (fund >= 500_000_000) fundScore = 12;
  else if (fund >= 300_000_000) fundScore = 9;
  else if (fund >= 100_000_000) fundScore = 5;
  else if (fund >= 50_000_000) fundScore = 2;

  // ── 4. 활성 입찰공고 보너스 ──────────────────────────────────
  const bidsBonus = bids > 0 ? 15 : 0;

  // ── 5. 대단지 보너스 (세대수 × 동수) — 0~8 ────────────────────
  let sizeBonus = 0;
  if (households != null) {
    if (households >= 2000) sizeBonus = 8;
    else if (households >= 1000) sizeBonus = 5;
    else if (households >= 500) sizeBonus = 3;
    else if (households >= 200) sizeBonus = 1;
  }
  if (buildings != null && buildings >= 10) sizeBonus = Math.min(8, sizeBonus + 1);

  // ── 6. 결정적 미세 지터 (-3~+3) ───────────────────────────────
  // 모든 신호가 동일/없을 때도 ID 별로 살짝 다른 점수 → 정렬 시 동점 무리 회피
  let jitter = 0;
  if (hasBuilt) {
    const seed = (builtYear as number) * 7 + (households ?? 0) + (buildings ?? 0) * 13;
    jitter = (seed % 7) - 3;
  }

  // ── 가중합산 ─────────────────────────────────────────────────
  const rawScore =
    cycleScore * 0.55       // 방수 사이클이 가장 결정적 (55%)
    + ageScore * 0.50       // 노후는 ageScore 자체가 0~50 → 환산 후 25%
    + fundScore             // 0~12
    + bidsBonus             // 0/15
    + sizeBonus             // 0~8
    + jitter;               // -3~+3
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
      sizeBonus,
      jitter,
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
    breakdown: { cycleScore: 0, ageScore: 0, fundScore: 0, bidsBonus: 0, sizeBonus: 0, jitter: 0 },
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
