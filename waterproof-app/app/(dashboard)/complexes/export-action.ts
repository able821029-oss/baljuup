/**
 * 선택된 단지들 정보를 CSV 문자열로 만들어 반환하는 Server Action.
 *
 * 클라이언트에서 Blob 으로 변환해 다운로드한다 (UTF-8 BOM 별도 추가).
 *
 * 보안:
 *   - 로그인된 사용자만 호출 가능 (auth check)
 *   - 한 번에 최대 500개 단지로 제한 (대량 export 방지)
 */

"use server";

import { createClient } from "@/lib/supabase/server";

const MAX_IDS = 500;

export interface ExportResult {
  ok: boolean;
  csv: string;
  error?: string;
  count?: number;
}

type ComplexRow = {
  id: string;
  name: string;
  address: string | null;
  sido: string | null;
  sigungu: string | null;
  built_year: number | null;
  households: number | null;
  buildings: number | null;
  management_type: string | null;
  management_company: string | null;
  phone: string | null;
  prediction_score: number | null;
  expected_order_year: number | null;
  last_updated: string | null;
};

export async function exportSelectedComplexes(ids: string[]): Promise<ExportResult> {
  // ── 1. 입력 검증 ────────────────────────────────────
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, csv: "", error: "선택된 단지가 없습니다" };
  }
  if (ids.length > MAX_IDS) {
    return { ok: false, csv: "", error: `한 번에 최대 ${MAX_IDS}개까지 다운로드 가능합니다` };
  }
  // 단순 UUID 형식 검증 (느슨)
  const valid = ids.filter((id) => typeof id === "string" && id.length >= 8 && id.length <= 64);
  if (valid.length === 0) {
    return { ok: false, csv: "", error: "유효한 단지 ID 가 없습니다" };
  }

  // ── 2. 인증 ─────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, csv: "", error: "로그인이 필요합니다" };
  }

  // ── 3. 데이터 조회 ──────────────────────────────────
  const { data, error } = await supabase
    .from("complexes")
    .select(
      "id, name, address, sido, sigungu, built_year, households, buildings, management_type, management_company, phone, prediction_score, expected_order_year, last_updated",
    )
    .in("id", valid)
    .order("prediction_score", { ascending: false });

  if (error) {
    return { ok: false, csv: "", error: "DB 조회 실패: " + error.message };
  }
  const rows = ((data ?? []) as unknown) as ComplexRow[];

  // ── 4. CSV 생성 ─────────────────────────────────────
  const headers = [
    "단지명",
    "주소",
    "시도",
    "시군구",
    "준공연도",
    "노후(년)",
    "세대수",
    "동수",
    "관리방식",
    "관리회사",
    "관리사무소 전화",
    "예측 점수",
    "예상 발주 연도",
    "마지막 분석일",
  ];

  const currentYear = new Date().getFullYear();
  const lines: string[] = [headers.map(csvCell).join(",")];

  for (const r of rows) {
    const ageYears = r.built_year ? currentYear - r.built_year : null;
    lines.push(
      [
        r.name,
        r.address ?? "",
        r.sido ?? "",
        r.sigungu ?? "",
        r.built_year ?? "",
        ageYears ?? "",
        r.households ?? "",
        r.buildings ?? "",
        r.management_type ?? "",
        r.management_company ?? "",
        r.phone ?? "",
        r.prediction_score ?? "",
        r.expected_order_year ?? "",
        r.last_updated ? r.last_updated.slice(0, 10) : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  // Excel 호환을 위해 \r\n 줄바꿈
  const csv = lines.join("\r\n");

  return { ok: true, csv, count: rows.length };
}

// ============================================================
// CSV 셀 이스케이핑 — 쉼표/따옴표/줄바꿈 포함 시 따옴표로 감싸고 " → ""
// ============================================================
function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s === "") return "";
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
