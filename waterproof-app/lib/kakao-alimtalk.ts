/**
 * 카카오 알림톡 발송 — 알리고(aligo.in) API
 *
 * 솔루션: https://smartsms.aligo.in 가입 후 카카오톡 비즈채널 연결 + 템플릿 등록
 * API 문서: https://smartsms.aligo.in/admin/api/spec.html
 *
 * 사전 등록 필요:
 *   1) 카카오톡 비즈채널 (채널 검색 ID 등록 후 발신키 발급)
 *   2) 알림톡 템플릿 (관리자 페이지에서 사전 심사 통과한 템플릿만 발송 가능)
 *   3) 알리고 회원가입 + API 키 발급
 *
 * 환경변수:
 *   KAKAO_API_KEY        알리고 API 키
 *   KAKAO_SENDER_KEY     카카오 비즈채널 발신키 (senderkey)
 *   KAKAO_USER_ID        알리고 가입 시 ID
 *   KAKAO_SENDER_PHONE   대체발송 SMS 발신번호 (예: 0212345678)
 */

const ALIGO_BASE = 'https://kakaoapi.aligo.in/akv10';

const ENV = {
  apikey: process.env.KAKAO_API_KEY,
  senderkey: process.env.KAKAO_SENDER_KEY,
  userid: process.env.KAKAO_USER_ID,
  sender: process.env.KAKAO_SENDER_PHONE,
};

// ============================================================
// 공통 타입
// ============================================================
export interface AlimtalkMessage {
  phone: string;              // 수신 전화번호 (숫자만, 예: '01012345678')
  templateCode: string;       // 알리고 관리자에 등록한 템플릿 코드
  message: string;            // 변수 치환 완료된 본문 (템플릿 내용과 100% 일치해야 함)
  buttonName?: string;        // 버튼 이름 (예: '제안서 만들기')
  buttonUrl?: string;         // 버튼 URL
  fallbackSms?: string;       // 알림톡 실패 시 SMS 대체 발송 본문 (옵션)
}

export type SendResult =
  | { ok: true; messageId: string; total: number; success: number; failed: number }
  | { ok: false; code: string; message: string };

// ============================================================
// 단건 발송
// ============================================================
export async function sendAlimtalk(msg: AlimtalkMessage): Promise<SendResult> {
  return sendBulkAlimtalk([msg]);
}

// ============================================================
// 일괄 발송 (최대 500건 / 요청)
// ============================================================
export async function sendBulkAlimtalk(messages: AlimtalkMessage[]): Promise<SendResult> {
  if (!ENV.apikey || !ENV.senderkey || !ENV.userid) {
    return { ok: false, code: 'NO_ENV', message: 'KAKAO_API_KEY / KAKAO_SENDER_KEY / KAKAO_USER_ID 환경변수가 없습니다.' };
  }
  if (!messages.length) {
    return { ok: true, messageId: '', total: 0, success: 0, failed: 0 };
  }
  if (messages.length > 500) {
    return { ok: false, code: 'TOO_MANY', message: '1회 최대 500건까지 발송 가능. batch 로 분할하세요.' };
  }

  // 알리고는 모든 메시지가 같은 templateCode 여야 함 (1회 요청 = 1 템플릿)
  const tpl = messages[0].templateCode;
  if (messages.some((m) => m.templateCode !== tpl)) {
    return { ok: false, code: 'MIXED_TEMPLATE', message: '한 batch 안에서는 같은 templateCode 만 가능합니다.' };
  }

  // 알리고는 form-urlencoded + receiver_1..N 형식
  const params = new URLSearchParams();
  params.set('apikey', ENV.apikey);
  params.set('userid', ENV.userid);
  params.set('senderkey', ENV.senderkey);
  params.set('tpl_code', tpl);
  if (ENV.sender) params.set('sender', ENV.sender);
  params.set('testMode', 'N');

  messages.forEach((m, idx) => {
    const i = idx + 1;
    params.set(`receiver_${i}`, m.phone);
    params.set(`subject_${i}`, '');                  // 알림톡 제목은 사용 안함
    params.set(`message_${i}`, m.message);
    if (m.buttonName && m.buttonUrl) {
      params.set(`button_${i}`, JSON.stringify({
        button: [{
          name: m.buttonName,
          linkType: 'WL',
          linkTypeName: '웹링크',
          linkMo: m.buttonUrl,
          linkPc: m.buttonUrl,
        }],
      }));
    }
    if (m.fallbackSms) {
      params.set(`failover_${i}`, 'Y');
      params.set(`fsubject_${i}`, '발주Up');
      params.set(`fmessage_${i}`, m.fallbackSms);
    }
  });

  try {
    const res = await fetch(`${ALIGO_BASE}/alimtalk/send/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const json = await res.json().catch(() => ({}));

    // 알리고 응답: code=0 이면 성공, 그 외는 에러
    if (json.code === 0 || json.code === '0') {
      return {
        ok: true,
        messageId: String(json.info?.mid ?? json.message_id ?? ''),
        total: messages.length,
        success: Number(json.info?.scnt ?? messages.length),
        failed: Number(json.info?.fcnt ?? 0),
      };
    }
    return {
      ok: false,
      code: String(json.code ?? 'UNKNOWN'),
      message: String(json.message ?? '알림톡 발송 실패'),
    };
  } catch (e) {
    const err = e as Error;
    return { ok: false, code: 'NETWORK', message: err?.message ?? 'unknown' };
  }
}

// ============================================================
// 템플릿: 입찰공고 알림 (BID_ALERT)
//
// ※ 알리고 관리자에서 다음 본문으로 사전 등록 필요:
//
//   [발주Up] 입찰공고 발생
//
//   #{단지명}
//   공사: #{공사종류}
//   마감: #{마감일}
//
//   경쟁사보다 먼저 움직이세요.
// ============================================================
export function buildBidAlertMessage(input: {
  complexName: string;
  workType: string;
  deadline: string;
  proposalUrl: string;
}): AlimtalkMessage {
  // 변수 치환된 본문 — 템플릿과 100% 일치해야 발송 통과
  const message = [
    '[발주Up] 입찰공고 발생',
    '',
    input.complexName,
    `공사: ${input.workType}`,
    `마감: ${input.deadline}`,
    '',
    '경쟁사보다 먼저 움직이세요.',
  ].join('\n');

  return {
    phone: '',                          // 호출 측에서 채워 넣음
    templateCode: 'BID_ALERT_V1',
    message,
    buttonName: '제안서 바로 만들기',
    buttonUrl: input.proposalUrl,
    fallbackSms: `[발주Up] ${input.complexName} ${input.workType} 입찰공고 발생 (마감 ${input.deadline})`,
  };
}
