/**
 * 페이지네이션 (Server Component — Link 만 사용)
 *
 * 표시: 이전 / [페이지 번호 7개 윈도우] / 다음
 */

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseQuery: Record<string, string>; // 현재 URL 의 쿼리 (page 제외)
}

export function Pagination({ currentPage, totalPages, baseQuery }: PaginationProps) {
  if (totalPages <= 1) return null;

  // 윈도우 7개 (현재 ± 3)
  const pages: number[] = [];
  const start = Math.max(1, currentPage - 3);
  const end = Math.min(totalPages, start + 6);
  for (let i = start; i <= end; i++) pages.push(i);

  const link = (p: number) => {
    const q = new URLSearchParams(baseQuery);
    if (p > 1) q.set('page', String(p));
    return `/complexes${q.toString() ? '?' + q.toString() : ''}`;
  };

  return (
    <nav className="flex items-center justify-center gap-1 py-4" aria-label="페이지네이션">
      <PaginationLink
        href={link(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        ariaLabel="이전 페이지"
      >
        <ChevronLeft size={14} />
      </PaginationLink>

      {start > 1 && (
        <>
          <PaginationLink href={link(1)}>1</PaginationLink>
          {start > 2 && <span className="px-1 text-xs text-gray-400">…</span>}
        </>
      )}

      {pages.map((p) => (
        <PaginationLink key={p} href={link(p)} active={p === currentPage}>
          {p}
        </PaginationLink>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-xs text-gray-400">…</span>}
          <PaginationLink href={link(totalPages)}>{totalPages}</PaginationLink>
        </>
      )}

      <PaginationLink
        href={link(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        ariaLabel="다음 페이지"
      >
        <ChevronRight size={14} />
      </PaginationLink>
    </nav>
  );
}

function PaginationLink({
  href,
  children,
  active,
  disabled,
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const cls = [
    'flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-xs tabular-nums transition-colors',
    active
      ? 'bg-[#0F4C8A] font-semibold text-white'
      : disabled
        ? 'cursor-not-allowed text-gray-300'
        : 'text-gray-700 hover:bg-gray-100',
  ].join(' ');

  if (disabled) {
    return <span className={cls} aria-disabled="true">{children}</span>;
  }
  return (
    <Link href={href} className={cls} aria-label={ariaLabel} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  );
}
