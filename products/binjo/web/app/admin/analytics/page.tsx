"use client";

import { useEffect, useState } from "react";

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
  kakao: "#FEE500",
  phone: "#2D5016",
  naver: "#03C75A",
};

export default function AnalyticsAdminPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetch(`/api/admin/inquiries?days=${days}`)
      .then((r) => r.json())
      .then(setData);
  }, [days]);

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-xl font-bold mb-1" style={{ color: "#2D5016" }}>방문 통계</h1>
      <p className="text-sm mb-6" style={{ color: "#6B6B6B" }}>주문 문의 클릭 수를 확인합니다</p>

      <div className="flex gap-2 mb-8">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{
              backgroundColor: days === d ? "#2D5016" : "#FFFFFF",
              color: days === d ? "#FFFFFF" : "#6B6B6B",
            }}
          >
            {d}일
          </button>
        ))}
      </div>

      {data ? (
        <>
          <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: "#FFFFFF" }}>
            <p className="text-xs" style={{ color: "#6B6B6B" }}>총 문의 클릭 ({days}일)</p>
            <p className="text-4xl font-bold mt-1" style={{ color: "#2D5016" }}>{data.total}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {Object.entries(data.by_channel).map(([channel, count]) => (
              <div key={channel} className="rounded-2xl p-4 text-center" style={{ backgroundColor: "#FFFFFF" }}>
                <div
                  className="w-8 h-8 rounded-full mx-auto mb-2"
                  style={{ backgroundColor: CHANNEL_COLORS[channel] ?? "#E5E2DB" }}
                />
                <p className="text-xs" style={{ color: "#6B6B6B" }}>{CHANNEL_LABELS[channel] ?? channel}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: "#1A1A1A" }}>{count}</p>
              </div>
            ))}
          </div>

          <h2 className="text-base font-semibold mb-4" style={{ color: "#1A1A1A" }}>최근 문의</h2>
          <div className="space-y-2">
            {data.recent.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#FFFFFF" }}>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CHANNEL_COLORS[item.channel] ?? "#E5E2DB" }}
                />
                <span className="text-sm font-medium" style={{ color: "#1A1A1A" }}>
                  {CHANNEL_LABELS[item.channel] ?? item.channel}
                </span>
                {item.product_name && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}>
                    {item.product_name}
                  </span>
                )}
                <span className="text-xs ml-auto" style={{ color: "#9B9B9B" }}>
                  {new Date(item.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
            ))}
            {data.recent.length === 0 && (
              <p className="text-center py-8" style={{ color: "#9B9B9B" }}>아직 문의가 없습니다</p>
            )}
          </div>
        </>
      ) : (
        <p style={{ color: "#9B9B9B" }}>불러오는 중...</p>
      )}
    </div>
  );
}
