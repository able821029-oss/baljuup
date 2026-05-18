/**
 * 공동주택 공사 카테고리 분류 + 추천 공종 예측
 *
 * 데이터 출처:
 *   - K-apt 유지관리이력 API (workType 필드)
 *   - LH/SH 표준 장기수선계획 권장 주기
 *   - 한국부동산원 공동주택관리 가이드
 *
 * 모든 주기는 "한국 표준 공동주택 기준" 보수적 평균값입니다.
 * 실제 단지별로 ±3년 변동 가능.
 */

// ============================================================
// 공종 카테고리 정의 — 6대 핵심 공종
// ============================================================
export type WorkCategoryCode =
  | 'waterproof'    // 방수 (옥상, 외벽, 지하)
  | 'painting'      // 도장 (외벽 재도장)
  | 'elevator'      // 엘리베이터 교체/현대화
  | 'piping'        // 배관 (급수/오수/난방)
  | 'parking'       // 주차장 (도장/보수)
  | 'landscape';    // 조경 (식재/시설물)

export interface WorkCategoryMeta {
  code: WorkCategoryCode;
  label: string;            // 사용자 표시
  icon: string;              // lucide-react 아이콘명
  color: 'blue' | 'orange' | 'purple' | 'cyan' | 'amber' | 'green';
  cycleYears: number;        // 평균 재공사 주기
  firstAfterBuilt: number;   // 신축 후 첫 공사 시점
  keywords: string[];        // 유지관리이력 workType 매칭 키워드
  avgCostPerHousehold: number; // 세대당 평균 공사비 (원, 영업 참고용)
  description: string;       // 1줄 설명
}

export const WORK_CATEGORIES: Record<WorkCategoryCode, WorkCategoryMeta> = {
  waterproof: {
    code: 'waterproof',
    label: '방수',
    icon: 'Umbrella',
    color: 'blue',
    cycleYears: 15,
    firstAfterBuilt: 12,
    keywords: ['방수', '우레탄', '도막', '실링', '코킹', '옥상방수', '외벽방수', '지하방수', '시트방수'],
    avgCostPerHousehold: 800_000,
    description: '옥상·외벽·지하 누수 방지 시공 (평균 15년 주기)',
  },
  painting: {
    code: 'painting',
    label: '재도장',
    icon: 'Paintbrush',
    color: 'orange',
    cycleYears: 12,
    firstAfterBuilt: 10,
    keywords: ['도장', '재도장', '외벽도장', '도색', '페인트', '외벽재도장'],
    avgCostPerHousehold: 600_000,
    description: '외벽·공용부 도장 갱신 (평균 12년 주기, 미관·내후성)',
  },
  elevator: {
    code: 'elevator',
    label: '엘리베이터',
    icon: 'ArrowUpDown',
    color: 'purple',
    cycleYears: 25,
    firstAfterBuilt: 22,
    keywords: ['승강기', '엘리베이터', '리프트', '권상기', '제어반', '카교체', '리뉴얼'],
    avgCostPerHousehold: 2_500_000,
    description: '승강기 부품 교체·현대화 (평균 25년 주기, 한 대당 5천만~1억)',
  },
  piping: {
    code: 'piping',
    label: '배관',
    icon: 'Wrench',
    color: 'cyan',
    cycleYears: 30,
    firstAfterBuilt: 25,
    keywords: ['배관', '급수관', '오수관', '난방관', '입상관', '계량기', '밸브'],
    avgCostPerHousehold: 1_500_000,
    description: '급수·오수·난방 배관 교체 (평균 30년 주기, 노후 단지 핵심)',
  },
  parking: {
    code: 'parking',
    label: '주차장',
    icon: 'ParkingCircle',
    color: 'amber',
    cycleYears: 18,
    firstAfterBuilt: 15,
    keywords: ['주차장', '주차', '에폭시', '아스팔트', '바닥재', '주차라인'],
    avgCostPerHousehold: 400_000,
    description: '지상/지하 주차장 도장·균열 보수 (평균 18년 주기)',
  },
  landscape: {
    code: 'landscape',
    label: '조경',
    icon: 'TreePine',
    color: 'green',
    cycleYears: 10,
    firstAfterBuilt: 8,
    keywords: ['조경', '식재', '잔디', '수목', '벤치', '놀이터'],
    avgCostPerHousehold: 250_000,
    description: '식재·시설물 갱신 (평균 10년 주기, 입주민 만족도)',
  },
};

export const WORK_CATEGORY_LIST: WorkCategoryMeta[] = Object.values(WORK_CATEGORIES);

// ============================================================
// 유지관리이력 workType → category 매칭
// ============================================================
export function classifyWorkType(workType: string | null | undefined): WorkCategoryCode | null {
  if (!workType) return null;
  const wt = workType.toString();
  for (const meta of WORK_CATEGORY_LIST) {
    if (meta.keywords.some((kw) => wt.includes(kw))) {
      return meta.code;
    }
  }
  return null;
}

// ============================================================
// 단지별 공종별 마지막 공사 연도 추출
// ============================================================
export type LastWorkByCategory = Partial<Record<WorkCategoryCode, number>>;

