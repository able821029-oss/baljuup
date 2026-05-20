/**
 * 법적 문서 본문용 공통 스타일 컴포넌트
 *
 * <H1>, <H2>, <P>, <Ul>, <Li>, <Section>
 *
 * 별도 typography 플러그인 의존 없이 일관된 톤 유지.
 */

import type { ReactNode } from "react";

export function LegalTitle({ children, version, effective }: {
  children: ReactNode;
  version: string;
  effective: string;
}) {
  return (
    <header className="border-b border-slate-200 pb-5">
      <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
        {children}
      </h1>
      <p className="mt-2 text-xs text-on-surface-var">
        버전 <span className="font-semibold">{version}</span> · 시행일{" "}
        <span className="font-semibold">{effective}</span>
      </p>
    </header>
  );
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-8 text-lg font-bold text-on-surface sm:text-xl">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-5 text-base font-semibold text-on-surface">
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[15px] leading-relaxed text-on-surface-var">{children}</p>;
}

export function Ul({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-on-surface-var marker:text-slate-400">
      {children}
    </ul>
  );
}

export function Ol({ children }: { children: ReactNode }) {
  return (
    <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-on-surface-var marker:text-slate-400 marker:font-semibold">
      {children}
    </ol>
  );
}

export function Li({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}

export function Table({ headers, rows }: {
  headers: string[];
  rows: (string | ReactNode)[][];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-on-surface-var">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="border-b border-slate-200 px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, ri) => (
            <tr key={ri} className="text-on-surface">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
      {children}
    </div>
  );
}
