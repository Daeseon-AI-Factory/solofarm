"use client";

import { useEffect, useState } from "react";
import ImageUpload from "@/components/admin/ImageUpload";

interface FarmForm {
  name: string;
  tagline: string;
  story: string;
  phone: string;
  kakao_chat_url: string;
  naver_store_url: string;
  youtube_url: string;
  address_short: string;
  address: string;
  hero_image_url: string;
  farmer_image_url: string;
  stats_area: string;
  stats_experience: string;
  stats_varieties: string;
}

// Defined outside the page component so React doesn't treat it as a new
// component type on every render — which would unmount/remount the input
// and cause focus loss after every keystroke.
function Field({
  label, field, type = "text", placeholder = "", hint = "", form, onChange,
}: {
  label: string;
  field: keyof FarmForm;
  type?: string;
  placeholder?: string;
  hint?: string;
  form: FarmForm;
  onChange: (field: keyof FarmForm, value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "#1A1A1A" }}>
        {label}
      </label>
      {hint && <p className="text-xs mb-1" style={{ color: "#9B9B9B" }}>{hint}</p>}
      {type === "textarea" ? (
        <textarea
          value={form[field]}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder}
          rows={5}
          className="w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 text-sm resize-none"
          style={{ borderColor: "#E5E2DB", backgroundColor: "#FFFFFF" }}
        />
      ) : (
        <input
          type={type}
          value={form[field]}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 text-sm"
          style={{ borderColor: "#E5E2DB", backgroundColor: "#FFFFFF" }}
        />
      )}
    </div>
  );
}

