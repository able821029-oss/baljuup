/**
 * POST /api/proposals/[id]/send
 *
 * 제안서를 PDF 로 렌더링하여 Resend 를 통해 첨부 메일로 발송한다.
 *
 * Body (JSON):
 *   {
 *     to: string,          // 수신자 이메일 (관리소장)
 *     message?: string,    // 본문 추가 메모 (선택)
 *   }
 *
 * Response:
 *   성공 200: { ok: true, messageId: string, sentAt: string, sentCount: number }
 *   실패 400: { ok: false, error: string }              ← 입력 검증 실패
 *   실패 401: { ok: false, error: '로그인이 필요합니다.' }
 *   실패 404: { ok: false, error: '제안서를 찾을 수 없습니다.' }
 *   실패 500: { ok: false, error: string, code?: string } ← Resend / PDF / DB 오류
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import type { GeneratedProposal } from '@/lib/claude';
import {
  renderProposalPdfBuffer,
  buildProposalPdfFilename,
} from '@/lib/pdf/proposal-pdf-server';

export const runtime = 'nodejs';   // @react-pdf/renderer 는 Node 런타임 필요
export const maxDuration = 60;     // PDF 렌더 + 메일 전송 여유

// ============================================================
// 입력 형태
// ============================================================
type SendBody = {
  to: string;
  message?: string;
};

type ProposalRow = {
  id: string;
  user_id: string;
  title: string | null;
  status: string;
  content: {
    proposal?: GeneratedProposal;
    input?: {
      complex?: { name?: string; address?: string };
      userCompany?: { name?: string; owner?: string };
      workScope?: { scope?: string };
    };
  } | null;
  sent_count: number | null;
  complexes: { name: string } | { name: string }[] | null;
};

// ============================================================
// 메인 핸들러
// ============================================================
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  const { id: proposalId } = await Promise.resolve(params);

  // 1) Body 파싱
  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: '요청 본문이 유효한 JSON이 아닙니다.' },
      { status: 400 },
    );
  }

  const validated = validateInput(body);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error },
      { status: 400 },
    );
  }
  const { to, message } = validated.data;

  // 2) Resend 설정 확인 (런타임에 누락 감지)
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!resendApiKey) {
    return NextResponse.json(
      { ok: false, error: 'RESEND_API_KEY 환경변수가 설정되지 않았습니다.', code: 'no_api_key' },
      { status: 500 },
    );
  }
  if (!fromEmail) {
    return NextResponse.json(
      { ok: false, error: 'RESEND_FROM_EMAIL 환경변수가 설정되지 않았습니다.', code: 'no_from_email' },
      { status: 500 },
    );
  }

  // 3) 인증 확인 + 제안서 조회 (RLS 로 본인 것만 노출)
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
    .select('id, user_id, title, status, content, sent_count, complexes(name)')
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
    // RLS 가 정상 동작하면 닿지 않지만 방어적으로 한 번 더 차단
    return NextResponse.json(
      { ok: false, error: '본인 제안서만 발송할 수 있습니다.' },
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

  const complexFromJoin = Array.isArray(row.complexes) ? row.complexes[0] : row.complexes;
  const complexName =
    complexFromJoin?.name ?? row.content?.input?.complex?.name ?? '아파트';
  const companyName = row.content?.input?.userCompany?.name ?? '';
  const ownerName = row.content?.input?.userCompany?.owner ?? '';
  const workScope = row.content?.input?.workScope?.scope ?? '';

  // 4) PDF 렌더
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

  const filename = buildProposalPdfFilename(complexName);

  // 5) Resend 발송
  const resend = new Resend(resendApiKey);
  const subject = row.title ?? `${complexName} ${workScope} 제안서`;

  let resendMessageId: string | undefined;
  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html: buildEmailHtml({
        complexName,
        companyName,
        ownerName,
        workScope,
        message,
      }),
      attachments: [
        {
          filename,
          content: pdfBuffer,
        },
      ],
    });

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error: `이메일 전송 실패: ${result.error.message}`,
          code: 'resend_error',
        },
        { status: 502 },
      );
    }
    resendMessageId = result.data?.id;
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { ok: false, error: `이메일 전송 실패: ${err.message}`, code: 'resend_throw' },
      { status: 502 },
    );
  }

  // 6) 발송 이력 기록
  const sentAt = new Date().toISOString();
  const nextSentCount = (row.sent_count ?? 0) + 1;

  // 처음 발송이면 status 도 'sent' 로 끌어올린다 (사용자가 won/lost 로 바꿨다면 유지).
  const nextStatus =
    row.status === 'draft' ? 'sent' : row.status;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase.from('proposals') as any)
    .update({
      sent_at: sentAt,
      sent_to: to,
      sent_count: nextSentCount,
      status: nextStatus,
    })
    .eq('id', proposalId)
    .eq('user_id', user.id);

  if (updateError) {
    // 이메일은 발송됐지만 DB 업데이트가 실패한 상태 — 호출 측에 알리되 성공으로 처리하지 않는다
    return NextResponse.json(
      {
        ok: false,
        error: `이메일은 발송되었으나 발송 이력 기록 실패: ${updateError.message}`,
        code: 'db_update_failed',
        messageId: resendMessageId,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    messageId: resendMessageId,
    sentAt,
    sentTo: to,
    sentCount: nextSentCount,
  });
}

// ============================================================
// 입력 검증
// ============================================================
function validateInput(
  body: unknown,
):
  | { ok: true; data: { to: string; message?: string } }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: '요청 본문이 비어 있습니다.' };
  }

  const { to, message } = body as Partial<SendBody>;
  if (typeof to !== 'string' || !to.trim()) {
    return { ok: false, error: '수신자 이메일(to)이 필요합니다.' };
  }

  const trimmed = to.trim();
  if (!isEmail(trimmed)) {
    return { ok: false, error: '올바른 이메일 형식이 아닙니다.' };
  }

  const trimmedMessage =
    typeof message === 'string' && message.trim().length > 0
      ? message.trim().slice(0, 2000)
      : undefined;

  return { ok: true, data: { to: trimmed, message: trimmedMessage } };
}

function isEmail(value: string): boolean {
  // 너무 느슨하지도, 너무 엄격하지도 않은 실용 패턴
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

// ============================================================
// 메일 본문 빌더 — 단순 HTML (Resend 가 plain text 자동 생성)
// ============================================================
function buildEmailHtml(input: {
  complexName: string;
  companyName: string;
  ownerName: string;
  workScope: string;
  message?: string;
}): string {
  const { complexName, companyName, ownerName, workScope, message } = input;
  const safeMessage = message ? escapeHtml(message).replace(/\n/g, '<br/>') : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1F2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="padding:20px 24px;border-bottom:2px solid #0F4C8A;">
        <div style="font-size:11px;color:#FF6B35;font-weight:700;letter-spacing:1px;">방수 공사 제안서</div>
        <div style="font-size:18px;font-weight:700;color:#0F1E36;margin-top:4px;">${escapeHtml(complexName)} ${escapeHtml(workScope || '방수공사')} 제안</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;font-size:14px;line-height:1.7;color:#1F2937;">
        <p style="margin:0 0 12px;">안녕하세요, ${escapeHtml(complexName)} 관리소장님.</p>
        <p style="margin:0 0 12px;"><strong>${escapeHtml(companyName)}</strong> (대표 ${escapeHtml(ownerName)}) 입니다.</p>
        <p style="margin:0 0 12px;">단지의 노후도와 장기수선충당금 현황을 바탕으로 작성한 <strong>${escapeHtml(workScope || '방수공사')} 제안서</strong>를 첨부드립니다. 첨부된 PDF 를 확인하시고 편하실 때 회신 부탁드립니다.</p>
        ${
          safeMessage
            ? `<div style="margin:16px 0;padding:14px 16px;background:#F9FAFB;border-left:3px solid #0F4C8A;font-size:14px;line-height:1.6;color:#374151;">${safeMessage}</div>`
            : ''
        }
        <p style="margin:16px 0 0;">감사합니다.<br/>${escapeHtml(companyName)} · ${escapeHtml(ownerName)} 대표</p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px;background:#F9FAFB;font-size:11px;color:#6B7280;border-top:1px solid #E5E7EB;">
        본 메일은 발주Up 을 통해 자동 발송되었습니다.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
// 절대 URL 빌더 — PDF 렌더러가 로고 이미지를 fetch 할 수 있도록
// ============================================================
function absoluteUrl(req: NextRequest, path: string): string {
  const envUrl = process.env.NEXT_PUBLIC_URL;
  if (envUrl) {
    return new URL(path, envUrl).toString();
  }
  // 폴백: 요청 호스트 기반
  const origin = req.nextUrl.origin || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return new URL(path, origin).toString();
}
