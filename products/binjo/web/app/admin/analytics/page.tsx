"use client";

import { useCallback, useEffect, useState } from "react";
import AdminPage from "@/components/admin/AdminPage";
import AdminNotice from "@/components/admin/AdminNotice";

interface Analytics {
  total: number;
  by_channel: Record<string, number>;
  recent: { id: string; channel: string; product_name: string | null; created_at: string }[];
}

const CHANNEL_LABELS: Record<string, string> = {
  kakao: "카카오톡",
  phone: "전화",
  naver: "스마트스토어",
};

const CHANNEL_COLORS: Record<string, string> = {
  kakao: "#C6A900",
  phone: "#2D5016",
  naver: "#087F3F",
};

export default function AnalyticsAdminPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/inquiries?days=${days}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`연락 클릭 요청 실패 (HTTP ${response.status})`);
      setData(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "연락 클릭 현황을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminPage
      title="연락 버튼 클릭"
      description="고객 페이지에서 카카오·전화·스마트스토어 버튼을 누른 횟수입니다."
      eyebrow="CONTACT CLICKS"
      actions={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="min-h-12 w-full rounded-xl border bg-white px-4 text-sm font-bold disabled:opacity-50 sm:w-auto"
          style={{ borderColor: "#CFD6CA", color: "#2D5016" }}
        >
          {loading ? "확인 중" : "새로고침"}
        </button>
      }
    >
      <AdminNotice tone="info" className="mb-5" title="실제 문의 건수와는 다릅니다">
        같은 고객이 여러 번 누를 수 있고, 통화·카카오 대화 내용이나 주문 전환 여부는 저장하지 않습니다.
      </AdminNotice>

      {error && (
        <AdminNotice
          tone="error"
          title="클릭 현황을 불러오지 못했습니다"
          className="mb-5"
          action={
            <button
              type="button"
              onClick={() => void load()}
              className="min-h-11 rounded-xl border bg-white px-4 text-sm font-bold"
              style={{ borderColor: "#C9806E" }}
            >
              다시 시도
            </button>
          }
        >
          {error}
        </AdminNotice>
      )}

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="조회 기간">
        {[7, 30, 90].map((value) => (
          <button
            type="button"
            key={value}
            onClick={() => setDays(value)}
            aria-pressed={days === value}
            className="min-h-12 min-w-18 rounded-xl px-4 text-sm font-bold"
            style={{
              backgroundColor: days === value ? "#2D5016" : "#FFFFFF",
              color: days === value ? "#FFFFFF" : "#4E5F48",
            }}
          >
            {value}일
          </button>
        ))}
      </div>

      {data ? (
        <>
          <section className="mb-5 rounded-2xl border bg-white p-5" style={{ borderColor: "#DEE3DA" }}>
            <p className="text-sm font-semibold" style={{ color: "#66705F" }}>전체 클릭 · 최근 {days}일</p>
            <p className="mt-2 text-4xl font-bold" style={{ color: "#1F3D12" }}>{data.total}</p>
          </section>

          <section className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="채널별 클릭 수">
            {["kakao", "phone", "naver"].map((channel) => (
              <div key={channel} className="rounded-2xl border bg-white p-4" style={{ borderColor: "#DEE3DA" }}>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[channel] }} aria-hidden="true" />
                  <p className="text-sm font-semibold" style={{ color: "#66705F" }}>{CHANNEL_LABELS[channel]}</p>
                </div>
                <p className="mt-3 text-3xl font-bold" style={{ color: "#1F3D12" }}>{data.by_channel[channel] ?? 0}</p>
              </div>
            ))}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold" style={{ color: "#1F3D12" }}>최근 클릭</h2>
            <div className="space-y-2">
              {data.recent.map((item) => (
                <div key={item.id} className="flex min-h-14 items-center gap-3 rounded-xl border bg-white p-3" style={{ borderColor: "#E3E6DF" }}>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[item.channel] ?? "#8A9185" }} aria-hidden="true" />
                  <span className="text-sm font-bold" style={{ color: "#34422F" }}>{CHANNEL_LABELS[item.channel] ?? item.channel}</span>
                  {item.product_name && (
                    <span className="rounded-full px-2 py-1 text-xs" style={{ backgroundColor: "#F1F3EE", color: "#66705F" }}>
                      {item.product_name}
                    </span>
                  )}
                  <time className="ml-auto text-xs" style={{ color: "#7A8175" }} dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                  </time>
                </div>
              ))}
              {data.recent.length === 0 && (
                <p className="rounded-2xl border border-dashed py-10 text-center text-sm" style={{ borderColor: "#CDD3C8", color: "#66705F" }}>
                  이 기간에는 연락 버튼 클릭이 없습니다.
                </p>
              )}
            </div>
          </section>
        </>
      ) : loading ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-sm" style={{ borderColor: "#DEE3DA", color: "#66705F" }}>
          클릭 현황을 불러오고 있습니다...
        </div>
      ) : null}
    </AdminPage>
  );
}