export default function FarmAdminPage() {
  const [form, setForm] = useState<FarmForm>({
    name: "", tagline: "", story: "", phone: "",
    kakao_chat_url: "", naver_store_url: "", youtube_url: "",
    address_short: "", address: "", hero_image_url: "", farmer_image_url: "",
    stats_area: "", stats_experience: "", stats_varieties: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/v1/farm")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setForm({
          name: data.name ?? "",
          tagline: data.tagline ?? "",
          story: data.story ?? "",
          phone: data.phone ?? "",
          kakao_chat_url: data.kakao_chat_url ?? "",
          naver_store_url: data.naver_store_url ?? "",
          youtube_url: data.youtube_url ?? "",
          address_short: data.address_short ?? "",
          address: data.address ?? "",
          hero_image_url: data.hero_image_url ?? "",
          farmer_image_url: data.farmer_image_url ?? "",
          stats_area: data.stats?.area ?? "",
          stats_experience: data.stats?.experience ?? "",
          stats_varieties: data.stats?.varieties ?? "",
        });
      });
  }, []);

  const handleChange = (field: keyof FarmForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/farm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name || undefined,
        tagline: form.tagline || null,
        story: form.story || null,
        phone: form.phone || null,
        kakao_chat_url: form.kakao_chat_url || null,
        naver_store_url: form.naver_store_url || null,
        youtube_url: form.youtube_url || null,
        address_short: form.address_short || null,
        address: form.address || null,
        hero_image_url: form.hero_image_url || null,
        farmer_image_url: form.farmer_image_url || null,
        stats: {
          area: form.stats_area || undefined,
          experience: form.stats_experience || undefined,
          varieties: form.stats_varieties || undefined,
        },
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("저장되었습니다!");
    } else {
      const data = await res.json();
      setMessage(data.error?.message ?? "저장 실패");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-xl font-bold mb-1" style={{ color: "#2D5016" }}>농장 정보 수정</h1>
      <p className="text-sm mb-8" style={{ color: "#6B6B6B" }}>브랜드 페이지에 표시되는 정보를 수정합니다</p>

      <div className="space-y-6">
        <Field label="농장 이름" field="name" placeholder="빈조농장" form={form} onChange={handleChange} />
        <Field label="한 줄 소개 (태그라인)" field="tagline" placeholder="한 알 한 알, 정성으로 키웁니다" form={form} onChange={handleChange} />
        <Field
          label="농장 이야기"
          field="story"
          type="textarea"
          placeholder="농장 소개글을 입력해주세요. 문단 구분은 빈 줄로 하세요."
          hint="문단을 나누려면 엔터 두 번 누르세요"
          form={form}
          onChange={handleChange}
        />

        <hr style={{ borderColor: "#E5E2DB" }} />
        <h2 className="text-base font-semibold" style={{ color: "#1A1A1A" }}>연락처</h2>

        <Field label="전화번호" field="phone" placeholder="010-0000-0000" form={form} onChange={handleChange} />
        <Field
          label="카카오톡 채널 링크"
          field="kakao_chat_url"
          placeholder="https://pf.kakao.com/_xxxxx/chat"
          hint="카카오톡 채널을 만든 후 채팅 링크를 붙여넣으세요"
          form={form}
          onChange={handleChange}
        />
        <Field label="네이버 스마트스토어 URL" field="naver_store_url" placeholder="https://smartstore.naver.com/..." form={form} onChange={handleChange} />

        <hr style={{ borderColor: "#E5E2DB" }} />
        <h2 className="text-base font-semibold" style={{ color: "#1A1A1A" }}>유튜브 영상</h2>
        <Field
          label="유튜브 URL"
          field="youtube_url"
          placeholder="https://www.youtube.com/watch?v=..."
          hint="유튜브 동영상 링크를 붙여넣으면 브랜드 페이지에 자동으로 삽입됩니다"
          form={form}
          onChange={handleChange}
        />

        <hr style={{ borderColor: "#E5E2DB" }} />
        <h2 className="text-base font-semibold" style={{ color: "#1A1A1A" }}>위치</h2>
        <Field label="짧은 주소" field="address_short" placeholder="경남 사천시 용치골" form={form} onChange={handleChange} />
        <Field label="전체 주소" field="address" placeholder="경상남도 사천시 용현면 용치골길 00" form={form} onChange={handleChange} />

        <hr style={{ borderColor: "#E5E2DB" }} />
        <h2 className="text-base font-semibold" style={{ color: "#1A1A1A" }}>이미지</h2>
        <ImageUpload
          label="메인 배경 이미지"
          hint="1920x1080px 이상, 가로로 넓은 사진 권장"
          value={form.hero_image_url}
          onChange={(url) => handleChange("hero_image_url", url)}
        />
        <ImageUpload
          label="농장주 사진"
          hint="세로로 긴 사진 권장 (3:4 비율)"
          value={form.farmer_image_url}
          onChange={(url) => handleChange("farmer_image_url", url)}
        />

        <hr style={{ borderColor: "#E5E2DB" }} />
        <h2 className="text-base font-semibold" style={{ color: "#1A1A1A" }}>농장 통계</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#6B6B6B" }}>재배 면적</label>
            <input
              value={form.stats_area}
              onChange={(e) => handleChange("stats_area", e.target.value)}
              placeholder="3,000평"
              className="w-full px-3 py-2 rounded-xl border outline-none text-sm"
              style={{ borderColor: "#E5E2DB", backgroundColor: "#FFFFFF" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#6B6B6B" }}>재배 경력</label>
            <input
              value={form.stats_experience}
              onChange={(e) => handleChange("stats_experience", e.target.value)}
              placeholder="15년"
              className="w-full px-3 py-2 rounded-xl border outline-none text-sm"
              style={{ borderColor: "#E5E2DB", backgroundColor: "#FFFFFF" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#6B6B6B" }}>주요 품종</label>
            <input
              value={form.stats_varieties}
              onChange={(e) => handleChange("stats_varieties", e.target.value)}
              placeholder="3종"
              className="w-full px-3 py-2 rounded-xl border outline-none text-sm"
              style={{ borderColor: "#E5E2DB", backgroundColor: "#FFFFFF" }}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "#2D5016" }}
        >
          {saving ? "저장 중..." : "저장하기"}
        </button>
        {message && (
          <p className="text-sm" style={{ color: message === "저장되었습니다!" ? "#4A7C2E" : "#D4421E" }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
