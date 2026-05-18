'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { updateProfile, type UpdateProfileState } from '@/app/(dashboard)/settings/actions';

const REGIONS = ['서울', '경기', '인천', '강원', '충청', '전라', '경상', '제주'];

export interface ProfileFormProps {
  initial: {
    companyName: string;
    ownerName: string;
    phone: string;
    regions: string[];
  };
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const [state, formAction] = useFormState<UpdateProfileState, FormData>(updateProfile, null);
  const [regions, setRegions] = useState<string[]>(initial.regions);

  function toggle(r: string) {
    setRegions((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="사업체명"
          name="companyName"
          defaultValue={initial.companyName}
          required
          error={fe.companyName}
        />
        <Field
          label="대표자명"
          name="ownerName"
          defaultValue={initial.ownerName}
          required
          error={fe.ownerName}
        />
      </div>

      <Field
        label="연락처"
        name="phone"
        type="tel"
        defaultValue={formatPhone(initial.phone)}
        required
        placeholder="010-1234-5678"
        autoComplete="tel"
        error={fe.phone}
      />

      <div>
        <div className="mb-1.5 text-xs font-medium text-gray-700">
          관심 지역 <span className="text-gray-400">(다중 선택)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => {
            const on = regions.includes(r);
            return (
              <label key={r}>
                <input type="checkbox" name="region" value={r} checked={on} onChange={() => toggle(r)} className="sr-only" />
                <span
                  className={[
                    'inline-block cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors',
                    on
                      ? 'border-[#0F4C8A] bg-[#0F4C8A] text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-[#0F4C8A]',
                  ].join(' ')}
                >
                  {r}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {state?.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {state?.success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          <span>저장되었습니다.</span>
        </div>
      )}

      <SaveButton />
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <div className="flex justify-end">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-[#0F4C8A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1A5FA8] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {pending ? '저장 중...' : '프로필 저장'}
      </button>
    </div>
  );
}

function Field({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div>
      <label htmlFor={props.name} className="mb-1.5 block text-xs font-medium text-gray-700">
        {label}
        {props.required && <span className="ml-0.5 text-[#FF6B35]">*</span>}
      </label>
      <input
        id={props.name}
        {...props}
        className={[
          'w-full rounded-lg border bg-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-1',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-[#0F4C8A] focus:ring-[#0F4C8A]',
        ].join(' ')}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function formatPhone(p: string): string {
  if (!p) return '';
  const n = p.replace(/[^0-9]/g, '');
  if (n.length === 11) return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7)}`;
  if (n.length === 10) return `${n.slice(0,3)}-${n.slice(3,6)}-${n.slice(6)}`;
  return p;
}
