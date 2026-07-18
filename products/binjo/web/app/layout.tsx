import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://solofarm.daeseon.ai"),
  title: "빈조농장 | 농장과 사과 이야기",
  description:
    "빈조농장의 사과와 농장 소식을 확인하세요. 주문 가능 여부는 등록된 문의 채널을 통해 안내합니다.",
  openGraph: {
    url: "/",
    siteName: "빈조농장",
    title: "빈조농장 | 농장과 사과 이야기",
    description:
      "빈조농장의 사과와 농장 소식을 확인하세요. 주문 가능 여부는 등록된 문의 채널을 통해 안내합니다.",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "빈조농장 — 농장과 사과 이야기",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "빈조농장 | 농장과 사과 이야기",
    description:
      "빈조농장의 사과와 농장 소식을 확인하세요. 주문 가능 여부는 등록된 문의 채널을 통해 안내합니다.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#24482B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
