"use client";

import { useEffect, useState } from "react";
import { GalleryPhotoItem } from "@/types";
import ImageUpload from "@/components/admin/ImageUpload";

export default function GalleryAdminPage() {
  const [photos, setPhotos] = useState<GalleryPhotoItem[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    fetch("/api/v1/gallery")
      .then((r) => r.json())
      .then(setPhotos);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!imageUrl) return;
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption || null,
        sort_order: photos.length,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setImageUrl("");
      setCaption("");
      setMessage("사진이 추가되었습니다!");
      load();
    } else {
      setMessage("사진 추가 실패");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 사진을 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/gallery/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-xl font-bold mb-1" style={{ color: "#2D5016" }}>사진 갤러리</h1>
      <p className="text-sm mb-8" style={{ color: "#6B6B6B" }}>농장 풍경 사진을 관리합니다</p>

      {/* Add photo */}
      <div className="rounded-2xl p-6 mb-8" style={{ backgroundColor: "#FFFFFF" }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: "#1A1A1A" }}>사진 추가</h2>
        <div className="space-y-3">
          <ImageUpload
            label="사진 선택"
            hint="JPG, PNG, WebP 파일 (최대 10MB)"
            value={imageUrl}
            onChange={setImageUrl}
          />
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#6B6B6B" }}>
              사진 설명 (선택)
            </label>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="2023년 가을 수확"
              className="w-full px-4 py-3 rounded-xl border outline-none text-sm"
              style={{ borderColor: "#E5E2DB", backgroundColor: "#F5F1EC" }}
            />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={handleAdd}
              disabled={saving || !imageUrl}
              className="px-6 py-2.5 rounded-xl font-bold text-white text-sm disabled:opacity-50"
              style={{ backgroundColor: "#2D5016" }}
            >
              {saving ? "추가 중..." : "갤러리에 추가"}
            </button>
            {message && (
              <p className="text-sm" style={{ color: message.includes("실패") ? "#D4421E" : "#4A7C2E" }}>
                {message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Photo grid */}
      <h2 className="text-base font-semibold mb-4" style={{ color: "#1A1A1A" }}>
        등록된 사진 ({photos.length}장)
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group rounded-xl overflow-hidden">
            <img
              src={photo.image_url}
              alt={photo.caption ?? "농장 사진"}
              className="w-full h-32 object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <button
                onClick={() => handleDelete(photo.id)}
                className="opacity-0 group-hover:opacity-100 text-white text-xs px-3 py-1.5 rounded-lg transition-opacity"
                style={{ backgroundColor: "#D4421E" }}
              >
                삭제
              </button>
            </div>
            {photo.caption && (
              <p className="text-xs p-2 truncate" style={{ color: "#6B6B6B" }}>{photo.caption}</p>
            )}
          </div>
        ))}
        {photos.length === 0 && (
          <p className="col-span-full text-center py-8" style={{ color: "#9B9B9B" }}>
            등록된 사진이 없습니다
          </p>
        )}
      </div>
    </div>
  );
}
