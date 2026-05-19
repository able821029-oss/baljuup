/**
 * 공종 카테고리 아이콘 — lucide-react 매핑
 *
 * 사용:
 *   <CategoryIcon iconName="Umbrella" color="blue" />
 *   <CategoryIcon iconName="Paintbrush" color="orange" size={14} />
 *
 * 디자인:
 *   - 둥근 사각 배경 (카테고리 컬러 50% tint)
 *   - 아이콘 색은 동일 컬러 600
 *
 * Server Component 안전 — 상태 없음, lucide-react 아이콘만 렌더.
 */

import {
  Umbrella,
  Paintbrush,
  ArrowUpDown,
  Wrench,
  ParkingCircle,
  TreePine,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Umbrella,
  Paintbrush,
  ArrowUpDown,
  Wrench,
  ParkingCircle,
  TreePine,
};

// work-categories.ts의 color 키와 매핑
const COLOR_MAP: Record<string, { bg: string; fg: string }> = {
  blue: { bg: 'bg-blue-50', fg: 'text-blue-600' },
  orange: { bg: 'bg-orange-50', fg: 'text-orange-600' },
  purple: { bg: 'bg-purple-50', fg: 'text-purple-600' },
  cyan: { bg: 'bg-cyan-50', fg: 'text-cyan-600' },
  amber: { bg: 'bg-amber-50', fg: 'text-amber-600' },
  green: { bg: 'bg-emerald-50', fg: 'text-emerald-600' },
};

interface Props {
  iconName: string;
  color: string;
  /** 아이콘 자체 픽셀 크기 (배경 박스는 +12px) */
  size?: number;
  className?: string;
}

export function CategoryIcon({ iconName, color, size = 14, className }: Props) {
  const Icon = ICON_MAP[iconName] ?? Wrench;
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue;
  const boxSize = size + 12;

  return (
    <span
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-md',
        c.bg,
        c.fg,
        className ?? '',
      ].join(' ')}
      style={{ width: boxSize, height: boxSize }}
      aria-hidden="true"
    >
      <Icon size={size} strokeWidth={2.2} />
    </span>
  );
}
