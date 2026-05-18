/**
 * 발주Up 브랜드 로고
 *
 * 사용:
 *   <Logo />                       // 기본 크기 (md, 밝은 배경용)
 *   <Logo size="lg" />              // 큰 사이즈
 *   <Logo as="link" href="/" />     // 클릭하면 홈으로
 *
 * 변형:
 *   - default: 원본 색상 (다크 블루 + 글로우). 밝은 배경에서 사용.
 *   - inverted: 화이트 톤으로 반전. 다크 배경(사이드바 등)에서 사용.
 *
 * 자산:
 *   public/logo.svg  — 일반 사용 (벡터, 글로우 효과 포함)
 *   public/logo.png  — react-pdf 등 SVG 미지원 환경
 *
 * 접근성:
 *   alt 텍스트는 항상 "발주Up". 데코레이션 용도면 alt="" + role="presentation".
 */

import Image from 'next/image';
import Link from 'next/link';

export interface LogoProps {
  /** 로고 크기 — sm: 헤더 작게, md: 일반, lg: 랜딩/메인 */
  size?: 'sm' | 'md' | 'lg';
  /** 다크 배경에서 화이트 반전이 필요할 때 */
  inverted?: boolean;
  /** href 가 있으면 Link 로 감싸진다 */
  href?: string;
  /** 우선순위 이미지 (LCP 후보) — auth/사이드바 헤더처럼 첫 화면이면 true */
  priority?: boolean;
  /** 추가 className (외곽 wrapper 에 적용) */
  className?: string;
  /** alt 텍스트 — 데코레이션 용도면 "" 지정 */
  alt?: string;
}

const SIZES = {
  sm: { width: 96, height: 28 },
  md: { width: 140, height: 42 },
  lg: { width: 200, height: 60 },
} as const;

export function Logo({
  size = 'md',
  inverted = false,
  href,
  priority = false,
  className,
  alt = '발주Up',
}: LogoProps) {
  const { width, height } = SIZES[size];

  const img = (
    <Image
      src="/logo.svg"
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      // 다크 배경용 — brightness 0 으로 모든 채널 0 → invert 로 흰색화.
      // 글로우는 다소 손상되지만 텍스트/형태는 또렷.
      className={inverted ? 'brightness-0 invert' : undefined}
      // 알파 채널 보존을 위해 unoptimized — Next 의 PNG/WebP 자동 변환이 SVG 글로우를 깨뜨릴 수 있음
      unoptimized
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={alt}
        className={['inline-flex items-center', className ?? ''].join(' ')}
      >
        {img}
      </Link>
    );
  }

  return <span className={['inline-flex items-center', className ?? ''].join(' ')}>{img}</span>;
}
