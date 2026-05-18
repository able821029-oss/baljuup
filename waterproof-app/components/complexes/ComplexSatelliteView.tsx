/**
 * 단지 위성 사진 뷰 — 카카오맵 JavaScript SDK SKYVIEW
 *
 * 동작:
 *   1) NEXT_PUBLIC_KAKAO_MAP_KEY 가 설정되어 있으면
 *      Script 태그로 카카오맵 SDK 동적 로딩 → 주소 geocoding →
 *      SKYVIEW(위성) 지도 + 마커 표시.
 *   2) 주소 geocoding 실패 시 단지명 키워드 검색으로 fallback.
 *   3) 키가 없거나 SDK 로드 실패 시 기존 어두운 placeholder 유지
 *      (네이버/카카오 외부 링크 버튼).
 *
 * 키 발급:
 *   https://developers.kakao.com → 내 애플리케이션 → JavaScript 키
 *   플랫폼 → Web 사이트 도메인 등록 필수 (localhost + 배포 도메인)
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Image as ImageIcon, MapPin, Loader2 } from "lucide-react";

// 카카오 SDK 는 전역 window.kakao 로 노출됨.
// 공식 타입 패키지가 없어 unknown 으로 받고 내부에서만 사용.
declare global {
  interface Window {
    kakao?: unknown;
  }
}

type Props = {
  name: string;
  address: string | null;
};

export function ComplexSatelliteView({ name, address }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  const mapEl = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "failed">(
    apiKey ? "loading" : "idle",
  );

  useEffect(() => {
    if (!sdkReady || !apiKey || !mapEl.current) return;

    const w = window as unknown as {
      kakao?: {
        maps: {
          load: (cb: () => void) => void;
          LatLng: new (lat: number, lng: number) => unknown;
          Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
          Marker: new (opts: Record<string, unknown>) => unknown;
          MapTypeId: { SKYVIEW: unknown };
          services: {
            Geocoder: new () => {
              addressSearch: (
                q: string,
                cb: (result: Array<{ x: string; y: string }>, status: string) => void,
              ) => void;
            };
            Places: new () => {
              keywordSearch: (
                q: string,
                cb: (result: Array<{ x: string; y: string }>, status: string) => void,
              ) => void;
            };
            Status: { OK: string };
          };
        };
      };
    };

    if (!w.kakao?.maps) {
      setStatus("failed");
      return;
    }

    w.kakao.maps.load(() => {
      const k = w.kakao!.maps;
      const target = mapEl.current;
      if (!target) {
        setStatus("failed");
        return;
      }

      const draw = (lat: number, lng: number) => {
        const coords = new k.LatLng(lat, lng);
        const map = new k.Map(target, {
          center: coords,
          level: 3,
          mapTypeId: k.MapTypeId.SKYVIEW,
        });
        new k.Marker({ position: coords, map });
        setStatus("ready");
      };

      const tryKeyword = () => {
        try {
          const places = new k.services.Places();
          places.keywordSearch(name, (result, st) => {
            if (st !== k.services.Status.OK || !result?.[0]) {
              setStatus("failed");
              return;
            }
            draw(Number(result[0].y), Number(result[0].x));
          });
        } catch {
          setStatus("failed");
        }
      };

      try {
        const geocoder = new k.services.Geocoder();
        const q = address && address.trim().length > 0 ? address : name;
        geocoder.addressSearch(q, (result, st) => {
          if (st !== k.services.Status.OK || !result?.[0]) {
            // 도로명 주소 매칭 실패 → 단지명 키워드 검색
            tryKeyword();
            return;
          }
          draw(Number(result[0].y), Number(result[0].x));
        });
      } catch {
        tryKeyword();
      }
    });
  }, [sdkReady, apiKey, address, name]);

  const query = `${name} ${address ?? ""}`.trim();
  const naverHref = `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
  const kakaoHref = `https://map.kakao.com/?q=${encodeURIComponent(query)}`;

  // 키 없음 / SDK 실패 → placeholder
  const showFallback = !apiKey || status === "failed";

  return (
    <section className="relative h-60 overflow-hidden rounded-2xl border border-slate-200 shadow-inner">
      {apiKey && (
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services&autoload=false`}
          strategy="afterInteractive"
          onLoad={() => setSdkReady(true)}
          onError={() => setStatus("failed")}
        />
      )}

      {/* 지도 컨테이너 — 키 있을 때만 그려짐 */}
      {apiKey && !showFallback && (
        <div ref={mapEl} className="absolute inset-0 bg-slate-200" />
      )}

      {/* 로딩 상태 오버레이 */}
      {apiKey && status === "loading" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      )}

      {/* placeholder — 키 없거나 실패 */}
      {showFallback && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:18px_18px]" />
          <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4">
            <div className="flex items-center gap-2">
              <ImageIcon size={16} className="text-white/80" />
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">
                단지 전경 / 위성 사진
              </p>
            </div>
            {!apiKey ? (
              <p className="max-w-[240px] text-[10px] leading-relaxed text-white/70">
                <code className="rounded bg-white/10 px-1 py-0.5 text-[10px] text-white/90">
                  NEXT_PUBLIC_KAKAO_MAP_KEY
                </code>{" "}
                환경변수를 설정하면 위성 지도가 자동 표시됩니다.
              </p>
            ) : (
              <p className="text-[10px] leading-relaxed text-white/70">
                해당 주소를 지도에서 찾지 못했습니다. 아래 외부 지도로 확인해주세요.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <a
                href={naverHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-bold text-slate-800 shadow-md transition-all hover:bg-white active:scale-95"
              >
                <MapPin size={14} className="text-emerald-600" />
                네이버 지도
              </a>
              <a
                href={kakaoHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-bold text-slate-800 shadow-md transition-all hover:bg-white active:scale-95"
              >
                <MapPin size={14} className="text-amber-500" />
                카카오맵
              </a>
            </div>
          </div>
        </>
      )}

      {/* 지도 위 좌측 상단 라벨 + 우측 하단 외부 링크 */}
      {apiKey && status === "ready" && (
        <>
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 backdrop-blur-sm">
            <ImageIcon size={12} className="text-white/80" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-white/90">
              단지 위성 사진
            </span>
          </div>
          <div className="absolute bottom-3 right-3 z-10 flex flex-wrap items-center justify-end gap-2">
            <a
              href={naverHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-slate-800 shadow-md transition-all hover:bg-white active:scale-95"
            >
              <MapPin size={12} className="text-emerald-600" />
              네이버
            </a>
            <a
              href={kakaoHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-slate-800 shadow-md transition-all hover:bg-white active:scale-95"
            >
              <MapPin size={12} className="text-amber-500" />
              카카오
            </a>
          </div>
        </>
      )}
    </section>
  );
}
