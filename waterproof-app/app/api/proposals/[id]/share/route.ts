/**
 * POST /api/proposals/[id]/share
 *
 * 제안서를 PDF 로 렌더링하여 Supabase Storage 에 업로드하고,
 * 공개 접근 가능한 공유 링크(/share/{token})를 생성/반환한다.
 *
 * Body (JSON, 모두 선택):
 *   {
 *     expiresInDays?: number,   // 1~365, 미지정/0/null = 무기한
 *     regenerate?: boolean,     // true 면 PDF 재생성 및 토큰 갱신
 *   }
 *
 * Response:
 *   성공 200: {
 *     ok: true,
 *     url: string,            // 공유용 풀 URL (https://app/share/{token})
 *     token: string,
 *     pdfUrl: string,         // Supabase Storage 의 PDF 공개 URL (직접 다운로드용)
 *     expiresAt: string | null,
 *   }
 *   실패 400: { ok: false, error }              ← 입력 검증 실패
 *   실패 401: { ok: false, error: '로그인이 필요합니다.' }
 *   실패 403: { ok: false, error: '본인 제안서만 공유할 수 있습니다.' }
 *   실패 404: { ok: false, error: '제안서를 찾을 수 없습니다.' }
 *   실패 500: { ok: false, error, code? }       ← PDF / Storage / DB 오류
 */

import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  renderProposalPdfBuffer,
  buildProposalPdfFilename,
} from '@/lib/pdf/proposal-pdf-server';
import type { GeneratedProposal } from '@/lib/claude';

export const runtime = 'nodejs';   // @react-pdf/renderer 는 Node 런타임 필요
export const maxDuration = 60;     // PDF 렌더 + 업로드 여유

// ============================================================
// 입력 / 행 타입
// ============================================================
type ShareBody = {
  expiresInDays?: number | null;
  regenerate?: boolean;
};

type ProposalRow = {
  id: string;
  user_id: string;
  title: string | null;
  content: {
    proposal?: GeneratedProposal;
    input?: {
      complex?: { name?: string };
      userCompany?: { name?: string; owner?: string };
      workScope?: { scope?: string };
    };
  } | null;
  share_url: string | null;
  share_token: string | null;
  share_expires_at: string | null;
  complexes: { name: string } | { name: string }[] | null;
};

const BUCKET = 'proposals';

