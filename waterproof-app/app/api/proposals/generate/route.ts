/**
 * POST /api/proposals/generate
 *
 * Body (JSON):
 *   {
 *     complex:    { name, address?, built_year, households, last_waterproof_year?, fund_balance? },
 *     userCompany:{ name, owner, yearsExperience?, specialties? },
 *     workScope:  { scope, areaSqm?, estimatedBudget?, notes? }
 *   }
 *
 * Response (JSON):
 *   성공 200:  { ok: true, proposal: {...}, usage: { input, output } }
 *   실패 400:  { ok: false, error: '입력 검증 실패: ...' }
 *   실패 429:  { ok: false, error: '...', code: 'rate_limit' }
 *   실패 5xx:  { ok: false, error: '...', code: 'overloaded' | 'unknown' }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateProposal,
  type ProposalComplexInfo,
  type ProposalCompanyInfo,
  type ProposalWorkScope,
} from '@/lib/claude';

export const runtime = 'nodejs';        // Anthropic SDK는 Node 런타임 필요
export const maxDuration = 60;          // Vercel — 최대 60초 허용

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: '요청 본문이 유효한 JSON이 아닙니다.' },
      { status: 400 }
    );
  }

  const validation = validateInput(body);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: validation.error },
      { status: 400 }
    );
  }

  const result = await generateProposal(validation.data);

  if (!result.ok) {
    const status =
      result.code === 'no_api_key' ? 500
      : result.code === 'auth'        ? 500
      : result.code === 'rate_limit'  ? 429
      : result.code === 'overloaded'  ? 503
      : result.code === 'invalid_json'? 502
      : 500;
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code, retryable: result.retryable },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    proposal: result.data,
    usage: result.usage,
  });
}

// ============================================================
// 입력 검증
// ============================================================
function validateInput(body: any):
  | { ok: true; data: { complex: ProposalComplexInfo; userCompany: ProposalCompanyInfo; workScope: ProposalWorkScope } }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: '요청 본문이 비어 있습니다' };
  }

  const { complex, userCompany, workScope } = body;
  if (!complex || !userCompany || !workScope) {
    return { ok: false, error: '필수 필드 누락: complex / userCompany / workScope' };
  }

  // 단지
  if (typeof complex.name !== 'string' || !complex.name.trim()) {
    return { ok: false, error: 'complex.name 누락' };
  }
  if (!Number.isFinite(Number(complex.built_year))) {
    return { ok: false, error: 'complex.built_year 가 숫자여야 합니다' };
  }
  if (!Number.isFinite(Number(complex.households))) {
    return { ok: false, error: 'complex.households 가 숫자여야 합니다' };
  }

  // 업체
  if (typeof userCompany.name !== 'string' || !userCompany.name.trim()) {
    return { ok: false, error: 'userCompany.name 누락' };
  }
  if (typeof userCompany.owner !== 'string' || !userCompany.owner.trim()) {
    return { ok: false, error: 'userCompany.owner 누락' };
  }

  // 공사
  if (typeof workScope.scope !== 'string' || !workScope.scope.trim()) {
    return { ok: false, error: 'workScope.scope 누락' };
  }

  return {
    ok: true,
    data: {
      complex: {
        name: String(complex.name).trim(),
        address: complex.address ? String(complex.address).trim() : undefined,
        built_year: Number(complex.built_year),
        households: Number(complex.households),
        last_waterproof_year:
          complex.last_waterproof_year != null
            ? Number(complex.last_waterproof_year)
            : null,
        fund_balance:
          complex.fund_balance != null ? Number(complex.fund_balance) : null,
      },
      userCompany: {
        name: String(userCompany.name).trim(),
        owner: String(userCompany.owner).trim(),
        yearsExperience: userCompany.yearsExperience
          ? Number(userCompany.yearsExperience)
          : undefined,
        specialties: Array.isArray(userCompany.specialties)
          ? userCompany.specialties.map((s: any) => String(s))
          : undefined,
      },
      workScope: {
        scope: String(workScope.scope).trim(),
        areaSqm: workScope.areaSqm ? Number(workScope.areaSqm) : undefined,
        estimatedBudget: workScope.estimatedBudget
          ? Number(workScope.estimatedBudget)
          : undefined,
        notes: workScope.notes ? String(workScope.notes).trim() : undefined,
      },
    },
  };
}
