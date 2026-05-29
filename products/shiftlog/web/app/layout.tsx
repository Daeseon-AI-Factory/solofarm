import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShiftLog — 카페 사장님을 위한 작업 관리",
  description:
    "신입 알바한테 설명하듯 폰에 말씀하시면, 우리가 작업지시서로 만들어드려요.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
