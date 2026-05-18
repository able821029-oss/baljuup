/**
 * 제안서 생성 입력 폼
 *
 * 3개 섹션:
 *   1) 단지 정보 (이름·주소·준공년·세대수·마지막 방수년·충당금)
 *   2) 시공업체 정보 (회사명·대표자·업력·전문공종)
 *   3) 공사 범위 (옥상/외벽/지하·면적·예상금액·비고)
 *
 * 단지는 추후 검색 셀렉트로 교체. 지금은 수동 입력 + "단지 검색" 버튼 자리표시.
 */

'use client';

import { useState, FormEvent } from 'react';
import { Search, Loader2 } from 'lucide-react';

export interface ProposalFormValues {
  complex: {
    name: string;
    address?: string;
    built_year: number;
    households: number;
    last_waterproof_year?: number | null;
    fund_balance?: number | null;
  };
  userCompany: {
    name: string;
    owner: string;
    yearsExperience?: number;
    specialties?: string[];
  };
  workScope: {
    scope: string;
    areaSqm?: number;
    estimatedBudget?: number;
    notes?: string;
  };
}

const SCOPE_OPTIONS = ['옥상방수', '외벽방수', '지하방수', '복합공사'];
const SPECIALTY_OPTIONS = ['옥상방수', '외벽방수', '지하방수', '우레탄', '시트방수', '실링/코킹'];

export interface ProposalFormProps {
  onSubmit: (values: ProposalFormValues) => void | Promise<void>;
  submitting?: boolean;
  defaultValues?: Partial<ProposalFormValues>;
}

