/**
 * 단지 외관 뷰 — 카카오 로드뷰 우선 + 위성(SKYVIEW) fallback
 *
 * 동작:
 *   1) 주소/단지명으로 좌표 획득 (Geocoder → Places fallback)
 *   2) RoadviewClient.getNearestPanoId(latlng, 80m) 로 가까운 파노라마 검색
 *      - 있으면 로드뷰(실제 단지 외관 사진) 표시
 *      - 없으면 SKYVIEW(위성) 으로 fallback
 *   3) 키 없음 / SDK 로드 실패 시 placeholder + 외부 지도 링크
 *
 * 키 발급:
 *   https://developers.kakao.com → 내 애플리케이션 → JavaScript 키
 *   플랫폼 → Web 사이트 도메인 등록 필수 (localhost + 배포 도메인)
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Image as ImageIcon, MapPin, Loader2, Navigation } from "lucide-react";

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
  // 실제 표시 모드 — 로드뷰 사진이 있으면 'roadview', 없으면 'satellite' 로 fallback
  const [viewMode, setViewMode] = useState<"roadview" | "satellite">("roadview");

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
          Roadview: new (el: HTMLElement) => {
            setPanoId: (panoId: number, position: unknown) => void;
          };
          RoadviewClient: new () => {
            getNearestPanoId: (
              position: unknown,
              radius: number,
              cb: (panoId: number | null) => void,
            ) => void;
          };
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
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(
          "[ComplexSatelliteView] window.kakao.maps 미정의 — SDK 로드 실패. " +
            "원인 후보: (1) 잘못된 NEXT_PUBLIC_KAKAO_MAP_KEY, " +
            "(2) Kakao Developers → 플랫폼 → Web 에 현재 도메인 미등록, " +
            "(3) 네트워크 차단",
        );
      }
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

      // 1차: 로드뷰(파노라마) 시도. 80m 반경에서 가장 가까운 panoId 검색.
      // 없으면 위성(SKYVIEW) 으로 fallback.
      const draw = (lat: number, lng: number) => {
        const coords = new k.LatLng(lat, lng);
        try {
          const client = new k.RoadviewClient();
          client.getNearestPanoId(coords, 80, (panoId) => {
            if (panoId) {
              try {
                const rv = new k.Roadview(target);
                rv.setPanoId(panoId, coords);
                setViewMode("roadview");
                setStatus("ready");
                return;
              } catch {
                // 로드뷰 인스턴스 생성 실패 → 위성 fallback 으로 진행
              }
            }
            // panoId 없음 또는 로드뷰 실패 → SKYVIEW 폴백
            try {
              const map = new k.Map(target, {
                center: coords,
                level: 3,
                mapTypeId: k.MapTypeId.SKYVIEW,
              });
              new k.Marker({ position: coords, map });
              setViewMode("satellite");
              setStatus("ready");
            } catch {
              setStatus("failed");
            }
          });
        } catch {
          // RoadviewClient 자체가 없는 환경 — 곧바로 위성
          try {
            const map = new k.Map(target, {
              center: coords,
              level: 3,
              mapTypeId: k.MapTypeId.SKYVIEW,
            });
            new k.Marker({ position: coords, map });
            setViewMode("satellite");
            setStatus("ready");
          } catch {
            setStatus("failed");
          }
        }
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
  // 길찾기 — 검색 기반 (좌표 없이도 동작; 사용자 현재 위치는 카카오/네이버 앱이 자동 처리)
  const naverDirHref = `https://map.naver.com/p/directions/-/-/${encodeURIComponent(query)}/place`;
  const kakaoDirHref = `https://map.kakao.com/?sName=${encodeURIComponent("내 위치")}&eName=${encodeURIComponent(query)}`;

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
                단지 외관
              </p>
            </div>
            {!apiKey ? (
              <p className="max-w-[260px] text-[10px] leading-relaxed text-white/70">
                위성 지도를 활성화하려면{" "}
                <code className="rounded bg-white/10 px-1 py-0.5 text-white/90">
                  NEXT_PUBLIC_KAKAO_MAP_KEY
                </code>
                와 Kakao Developers → 플랫폼 → Web 도메인 등록이 필요합니다.
              </p>
            ) : (
              <p className="max-w-[260px] text-[10px] leading-relaxed text-white/70">
                지도 로드 실패. 키가 올바르고 현재 도메인이 Kakao Developers 플랫폼에 등록되어 있는지 확인해주세요.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <a
                href={kakaoDirHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-accent/90 active:scale-95"
              >
                <Navigation size={14} />
                길찾기
              </a>
              <a
                href={naverHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-bold text-slate-800 shadow-md transition-all hover:bg-white active:scale-95"
              >
                <MapPin size={14} className="text-emerald-600" />
                네이버
              </a>
              <a
                href={kakaoHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-bold text-slate-800 shadow-md transition-all hover:bg-white active:scale-95"
              >
                <MapPin size={14} className="text-amber-500" />
                카카오
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
              {viewMode === "roadview" ? "단지 외관 (로드뷰)" : "단지 위성 사진"}
            </span>
          </div>
          <div className="absolute bottom-3 right-3 z-10 flex flex-wrap items-center justify-end gap-2">
            <a
              href={kakaoDirHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-bold text-white shadow-md transition-all hover:bg-accent/90 active:scale-95"
            >
              <Navigation size={12} />
              길찾기
            </a>
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
