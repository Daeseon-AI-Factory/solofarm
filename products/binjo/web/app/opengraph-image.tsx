import { ImageResponse } from "next/og";

export const alt = "빈조농장 — 농장과 사과 이야기";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "#F7F3E9",
          background:
            "linear-gradient(135deg, #17351F 0%, #24482B 58%, #4F713E 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 27,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: "#D77B2F",
            }}
          />
          빈조농장 · 농장 기록
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 900,
              fontSize: 78,
              lineHeight: 1.12,
              fontWeight: 800,
              letterSpacing: "-0.045em",
            }}
          >
            <div style={{ display: "flex" }}>농장과 사과의 시간을</div>
            <div style={{ display: "flex" }}>전합니다</div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              lineHeight: 1.4,
              color: "#E8E1D2",
            }}
          >
            판매 가능 여부는 확인된 연락 채널을 통해 안내합니다
          </div>
        </div>
      </div>
    ),
    size,
  );
}