export function extractLastWorkByCategory(
  history: Array<{ workType?: string | null; workYear?: string | number | null }>,
): LastWorkByCategory {
  const out: LastWorkByCategory = {};
  for (const h of history) {
    const code = classifyWorkType(h.workType);
    if (!code) continue;
    const y = Number(h.workYear);
    if (!Number.isFinite(y)) continue;
    const prev = out[code];
    if (prev == null || y > prev) out[code] = y;
  }
  return out;
}

// ============================================================
// 공종별 추천 점수 + "지금 발주 시기인가?"
// ============================================================
export interface CategoryPrediction {
  code: WorkCategoryCode;
  label: string;
  icon: string;
  color: WorkCategoryMeta['color'];
  /** 마지막 공사 연도 (없으면 null) */
  lastYear: number | null;
  /** 다음 권장 발주 연도 (마지막 공사 + cycleYears, 없으면 builtYear + firstAfterBuilt) */
  expectedYear: number;
  /** 권장 시점까지 남은 연수 (음수 = 이미 지남 = 시급) */
  yearsUntilExpected: number;
  /** 시급도 점수 0~100 */
  urgency: number;
  /** 사용자에게 보여줄 상태 라벨 */
  status: 'overdue' | 'now' | 'soon' | 'future';
  statusLabel: string;
  /** 영업 참고용 — 예상 공사비 (세대수 × 세대당 평균) */
  estimatedCost: number | null;
  /** 1줄 권장 메시지 */
  recommendation: string;
}

export function predictAllCategories(input: {
  builtYear: number | null;
  households: number | null;
  lastWorkByCategory?: LastWorkByCategory;
  currentYear?: number;
}): CategoryPrediction[] {
  const currentYear = input.currentYear ?? new Date().getFullYear();
  const last = input.lastWorkByCategory ?? {};

  return WORK_CATEGORY_LIST.map((meta) => {
    const lastYear = last[meta.code] ?? null;
    const baseYear =
      lastYear ??
      (input.builtYear != null ? input.builtYear + meta.firstAfterBuilt : currentYear);
    const expectedYear = lastYear != null ? lastYear + meta.cycleYears : baseYear;
    const yearsUntilExpected = expectedYear - currentYear;

    // urgency: 음수 = 이미 지남 → 80~100, 0~2년 → 60~80, 3~5년 → 40~60, 그 외 → 0~40
    let urgency: number;
    let status: CategoryPrediction['status'];
    let statusLabel: string;
    if (yearsUntilExpected <= 0) {
      urgency = Math.min(100, 80 + Math.abs(yearsUntilExpected) * 2);
      status = 'overdue';
      statusLabel = lastYear != null
        ? `${Math.abs(yearsUntilExpected)}년 지남 — 즉시 검토`
        : '주기 도래 — 즉시 검토';
    } else if (yearsUntilExpected <= 2) {
      urgency = 60 + (2 - yearsUntilExpected) * 10;
      status = 'now';
      statusLabel = `${yearsUntilExpected}년 내 발주 임박`;
    } else if (yearsUntilExpected <= 5) {
      urgency = 30 + (5 - yearsUntilExpected) * 6;
      status = 'soon';
      statusLabel = `${yearsUntilExpected}년 후 예정`;
    } else {
      urgency = Math.max(5, 30 - (yearsUntilExpected - 5) * 2);
      status = 'future';
      statusLabel = `${expectedYear}년 예정`;
    }

    const estimatedCost =
      input.households != null
        ? input.households * meta.avgCostPerHousehold
        : null;

    const recommendation = buildRecommendation(meta, lastYear, yearsUntilExpected, currentYear);

    return {
      code: meta.code,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      lastYear,
      expectedYear,
      yearsUntilExpected,
      urgency: Math.round(urgency),
      status,
      statusLabel,
      estimatedCost,
      recommendation,
    };
  }).sort((a, b) => b.urgency - a.urgency);
}

function buildRecommendation(
  meta: WorkCategoryMeta,
  lastYear: number | null,
  yearsUntil: number,
  currentYear: number,
): string {
  if (lastYear == null) {
    if (yearsUntil <= 0) return `${meta.label} 공사 이력 없음 — ${currentYear}년 기준 권장 주기 도래`;
    return `${meta.label} 공사 이력 없음 — ${yearsUntil}년 후 첫 공사 시점`;
  }
  if (yearsUntil <= 0) {
    const yearsSince = currentYear - lastYear;
    return `마지막 공사 ${lastYear}년 (${yearsSince}년 경과) — 재공사 주기 ${meta.cycleYears}년 도래`;
  }
  return `마지막 공사 ${lastYear}년 — 다음 권장 ${lastYear + meta.cycleYears}년`;
}

// ============================================================
// 상위 추천 공종 (상세 페이지의 "추천 공종" 섹션용)
// ============================================================
export function topRecommendedCategories(
  predictions: CategoryPrediction[],
  limit = 3,
): CategoryPrediction[] {
  return predictions
    .filter((p) => p.status === 'overdue' || p.status === 'now')
    .slice(0, limit);
}
