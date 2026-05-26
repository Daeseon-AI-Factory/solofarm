"use client";

import { useRef, useState } from "react";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label: string;
  hint?: string;
}

export default function ImageUpload({ value, onChange, label, hint }: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.url) {
        onChange(data.url);
        setSuccess("업로드 완료!");
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error?.message ?? "업로드 실패");
      }
    } catch {
      setError("업로드 중 오류가 발생했습니다");
    }

    setUploading(false);
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "#1A1A1A" }}>
        {label}
      </label>
      {hint && <p className="text-xs mb-2" style={{ color: "#9B9B9B" }}>{hint}</p>}

      {/* Preview */}
      {value && (
        <div className="mb-2">
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#E5E2DB" }}>
            <img
              src={value}
              alt="미리보기"
              className="w-full h-40 object-cover"
              onError={(e) => {
                // Show broken image indicator if URL doesn't load
                e.currentTarget.style.display = "none";
                setError("이미지를 불러올 수 없습니다. 버킷이 Public인지 확인해주세요.");
              }}
            />
          </div>
          <p className="text-xs mt-1 truncate" style={{ color: "#9B9B9B" }}>{value}</p>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
        >
          {uploading ? "업로드 중..." : value ? "사진 변경" : "사진 선택"}
        </button>

        {value && (
          <button
            type="button"
            onClick={() => { onChange(""); setSuccess(""); setError(""); }}
            className="px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: "#F5F1EC", color: "#9B9B9B" }}
          >
            삭제
          </button>
        )}

        {success && (
          <span className="text-xs font-medium" style={{ color: "#4A7C2E" }}>✓ {success}</span>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleUpload}
        className="hidden"
      />

      {error && (
        <p className="text-xs mt-1" style={{ color: "#D4421E" }}>{error}</p>
      )}
    </div>
  );
}
