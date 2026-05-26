"use client";

import { useEffect, useState } from "react";
import { ReviewItem } from "@/types";

export default function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [form, setForm] = useState({ customer_name: "", customer_location: "", content: "", rating: 5 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    fetch("/api/v1/reviews")
      .then((r) => r.json())
      .then(setReviews);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.content) return;
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: form.customer_name || null,
        customer_location: form.customer_location || null,
        content: form.content,
        rating: form.rating,
        sort_order: reviews.length,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setForm({ customer_name: "", customer_location: "", content: "", rating: 5 });
      setMessage("후기가 등록되었습니다!");
      load();
    } else {
      setMessage("후기 등록 실패");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 후기를 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    load();
  };

  const inputStyle = { borderColor: "#E5E2DB", backgroundColor: "#F5F1EC" };

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-xl font-bold mb-1" style={{ color: "#2D5016" }}>고객 후기</h1>
      <p className="text-sm mb-8" style={{ color: "#6B6B6B" }}>카카오톡 후기 등을 직접 등록합니다</p>

      {/* Add review */}
      <div className="rounded-2xl p-6 mb-8" style={{ backgroundColor: "#FFFFFF" }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: "#1A1A1A" }}>후기 추가</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#6B6B6B" }}>고객 이름</label>
              <input
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                placeholder="김○○"
                className="w-full px-3 py-2 rounded-xl border outline-none text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#6B6B6B" }}>지역</label>
              <input
                value={form.customer_location}
                onChange={(e) => setForm({ ...form, customer_location: e.target.value })}
                placeholder="서울"
                className="w-full px-3 py-2 rounded-xl border outline-none text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#6B6B6B" }}>후기 내용 *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="후기 내용을 입력하세요"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border outline-none text-sm resize-none"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "#6B6B6B" }}>별점</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setForm({ ...form, rating: star })}
                  className="text-2xl"
                  style={{ color: star <= form.rating ? "#E8913A" : "#E5E2DB" }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={handleAdd}
              disabled={saving || !form.content}
              className="px-6 py-2.5 rounded-xl font-bold text-white text-sm disabled:opacity-50"
              style={{ backgroundColor: "#2D5016" }}
            >
              {saving ? "등록 중..." : "후기 등록"}
            </button>
            {message && (
              <p className="text-sm" style={{ color: message.includes("실패") ? "#D4421E" : "#4A7C2E" }}>
                {message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Review list */}
      <h2 className="text-base font-semibold mb-4" style={{ color: "#1A1A1A" }}>
        등록된 후기 ({reviews.length}개)
      </h2>
      <div className="space-y-3">
        {reviews.map((review) => (
          <div key={review.id} className="p-4 rounded-2xl flex gap-4" style={{ backgroundColor: "#FFFFFF" }}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium" style={{ color: "#1A1A1A" }}>
                  {review.customer_name ?? "고객"}
                </span>
                {review.customer_location && (
                  <span className="text-xs" style={{ color: "#9B9B9B" }}>{review.customer_location}</span>
                )}
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className="text-xs" style={{ color: s <= review.rating ? "#E8913A" : "#E5E2DB" }}>★</span>
                  ))}
                </div>
              </div>
              <p className="text-sm" style={{ color: "#6B6B6B" }}>{review.content}</p>
            </div>
            <button
              onClick={() => handleDelete(review.id)}
              className="text-xs px-3 py-1.5 rounded-lg h-fit"
              style={{ backgroundColor: "#FEE8E5", color: "#D4421E" }}
            >
              삭제
            </button>
          </div>
        ))}
        {reviews.length === 0 && (
          <p className="text-center py-8" style={{ color: "#9B9B9B" }}>등록된 후기가 없습니다</p>
        )}
      </div>
    </div>
  );
}