// ============================================================
// 메인 핸들러
// ============================================================
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  const { id: proposalId } = await Promise.resolve(params);

  // 1) Body 파싱 (Body 없이 호출되어도 OK)
  let body: ShareBody = {};
  const contentLength = req.headers.get('content-length');
  if (contentLength && contentLength !== '0') {
    try {
      body = (await req.json()) as ShareBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: '요청 본문이 유효한 JSON이 아닙니다.' },
        { status: 400 },
      );
    }
  }

  const validated = validateInput(body);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error },
      { status: 400 },
    );
  }
  const { expiresInDays, regenerate } = validated.data;

  // 2) 인증 + 제안서 조회 (RLS 본인 것만)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: '로그인이 필요합니다.' },
      { status: 401 },
    );
  }

  const { data, error: fetchError } = await supabase
    .from('proposals')
    .select(
      'id, user_id, title, content, share_url, share_token, share_expires_at, complexes(name)',
    )
    .eq('id', proposalId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { ok: false, error: `제안서 조회 실패: ${fetchError.message}` },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { ok: false, error: '제안서를 찾을 수 없습니다.' },
      { status: 404 },
    );
  }

  const row = data as unknown as ProposalRow;
  if (row.user_id !== user.id) {
    return NextResponse.json(
      { ok: false, error: '본인 제안서만 공유할 수 있습니다.' },
      { status: 403 },
    );
  }

  const generated = row.content?.proposal;
  if (!generated) {
    return NextResponse.json(
      { ok: false, error: '제안서 데이터가 손상되었습니다. (content.proposal 누락)' },
      { status: 500 },
    );
  }

  // 3) 기존 공유 링크가 살아있고 재생성 요청이 아니면 그대로 반환 (멱등)
  const existingToken = row.share_token ?? null;
  const existingShareUrl = row.share_url ?? null;
  const existingExpiresAt = row.share_expires_at ?? null;
  const isAlive =
    existingToken &&
    existingShareUrl &&
    (existingExpiresAt === null || new Date(existingExpiresAt).getTime() > Date.now());

  // 4) Storage 업로드 경로 — proposals/{userId}/{proposalId}.pdf
  const storagePath = `${user.id}/${proposalId}.pdf`;
  const complexFromJoin = Array.isArray(row.complexes) ? row.complexes[0] : row.complexes;
  const complexName =
    complexFromJoin?.name ?? row.content?.input?.complex?.name ?? '아파트';
  const companyName = row.content?.input?.userCompany?.name ?? '';
  const ownerName = row.content?.input?.userCompany?.owner ?? '';
  const workScope = row.content?.input?.workScope?.scope ?? '';

  // 항상 PDF 는 최신 데이터로 다시 만들어 업로드 (멱등 + 사용자 편집 반영)
  let pdfBuffer: Buffer;
  try {
    const logoUrl = absoluteUrl(req, '/logo.png');
    pdfBuffer = await renderProposalPdfBuffer({
      proposal: generated,
      complexName,
      companyName,
      ownerName,
      workScope,
      logoUrl,
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { ok: false, error: `PDF 생성 실패: ${err.message}`, code: 'pdf_render' },
      { status: 500 },
    );
  }

  // 5) Supabase Storage 업로드 — admin 클라이언트로 (RLS 우회, 본인 확인은 위에서 끝남)
  const admin = createAdminClient();
  const uploadResult = await admin.storage.from(BUCKET).upload(storagePath, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,                                 // 재발급 시 덮어쓰기
    cacheControl: '3600',
  });

  if (uploadResult.error) {
    return NextResponse.json(
      {
        ok: false,
        error: `Storage 업로드 실패: ${uploadResult.error.message}`,
        code: 'storage_upload',
      },
      { status: 500 },
    );
  }

  // 6) 공개 URL — 버킷이 public 이므로 곧바로 사용 가능
  const { data: publicUrlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
  const pdfPublicUrl = appendCacheBuster(publicUrlData.publicUrl);

  // 7) 토큰 — 살아있는 토큰이면 재사용, 아니거나 regenerate 면 새로 발급
  const token = isAlive && !regenerate ? existingToken! : generateShareToken();

  // 8) 만료 시각
  const expiresAt =
    expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  // 9) 공유 URL — 절대 URL 로 (카톡 공유 시 그대로 사용)
  const shareUrl = absoluteUrl(req, `/share/${token}`);

  // 10) DB 업데이트
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase.from('proposals') as any)
    .update({
      share_url: shareUrl,
      share_token: token,
      share_expires_at: expiresAt,
      share_created_at: isAlive && !regenerate ? undefined : new Date().toISOString(),
      pdf_url: pdfPublicUrl,
    })
    .eq('id', proposalId)
    .eq('user_id', user.id);

  if (updateError) {
    return NextResponse.json(
      {
        ok: false,
        error: `공유 정보 저장 실패: ${updateError.message}`,
        code: 'db_update_failed',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    url: shareUrl,
    token,
    pdfUrl: pdfPublicUrl,
    expiresAt,
    filename: buildProposalPdfFilename(complexName),
  });
}

// ============================================================
// 입력 검증
// ============================================================
function validateInput(
  body: unknown,
):
  | { ok: true; data: { expiresInDays: number | null; regenerate: boolean } }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: true, data: { expiresInDays: null, regenerate: false } };
  }

  const { expiresInDays, regenerate } = body as ShareBody;

  let normalizedDays: number | null = null;
  if (expiresInDays !== undefined && expiresInDays !== null) {
    const n = Number(expiresInDays);
    if (!Number.isFinite(n) || Math.floor(n) !== n) {
      return { ok: false, error: 'expiresInDays 는 정수여야 합니다.' };
    }
    if (n < 0 || n > 365) {
      return { ok: false, error: 'expiresInDays 는 0~365 범위여야 합니다.' };
    }
    normalizedDays = n === 0 ? null : n;
  }

  return {
    ok: true,
    data: {
      expiresInDays: normalizedDays,
      regenerate: Boolean(regenerate),
    },
  };
}

// ============================================================
// 토큰 생성 — URL-safe base64, 약 24자 (16 바이트)
// ============================================================
function generateShareToken(): string {
  return randomBytes(16)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ============================================================
// 절대 URL — 카톡/이메일 등 외부 공유에 사용
// ============================================================
function absoluteUrl(req: NextRequest, path: string): string {
  const envUrl = process.env.NEXT_PUBLIC_URL;
  if (envUrl) {
    return new URL(path, envUrl).toString();
  }
  const origin = req.nextUrl.origin || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return new URL(path, origin).toString();
}

// Storage 의 공개 URL 은 같은 경로에 덮어써도 CDN 캐시가 남을 수 있으니
// 쿼리스트링으로 강제 무효화한다.
function appendCacheBuster(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${Date.now()}`;
}
