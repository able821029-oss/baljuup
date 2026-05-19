/**
 * 표 행(tr) 전체를 클릭 가능한 링크처럼 만드는 래퍼.
 *
 * 왜 a 가 아닌가:
 *   - <tr> 안에 직접 <a> 를 넣을 수 없음 (HTML 표준).
 *   - <tr>::before 같은 absolute 트릭도 tr position:relative 가 브라우저별 불안정.
 *
 * 동작:
 *   - tr 어디든 클릭하면 router.push(href).
 *   - 단, 클릭 대상이 인터랙티브 요소(a, button, input, label, role=button) 안이면
 *     무시 → 체크박스/단지명 Link/관리소장 전화 같은 요소는 본연의 동작 유지.
 *   - cursor:pointer 자동.
 */

"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

const INTERACTIVE_SELECTOR = 'a, button, input, label, select, textarea, [role="button"]';

export function RowLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  const handleClick = (e: MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    router.push(href);
  };

  return (
    <tr
      className={className}
      onClick={handleClick}
      style={{ cursor: "pointer" }}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
    >
      {children}
    </tr>
  );
}
