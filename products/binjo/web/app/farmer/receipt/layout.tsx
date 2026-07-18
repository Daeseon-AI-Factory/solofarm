import type { ReactNode } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ReceiptLayout({ children }: { children: ReactNode }) {
  const receiptOcrAvailable =
    process.env.NEXT_PUBLIC_ENABLE_RECEIPT_OCR === "true" &&
    process.env.ENABLE_RECEIPT_OCR === "true";

  if (receiptOcrAvailable) return children;

  return (
    <section className="mx-auto max-w-lg px-4 py-8">
      <div
        className="rounded-2xl border p-6"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E2DB" }}
      >
        <p className="text-sm font-semibold" style={{ color: "#A14B1C" }}>
          기능 준비 중
        </p>
        <h1 className="mt-2 text-xl font-bold" style={{ color: "#2D5016" }}>
          영수증 자동 인식은 현재 사용할 수 없습니다
        </h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "#6B6B6B" }}>
          이미지 저장소와 OCR 연결을 확인한 뒤 제공할 예정입니다. 지금은 영수증을
          업로드하지 마세요.
        </p>
        <Link
          href="/farmer/finance"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm font-bold text-white"
          style={{ backgroundColor: "#2D5016" }}
        >
          가계부로 돌아가기
        </Link>
      </div>
    </section>
  );
}