export function ProposalForm({ onSubmit, submitting = false, defaultValues }: ProposalFormProps) {
  // 단지
  const [name, setName] = useState(defaultValues?.complex?.name ?? '');
  const [address, setAddress] = useState(defaultValues?.complex?.address ?? '');
  const [builtYear, setBuiltYear] = useState<string>(
    defaultValues?.complex?.built_year ? String(defaultValues.complex.built_year) : ''
  );
  const [households, setHouseholds] = useState<string>(
    defaultValues?.complex?.households ? String(defaultValues.complex.households) : ''
  );
  const [lastWp, setLastWp] = useState<string>(
    defaultValues?.complex?.last_waterproof_year
      ? String(defaultValues.complex.last_waterproof_year)
      : ''
  );
  const [fundEok, setFundEok] = useState<string>(
    defaultValues?.complex?.fund_balance
      ? String(defaultValues.complex.fund_balance / 100_000_000)
      : ''
  );

  // 업체
  const [companyName, setCompanyName] = useState(defaultValues?.userCompany?.name ?? '');
  const [owner, setOwner] = useState(defaultValues?.userCompany?.owner ?? '');
  const [years, setYears] = useState<string>(
    defaultValues?.userCompany?.yearsExperience
      ? String(defaultValues.userCompany.yearsExperience)
      : ''
  );
  const [specialties, setSpecialties] = useState<string[]>(
    defaultValues?.userCompany?.specialties ?? []
  );

  // 공사
  const [scope, setScope] = useState<string>(defaultValues?.workScope?.scope ?? SCOPE_OPTIONS[0]);
  const [areaSqm, setAreaSqm] = useState<string>(
    defaultValues?.workScope?.areaSqm ? String(defaultValues.workScope.areaSqm) : ''
  );
  const [budgetEok, setBudgetEok] = useState<string>(
    defaultValues?.workScope?.estimatedBudget
      ? String(defaultValues.workScope.estimatedBudget / 100_000_000)
      : ''
  );
  const [notes, setNotes] = useState(defaultValues?.workScope?.notes ?? '');

  function toggleSpecialty(s: string) {
    setSpecialties((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const builtYearNum = parseInt(builtYear, 10);
    const householdsNum = parseInt(households, 10);
    if (!name.trim() || !Number.isFinite(builtYearNum) || !Number.isFinite(householdsNum)) {
      alert('단지명, 준공연도, 세대수는 필수입니다.');
      return;
    }
    if (!companyName.trim() || !owner.trim()) {
      alert('업체명과 대표자명은 필수입니다.');
      return;
    }

    const values: ProposalFormValues = {
      complex: {
        name: name.trim(),
        address: address.trim() || undefined,
        built_year: builtYearNum,
        households: householdsNum,
        last_waterproof_year: lastWp ? parseInt(lastWp, 10) : null,
        fund_balance: fundEok ? Math.round(parseFloat(fundEok) * 100_000_000) : null,
      },
      userCompany: {
        name: companyName.trim(),
        owner: owner.trim(),
        yearsExperience: years ? parseInt(years, 10) : undefined,
        specialties: specialties.length ? specialties : undefined,
      },
      workScope: {
        scope: scope.trim(),
        areaSqm: areaSqm ? parseInt(areaSqm, 10) : undefined,
        estimatedBudget: budgetEok ? Math.round(parseFloat(budgetEok) * 100_000_000) : undefined,
        notes: notes.trim() || undefined,
      },
    };

    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ─── 단지 정보 ─────────────────────────────────────── */}
      <Section
        title="1. 단지 정보"
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0F4C8A] hover:underline"
            onClick={() => alert('단지 검색은 다음 버전에서 제공됩니다.')}
          >
            <Search size={14} /> 단지 검색
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="단지명 *" value={name} onChange={setName} placeholder="예: 래미안 강남힐스테이트" />
          <Field label="주소" value={address} onChange={setAddress} placeholder="예: 서울 강남구 ..." />
          <Field label="준공연도 *" value={builtYear} onChange={setBuiltYear} type="number" placeholder="2001" />
          <Field label="세대수 *" value={households} onChange={setHouseholds} type="number" placeholder="1,200" />
          <Field
            label="마지막 방수공사 (연도)"
            value={lastWp}
            onChange={setLastWp}
            type="number"
            placeholder="모르면 비워두세요"
          />
          <Field
            label="장기수선충당금 잔액 (억원)"
            value={fundEok}
            onChange={setFundEok}
            type="number"
            placeholder="예: 3.2"
          />
        </div>
      </Section>

      {/* ─── 시공업체 ──────────────────────────────────────── */}
      <Section title="2. 시공업체 정보">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="업체명 *" value={companyName} onChange={setCompanyName} placeholder="예: 한일방수" />
          <Field label="대표자 *" value={owner} onChange={setOwner} placeholder="예: 김방수" />
          <Field label="업력 (년)" value={years} onChange={setYears} type="number" placeholder="15" />
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-xs font-medium text-gray-700">전문 공종 (다중 선택)</label>
          <div className="flex flex-wrap gap-2">
            {SPECIALTY_OPTIONS.map((s) => {
              const on = specialties.includes(s);
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggleSpecialty(s)}
                  className={[
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    on
                      ? 'border-[#0F4C8A] bg-[#0F4C8A] text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-[#0F4C8A]',
                  ].join(' ')}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ─── 공사 범위 ─────────────────────────────────────── */}
      <Section title="3. 공사 범위">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">공사 종류 *</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#0F4C8A] focus:outline-none focus:ring-1 focus:ring-[#0F4C8A]"
            >
              {SCOPE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <Field label="공사 면적 (m²)" value={areaSqm} onChange={setAreaSqm} type="number" placeholder="예: 2,500" />
          <Field
            label="예상 금액 (억원)"
            value={budgetEok}
            onChange={setBudgetEok}
            type="number"
            placeholder="예: 1.8"
          />
        </div>
        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-medium text-gray-700">비고</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#0F4C8A] focus:outline-none focus:ring-1 focus:ring-[#0F4C8A]"
            placeholder="특이사항, 현장 조건, 일정 요청 등"
          />
        </div>
      </Section>

      {/* ─── 제출 ──────────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:px-0 sm:py-0">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF6B35] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#FF8C5A] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              제안서 생성 중... (15~20초)
            </>
          ) : (
            <>AI 제안서 생성</>
          )}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// 내부 컴포넌트
// ============================================================
function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 sm:text-base">{title}</h3>
        {actions}
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#0F4C8A] focus:outline-none focus:ring-1 focus:ring-[#0F4C8A]"
      />
    </div>
  );
}
