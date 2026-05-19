/**
 * 단지 다중 선택 + 엑셀(CSV) 다운로드
 *
 * 사용:
 *   <RowCheckbox complexId={c.id} />     ← 각 행에
 *   <SelectionFAB />                      ← 페이지 하단 (한 번만)
 *
 * 상태 관리:
 *   - localStorage 키 'baljuup:selected-complexes' 에 ID 배열로 저장
 *   - 동일 페이지 내 + 탭 간에 storage 이벤트로 동기화
 *
 * 다운로드:
 *   - 클릭 시 Server Action `exportSelectedComplexes(ids)` 호출
 *   - 반환된 CSV 문자열을 Blob 으로 만들어 다운로드 트리거
 *   - 파일명: 단지선택_YYYY-MM-DD.csv
 *   - UTF-8 BOM 포함 → 한글 Excel 에서 깨짐 없이 열림
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Trash2, Loader2 } from "lucide-react";
import { exportSelectedComplexes } from "@/app/(dashboard)/complexes/export-action";

const STORAGE_KEY = "baljuup:selected-complexes";

// ============================================================
// 공통 hook — 선택된 ID 목록
// ============================================================
function readSelected(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeSelected(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  // 같은 탭의 다른 컴포넌트는 storage 이벤트가 안 오므로 커스텀 이벤트 발행
  window.dispatchEvent(new CustomEvent("baljuup:selection-changed"));
}

function useSelectedComplexes(): {
  selected: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
} {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setSelected(readSelected());

    const sync = () => setSelected(readSelected());
    window.addEventListener("storage", sync);
    window.addEventListener("baljuup:selection-changed", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("baljuup:selection-changed", sync as EventListener);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const cur = readSelected();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    writeSelected(next);
  }, []);

  const clear = useCallback(() => writeSelected([]), []);

  return {
    selected,
    isSelected: (id) => selected.includes(id),
    toggle,
    clear,
  };
}

// ============================================================
// 행 체크박스
// ============================================================
export function RowCheckbox({ complexId }: { complexId: string }) {
  const { isSelected, toggle } = useSelectedComplexes();
  const checked = isSelected(complexId);
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => toggle(complexId)}
      onClick={(e) => e.stopPropagation()}
      className="size-4 cursor-pointer rounded border-slate-300 text-accent focus:ring-2 focus:ring-accent/40"
      aria-label="이 단지 선택"
    />
  );
}

// ============================================================
// 하단 고정 액션 바 — 선택 1개 이상 시에만 노출
// ============================================================
export function SelectionFAB() {
  const { selected, clear } = useSelectedComplexes();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (selected.length === 0) return null;

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const result = await exportSelectedComplexes(selected);
      if (!result.ok) {
        throw new Error(result.error);
      }

      // CSV → Blob → download
      // UTF-8 BOM 추가 (한글 Excel 호환)
      const blob = new Blob(["﻿" + result.csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `단지선택_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      const err = e as Error;
      setError(err?.message || "다운로드 실패");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 md:left-64 md:right-0">
      <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-2xl shadow-slate-900/10 backdrop-blur-md">
        <div className="flex flex-1 items-center gap-2 px-2">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
            {selected.length}
          </span>
          <span className="text-sm font-semibold text-on-surface">개 단지 선택됨</span>
          {error && (
            <span className="ml-2 truncate text-xs text-red-600" title={error}>
              · {error}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-on-surface-var transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          <Trash2 size={14} />
          전체 해제
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white shadow-md shadow-accent/20 transition-all hover:bg-accent/90 active:scale-[0.98] disabled:opacity-60"
        >
          {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {downloading ? "생성 중..." : "엑셀 다운로드"}
        </button>
      </div>
    </div>
  );
}
