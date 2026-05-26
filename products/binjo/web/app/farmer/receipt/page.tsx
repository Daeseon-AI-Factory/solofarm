"use client";

import { useState, useRef } from "react";
import {
  uploadReceipt,
  getReceiptStatus,
  getReceiptResult,
  confirmTransaction,
  type ReceiptResult,
} from "@/lib/farmerApi";

/**
 * Receipt capture page — farmer takes photo of receipt, AI extracts items.
 *
 * Flow: camera/gallery → upload → OCR processing → review parsed items →
 *       confirm or edit → transactions created.
 *
 * Glove Test: one big capture button, large text, no fiddly controls.
 */

type Step = "capture" | "uploading" | "processing" | "review" | "done" | "error";

export default function ReceiptCapturePage() {
  const [step, setStep] = useState<Step>("capture");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReceiptResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    setPreviewUrl(URL.createObjectURL(file));
    setStep("uploading");
    setError("");

    try {
      // Upload
      const upload = await uploadReceipt(file);
      const scanId = upload.receipt_scan_id;

      if (upload.status === "completed") {
        // Sync mode — already done
        const res = await getReceiptResult(scanId);
        setResult(res);
        setStep("review");
        return;
      }

      // Async mode — poll for completion
      setStep("processing");
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
        const status = await getReceiptStatus(scanId);

        if (status.status === "completed") {
          const res = await getReceiptResult(scanId);
          setResult(res);
          setStep("review");
          return;
        }

        if (status.status === "failed") {
          setError(status.error_message || "영수증 분석에 실패했습니다");
          setStep("error");
          return;
        }

        attempts++;
      }

      setError("처리 시간이 초과되었습니다. 다시 시도해주세요.");
      setStep("error");
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 실패");
      setStep("error");
    }
  }

  async function handleConfirmAll() {
    if (!result) return;

    try {
      for (const txnId of result.transaction_ids) {
        await confirmTransaction(txnId);
      }
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "확인 처리 실패");
    }
  }

  function handleRetry() {
    setStep("capture");
    setError("");
    setResult(null);
    setPreviewUrl("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-bold mb-6" style={{ color: "#2D5016" }}>
        영수증 촬영
      </h1>

      {/* Step: Capture */}
      {step === "capture" && (
        <div className="space-y-4">
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: "#FFFFFF", border: "2px dashed #E5E2DB" }}
          >
            <div className="text-5xl mb-4">&#128247;</div>
            <p className="font-bold text-lg mb-2" style={{ color: "#1A1A1A" }}>
              영수증을 촬영해주세요
            </p>
            <p className="text-sm mb-6" style={{ color: "#6B6B6B" }}>
              농협, 농자재상 영수증을 사진으로 찍으면
              <br />
              AI가 자동으로 분석합니다
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
              id="receipt-input"
            />

            <div className="flex flex-col gap-3">
              <label
                htmlFor="receipt-input"
                className="block w-full py-4 rounded-xl font-bold text-white text-lg text-center cursor-pointer transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#2D5016" }}
              >
                &#128247; 카메라로 촬영
              </label>
              <button
                onClick={() => {
                  if (fileRef.current) {
                    fileRef.current.removeAttribute("capture");
                    fileRef.current.click();
                    // Restore capture for next time
                    setTimeout(() => fileRef.current?.setAttribute("capture", "environment"), 100);
                  }
                }}
                className="w-full py-4 rounded-xl font-bold text-lg"
                style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}
              >
                &#128193; 갤러리에서 선택
              </button>
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ backgroundColor: "#EDF4E8" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "#2D5016" }}>
              촬영 팁
            </p>
            <ul className="text-xs space-y-1" style={{ color: "#4A7C2E" }}>
              <li>- 영수증 전체가 보이도록 촬영해주세요</li>
              <li>- 글씨가 선명하게 나오면 인식률이 높아요</li>
              <li>- 접힌 부분이 없도록 펼쳐서 촬영해주세요</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step: Uploading / Processing */}
      {(step === "uploading" || step === "processing") && (
        <div className="text-center py-12">
          {previewUrl && (
            <div className="mb-6">
              <img
                src={previewUrl}
                alt="영수증"
                className="w-48 h-auto rounded-xl mx-auto shadow-md"
              />
            </div>
          )}
          <div className="animate-spin text-4xl mb-4">&#9697;</div>
          <p className="font-bold" style={{ color: "#1A1A1A" }}>
            {step === "uploading" ? "업로드 중..." : "AI가 분석하고 있습니다..."}
          </p>
          <p className="text-sm mt-2" style={{ color: "#9B9B9B" }}>
            잠시만 기다려주세요
          </p>
        </div>
      )}

      {/* Step: Review parsed result */}
      {step === "review" && result?.parsed_data && (
        <div className="space-y-4">
          <div
            className="rounded-2xl p-6"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
          >
            <p className="text-xs font-semibold mb-4" style={{ color: "#9B9B9B" }}>
              영수증 인식 결과
            </p>

            {result.parsed_data.store_name && (
              <div className="flex items-center gap-2 mb-3">
                <span>&#127978;</span>
                <span className="font-bold" style={{ color: "#1A1A1A" }}>
                  {result.parsed_data.store_name}
                </span>
                {result.parsed_data.store_type && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
                  >
                    {result.parsed_data.store_type}
                  </span>
                )}
              </div>
            )}

            {result.parsed_data.date && (
              <div className="flex items-center gap-2 mb-4">
                <span>&#128197;</span>
                <span className="text-sm" style={{ color: "#6B6B6B" }}>
                  {result.parsed_data.date}
                </span>
              </div>
            )}

            {/* Items */}
            <div className="space-y-2">
              {result.parsed_data.items.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-start py-2"
                  style={{ borderBottom: "1px solid #F5F1EC" }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#1A1A1A" }}>
                      {item.name}
                      {item.quantity > 1 && ` x${item.quantity}`}
                    </p>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
                    >
                      {item.category}
                    </span>
                  </div>
                  <p className="text-sm font-bold" style={{ color: "#D4421E" }}>
                    {item.total_price.toLocaleString()}원
                  </p>
                </div>
              ))}
            </div>

            {/* Total */}
            <div
              className="flex justify-between items-center mt-4 pt-4"
              style={{ borderTop: "1px solid #E5E2DB" }}
            >
              <span className="font-bold" style={{ color: "#1A1A1A" }}>합계</span>
              <span className="text-lg font-bold" style={{ color: "#D4421E" }}>
                {result.parsed_data.total_amount.toLocaleString()}원
              </span>
            </div>

            {/* Confidence indicator */}
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "#E5E2DB" }}>
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${result.parsed_data.overall_confidence * 100}%`,
                      backgroundColor:
                        result.parsed_data.overall_confidence >= 0.8
                          ? "#2D5016"
                          : "#E8913A",
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color: "#9B9B9B" }}>
                  인식률 {Math.round(result.parsed_data.overall_confidence * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleConfirmAll}
              className="flex-1 py-4 rounded-xl font-bold text-white text-lg"
              style={{ backgroundColor: "#2D5016" }}
            >
              &#10003; 맞아요
            </button>
            <button
              onClick={handleRetry}
              className="flex-1 py-4 rounded-xl font-bold text-lg"
              style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}
            >
              &#9998; 다시 촬영
            </button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">&#10004;&#65039;</div>
          <p className="font-bold text-lg mb-2" style={{ color: "#2D5016" }}>
            등록 완료!
          </p>
          <p className="text-sm mb-6" style={{ color: "#6B6B6B" }}>
            {result?.transaction_ids.length || 0}건의 거래가 기록되었습니다
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              className="flex-1 py-3 rounded-xl font-bold text-white"
              style={{ backgroundColor: "#2D5016" }}
            >
              영수증 추가
            </button>
            <a
              href="/farmer/finance"
              className="flex-1 py-3 rounded-xl font-bold text-center"
              style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}
            >
              가계부 보기
            </a>
          </div>
        </div>
      )}

      {/* Step: Error */}
      {step === "error" && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">&#10060;</div>
          <p className="font-bold text-lg mb-2" style={{ color: "#DC2626" }}>
            분석 실패
          </p>
          <p className="text-sm mb-6" style={{ color: "#6B6B6B" }}>
            {error}
          </p>
          <button
            onClick={handleRetry}
            className="px-8 py-3 rounded-xl font-bold text-white"
            style={{ backgroundColor: "#2D5016" }}
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
