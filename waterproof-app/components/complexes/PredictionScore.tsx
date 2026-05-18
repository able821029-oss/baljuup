/**
 * 예측 점수 배지 — 단지의 발주 임박도를 한눈에 보여주는 카드
 *
 * 사용 예:
 *   <PredictionScore
 *     score={87}
 *     complexName="래미안 강남힐스테이트"
 *     expectedYear={2026}
 *     fundBalance={320_000_000}
 *   />
 *
 * 디자인:
 *   - 점수 폰트: Bebas Neue 36px (var(--font-bebas) 또는 font-mono fallback)
 *   - 80~100  : 빨강  (#DC2626) "즉시 접촉"
 *   - 60~79   : 주황  (#EA580C) "6개월 내"
 *   - 40~59   : 노랑  (#CA8A04) "1년 내"
 *    0~39   : 회색  (#6B7280) "장기 모니터링"
 */

import { SCORE_TIERS, getTierFromScore, type ScoreTier } from '@/lib/prediction';

export interface PredictionScoreProps {
  score: number;                    // 0~100
  complexName: string;
  expectedYear: number;
  fundBalance?: number | null;      // 원 단위
  className?: string;
  compact?: boolean;                // true면 가로 폭 작게 (테이블 행용)
  onClick?: () => void;
}

export function PredictionScore({
  score,
  complexName,
  expectedYear,
  fundBalance,
  className = '',
  compact = false,
  onClick,
}: PredictionScoreProps) {
  const tier: ScoreTier = getTierFromScore(score);
  const palette = SCORE_TIERS[tier];

  const padding = compact ? 'p-3' : 'p-4 sm:p-5';
  const scoreSize = compact ? 'text-3xl' : 'text-4xl sm:text-[40px]';
  const nameSize = compact ? 'text-sm' : 'text-sm sm:text-base';

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={[
        'rounded-xl border-[1.5px] transition-all duration-150',
        onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.99]' : '',
        padding,
        className,
      ].join(' ')}
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.border,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* 단지 정보 (좌측) */}
        <div className="min-w-0 flex-1">
          <div className={`font-semibold text-gray-900 truncate ${nameSize}`}>
            {complexName}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            예상 발주 <span className="font-medium text-gray-700">{expectedYear}년</span>
          </div>
          {fundBalance != null && fundBalance > 0 && (
            <div className="mt-0.5 text-xs text-gray-500">
              충당금{' '}
              <span className="font-medium text-gray-700">
                {(fundBalance / 100_000_000).toFixed(1)}억원
              </span>
            </div>
          )}
        </div>

        {/* 점수 (우측) */}
        <div className="text-right shrink-0">
          <div
            className={`${scoreSize} font-bold leading-none tracking-tight tabular-nums`}
            style={{
              color: palette.text,
              fontFamily: "var(--font-bebas, 'Bebas Neue'), 'Pretendard Variable', sans-serif",
            }}
          >
            {score}
          </div>
          <div
            className="mt-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: palette.text }}
          >
            {palette.label}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 점수만 한 줄로 보여주는 미니 배지 (테이블 셀, 리스트 등에서 사용)
 */
export function PredictionScoreBadge({ score }: { score: number }) {
  const tier = getTierFromScore(score);
  const palette = SCORE_TIERS[tier];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums"
      style={{
        backgroundColor: palette.bg,
        color: palette.text,
        border: `1px solid ${palette.border}`,
      }}
    >
      <span
        className="inline-block size-1.5 rounded-full"
        style={{ backgroundColor: palette.text }}
      />
      {score}
    </span>
  );
}
