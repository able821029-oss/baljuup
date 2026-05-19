/**
 * 관심단지 영업 추적 — Server Actions
 *
 * 모든 액션은 RLS 로 본인 행만 접근 가능.
 * UI 의 form action / 클라이언트 컴포넌트에서 호출.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  SalesTrackingPriority,
  SalesTrackingStatus,
} from "@/lib/supabase/database.types";

const VALID_STATUSES: SalesTrackingStatus[] = [
  "interested",
  "contacted",
  "meeting",
  "proposed",
  "won",
  "lost",
  "on_hold",
];

const VALID_PRIORITIES: SalesTrackingPriority[] = ["high", "normal", "low"];

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ============================================================
// 토글 — 추적 추가/제거 (별표 버튼)
// ============================================================
export async function toggleTracking(complexId: string): Promise<ActionResult<{ tracked: boolean }>> {
  if (!complexId || typeof complexId !== "string") {
    return { ok: false, error: "잘못된 단지 ID" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  // 1. 이미 있는지 조회
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = supabase.from("sales_tracking") as any;
  const { data: existing, error: selErr } = await table
    .select("id")
    .eq("user_id", user.id)
    .eq("complex_id", complexId)
    .maybeSingle();

  if (selErr) return { ok: false, error: selErr.message };

  if (existing) {
    // 제거
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("sales_tracking") as any)
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/tracking");
    revalidatePath(`/complexes/${complexId}`);
    revalidatePath("/complexes");
    return { ok: true, data: { tracked: false } };
  }

  // 추가
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("sales_tracking") as any)
    .insert({ user_id: user.id, complex_id: complexId });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/tracking");
  revalidatePath(`/complexes/${complexId}`);
  revalidatePath("/complexes");
  return { ok: true, data: { tracked: true } };
}

// ============================================================
// 상태 업데이트
// ============================================================
export async function updateTrackingStatus(
  trackingId: string,
  status: SalesTrackingStatus,
): Promise<ActionResult> {
  if (!VALID_STATUSES.includes(status)) {
    return { ok: false, error: "유효하지 않은 상태값" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  // won/lost 일 때만 closed_at 자동 세팅, 이외에는 null 로 되돌림
  const patch: Record<string, unknown> = { status };
  if (status === "won" || status === "lost") {
    patch.closed_at = new Date().toISOString();
  } else {
    patch.closed_at = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("sales_tracking") as any)
    .update(patch)
    .eq("id", trackingId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/tracking");
  return { ok: true };
}

// ============================================================
// 우선순위 업데이트
// ============================================================
export async function updateTrackingPriority(
  trackingId: string,
  priority: SalesTrackingPriority,
): Promise<ActionResult> {
  if (!VALID_PRIORITIES.includes(priority)) {
    return { ok: false, error: "유효하지 않은 우선순위" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("sales_tracking") as any)
    .update({ priority })
    .eq("id", trackingId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/tracking");
  return { ok: true };
}

// ============================================================
// 메모/일정/계약금액 업데이트
// ============================================================
export interface UpdateTrackingDetailsInput {
  memo?: string | null;
  last_contact_at?: string | null;  // ISO or null
  next_action_at?: string | null;   // ISO or null
  contract_amount?: number | null;  // 원 단위
}

export async function updateTrackingDetails(
  trackingId: string,
  input: UpdateTrackingDetailsInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const patch: Record<string, unknown> = {};
  if (input.memo !== undefined) {
    const memo = input.memo == null ? null : String(input.memo).slice(0, 4000);
    patch.memo = memo;
  }
  if (input.last_contact_at !== undefined) patch.last_contact_at = input.last_contact_at;
  if (input.next_action_at !== undefined) patch.next_action_at = input.next_action_at;
  if (input.contract_amount !== undefined) {
    if (input.contract_amount != null && (!Number.isFinite(input.contract_amount) || input.contract_amount < 0)) {
      return { ok: false, error: "계약금액이 유효하지 않습니다" };
    }
    patch.contract_amount = input.contract_amount;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("sales_tracking") as any)
    .update(patch)
    .eq("id", trackingId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/tracking");
  return { ok: true };
}

// ============================================================
// 빠른 액션: 마지막 연락을 지금으로 기록
// ============================================================
export async function logContactNow(trackingId: string): Promise<ActionResult> {
  return updateTrackingDetails(trackingId, {
    last_contact_at: new Date().toISOString(),
  });
}

// ============================================================
// 삭제 (목록에서 완전히 제거)
// ============================================================
export async function deleteTracking(trackingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("sales_tracking") as any)
    .delete()
    .eq("id", trackingId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/tracking");
  revalidatePath("/complexes");
  return { ok: true };
}
