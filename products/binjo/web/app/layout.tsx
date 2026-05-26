import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "빈조농장 — 경남 사천 용치골의 사과",
  description: "한 알 한 알, 정성으로 키운 사과를 농장에서 직접 보내드립니다.",
  openGraph: {
    title: "빈조농장 — 경남 사천 용치골의 사과",
    description: "한 알 한 알, 정성으로 키운 사과를 농장에서 직접 보내드립니다.",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "빈조농장 사과",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "빈조농장 — 경남 사천 용치골의 사과",
    description: "한 알 한 알, 정성으로 키운 사과를 농장에서 직접 보내드립니다.",
  },
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
