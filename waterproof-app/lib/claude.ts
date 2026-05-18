/**
 * Claude API 래퍼
 *
 * 역할:
 *   - Anthropic SDK 인스턴스 한 곳에서 관리
 *   - 응답 → JSON 파싱 (코드펜스/잡문 자동 제거)
 *   - 재시도 (overloaded / rate-limit / 일시 네트워크 오류)
 *   - 명확한 에러 타입 반환
 *
 * 사용:
 *   const result = await generateProposal({ complex, userCompany, workScope });
 *   if (!result.ok) {  // 에러 처리  }
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================
// 모델 / 클라이언트
// ============================================================
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1_800;
const MAX_RETRIES = 3;

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey && process.env.NODE_ENV !== 'production') {
  console.warn('[claude] ANTHROPIC_API_KEY 환경변수가 없습니다. 호출 시 실패합니다.');
}

const client = new Anthropic({ apiKey });

// ============================================================
// 공통 타입
// ============================================================
export type ClaudeResult<T> =
  | { ok: true; data: T; rawText: string; usage?: { input: number; output: number } }
  | { ok: false; error: string; code: ClaudeErrorCode; retryable: boolean };

export type ClaudeErrorCode =
  | 'no_api_key'
  | 'invalid_json'
  | 'empty_response'
  | 'rate_limit'
  | 'overloaded'
  | 'auth'
  | 'network'
  | 'unknown';

// ============================================================
// 제안서 입력 / 출력 타입
// ============================================================
export interface ProposalComplexInfo {
  name: string;
  address?: string;
  built_year: number;
  households: number;
  last_waterproof_year?: number | null;
  fund_balance?: number | null;     // 원 단위
}

export interface ProposalCompanyInfo {
  name: string;          // 시공업체명
  owner: string;         // 대표자
  yearsExperience?: number;
  specialties?: string[]; // ['옥상방수', '외벽방수', ...]
}

export interface ProposalWorkScope {
  scope: string;          // '옥상방수' | '외벽방수' | '지하방수' | 자유 입력
  areaSqm?: number;       // 공사 면적 (m²)
  estimatedBudget?: number; // 예상 금액 (원)
  notes?: string;
}

export interface GeneratedProposal {
  title: string;
  summary: string;
  urgency_diagnosis: string;     // 노후도 진단 (200자)
  solution: string;              // 제안 공사 내용 (300자)
  why_us: string[];              // 차별화 강점 3개
  fund_usage: string;            // 충당금 활용 설명 (150자)
  warranty: string;              // 하자보증 (100자)
  cta: string;                   // 마무리 행동 유도 (50자)
}

// ============================================================
// 메인: 제안서 생성
// ============================================================
export async function generateProposal(input: {
  complex: ProposalComplexInfo;
  userCompany: ProposalCompanyInfo;
  workScope: ProposalWorkScope;
}): Promise<ClaudeResult<GeneratedProposal>> {
  if (!apiKey) {
    return {
      ok: false,
      error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.',
      code: 'no_api_key',
      retryable: false,
    };
  }

  const prompt = buildProposalPrompt(input);

  const callResult = await callWithRetry({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system:
      '당신은 방수 전문 시공업체의 수주 제안서 작성 전문가입니다. ' +
      '응답은 반드시 유효한 JSON 객체 하나만 반환하며, JSON 외 다른 설명·코드펜스를 포함하지 마세요.',
    messages: [{ role: 'user', content: prompt }],
  });

  if (!callResult.ok) return callResult as ClaudeResult<GeneratedProposal>;

  const rawText = callResult.data;
  const parsed = parseJsonResponse<GeneratedProposal>(rawText);

  if (!parsed.ok) {
    return {
      ok: false,
      error: `Claude 응답 JSON 파싱 실패: ${parsed.error}`,
      code: 'invalid_json',
      retryable: true,
    };
  }

  const validated = validateProposal(parsed.data);
  if (!validated.ok) {
    return {
      ok: false,
      error: `Claude 응답 검증 실패: ${validated.error}`,
      code: 'invalid_json',
      retryable: true,
    };
  }

  return {
    ok: true,
    data: validated.data,
    rawText,
    usage: callResult.usage,
  };
}

// ============================================================
// 프롬프트 빌더
// ============================================================
function buildProposalPrompt(input: {
  complex: ProposalComplexInfo;
  userCompany: ProposalCompanyInfo;
  workScope: ProposalWorkScope;
}): string {
  const { complex: c, userCompany: u, workScope: w } = input;
  const currentYear = new Date().getFullYear();
  const ageYears = currentYear - c.built_year;
  const fundEok =
    c.fund_balance != null
      ? `${(c.fund_balance / 100_000_000).toFixed(1)}억원`
      : '미확인';
  const lastWp =
    c.last_waterproof_year != null
      ? `${c.last_waterproof_year}년 (${currentYear - c.last_waterproof_year}년 경과)`
      : '이력 없음';

  return `아래 아파트 단지 정보를 바탕으로 관리소장을 설득하는 방수 공사 제안서를 작성하세요.

## 단지 정보
- 단지명: ${c.name}
- 주소: ${c.address ?? '미상'}
- 준공연도: ${c.built_year}년 (${ageYears}년 경과)
- 세대수: ${c.households.toLocaleString()}세대
- 마지막 방수공사: ${lastWp}
- 장기수선충당금 잔액: ${fundEok}

## 시공업체 정보
- 업체명: ${u.name}
- 대표자: ${u.owner}
${u.yearsExperience ? `- 업력: ${u.yearsExperience}년` : ''}
${u.specialties?.length ? `- 전문 공종: ${u.specialties.join(', ')}` : ''}

## 공사 범위
- 공사 종류: ${w.scope}
${w.areaSqm ? `- 공사 면적: ${w.areaSqm.toLocaleString()}m²` : ''}
${w.estimatedBudget ? `- 예상 금액: ${(w.estimatedBudget / 100_000_000).toFixed(1)}억원` : ''}
${w.notes ? `- 비고: ${w.notes}` : ''}

## 작성 지침
1. 관리소장이 읽는 즉시 전문성을 느낄 것
2. 단지 노후도와 방수 필요성을 구체적 수치로 설명할 것
3. 장기수선충당금 활용 방법을 명시할 것
4. 하자보증 조건과 AS 정책을 포함할 것
5. 경쟁 업체와 차별화되는 강점 3가지를 제시할 것
6. 모든 텍스트는 한국어, 존댓말 사용

## 출력 형식 (JSON만, 다른 텍스트 금지)
{
  "title": "제안서 제목 (예: 'OO아파트 옥상방수 공사 제안서')",
  "summary": "핵심 요약 2~3문장",
  "urgency_diagnosis": "노후도 진단 및 방수 필요성 (200자 내외)",
  "solution": "제안 공사 내용 상세 — 공법, 자재, 일정 (300자 내외)",
  "why_us": ["강점1", "강점2", "강점3"],
  "fund_usage": "충당금 활용 방법 설명 (150자 내외)",
  "warranty": "하자보증 조건 및 AS 정책 (100자 내외)",
  "cta": "마무리 행동 유도 문구 (50자 내외)"
}`;
}

// ============================================================
// 응답 파싱 / 검증
// ============================================================
function parseJsonResponse<T>(text: string): { ok: true; data: T } | { ok: false; error: string } {
  // 코드펜스, 앞뒤 잡문 제거 후 { ... } 만 추출
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    return { ok: false, error: 'JSON 객체를 찾지 못함' };
  }
  const candidate = cleaned.slice(start, end + 1);

  try {
    return { ok: true, data: JSON.parse(candidate) as T };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

function validateProposal(
  p: any
): { ok: true; data: GeneratedProposal } | { ok: false; error: string } {
  const required = [
    'title',
    'summary',
    'urgency_diagnosis',
    'solution',
    'why_us',
    'fund_usage',
    'warranty',
    'cta',
  ] as const;

  for (const key of required) {
    if (p[key] == null) return { ok: false, error: `필드 누락: ${key}` };
  }

  if (!Array.isArray(p.why_us)) {
    return { ok: false, error: 'why_us 는 배열이어야 합니다' };
  }

  return { ok: true, data: p as GeneratedProposal };
}

// ============================================================
// 재시도 래퍼
// ============================================================
async function callWithRetry(
  params: Parameters<typeof client.messages.create>[0],
  attempt = 1
): Promise<
  | { ok: true; data: string; usage?: { input: number; output: number } }
  | { ok: false; error: string; code: ClaudeErrorCode; retryable: boolean }
> {
  try {
    // stream 옵션 없이 호출 → Message 응답
    const response = (await client.messages.create(params)) as Anthropic.Messages.Message;

    const block = response.content[0];
    const text = block && block.type === 'text' ? block.text : '';
    if (!text) {
      return {
        ok: false,
        error: 'Claude 응답이 비어 있습니다',
        code: 'empty_response',
        retryable: true,
      };
    }

    return {
      ok: true,
      data: text,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  } catch (err: any) {
    const code = mapAnthropicError(err);
    const retryable =
      code === 'overloaded' ||
      code === 'rate_limit' ||
      code === 'network' ||
      code === 'empty_response';

    if (retryable && attempt < MAX_RETRIES) {
      await sleep(800 * Math.pow(2, attempt - 1)); // 0.8s → 1.6s → 3.2s
      return callWithRetry(params, attempt + 1);
    }

    return {
      ok: false,
      error: String(err?.message || err),
      code,
      retryable,
    };
  }
}

function mapAnthropicError(err: any): ClaudeErrorCode {
  const status = err?.status ?? err?.response?.status;
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 529 || /overload/i.test(String(err?.message))) return 'overloaded';
  if (/fetch|network|ECONN|ETIMEDOUT|abort/i.test(String(err?.message))) return 'network';
  return 'unknown';
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
