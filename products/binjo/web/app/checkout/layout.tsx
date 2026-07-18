import type { ReactNode } from "react";
import Link from "next/link";

// This layout must evaluate the private gate from the running container rather
// than being frozen into a static build artifact.
export const dynamic = "force-dynamic";

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  const checkoutAvailable =
    process.env.NEXT_PUBLIC_ENABLE_DIRECT_CHECKOUT === "true" &&
    process.env.ENABLE_DIRECT_CHECKOUT === "true" &&
    Boolean(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY?.trim());

  if (checkoutAvailable) return children;

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "#FDFBF7" }}
    >
      <section
        className="w-full max-w-md rounded-2xl border p-7 text-center"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E2DB" }}
      >
        <p className="text-sm font-semibold" style={{ color: "#A14B1C" }}>
          온라인 결제 준비 중
        </p>
        <h1 className="mt-2 text-2xl font-bold" style={{ color: "#2D5016" }}>
          현재 이 페이지에서는 주문을 받지 않습니다
        </h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "#6B6B6B" }}>
          결제 연결이 확인되기 전에는 배송 정보나 결제 정보를 입력받지 않습니다.
          판매 여부와 예약 방법은 농장 안내에서 확인해 주세요.
        </p>
        <Link
          href="/#order"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 font-bold text-white"
          style={{ backgroundColor: "#2D5016" }}
        >
          판매 안내 확인하기
        </Link>
      </section>
    </main>
  );
}
