import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BINJO — AI Farm Management Platform",
  description:
    "Voice-powered farm diary, receipt OCR bookkeeping, pesticide safety, and direct orders — all designed for use with work gloves on.",
  openGraph: {
    title: "BINJO — AI Farm Management Platform",
    description:
      "Voice-powered farm diary, receipt OCR bookkeeping, pesticide safety, and direct orders — all designed for use with work gloves on.",
    type: "website",
    locale: "en_US",
    url: "https://binjofarm.daeseon.ai/product",
    images: [
      {
        url: "/og-product.jpg",
        width: 1200,
        height: 630,
        alt: "BINJO AI Farm Management Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BINJO — AI Farm Management Platform",
    description:
      "Voice-powered farm diary, receipt OCR bookkeeping, and direct orders — designed for use with work gloves on.",
  },
};

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Override the light farm-brand theme with a dark product theme
    <div className="min-h-screen bg-gray-950 text-white">{children}</div>
  );
}
