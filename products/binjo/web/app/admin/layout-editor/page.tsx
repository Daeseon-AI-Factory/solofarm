"use client";

import { useEffect, useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SectionConfig {
  id: string;
  label: string;
  visible: boolean;
  bgColor?: string;
  bgImage?: string;
}

const PRESET_COLORS = [
  "#FDFBF7", "#F5F1EC", "#FFFFFF", "#EDF4E8",
  "#2D5016", "#1A1A1A", "#FEF3E2", "#F0F4FF",
];

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: "hero", label: "메인 배너", visible: true },
  { id: "story", label: "농장 이야기", visible: true },
  { id: "products", label: "상품 소개", visible: true },
  { id: "calendar", label: "제철 달력", visible: true },
  { id: "youtube", label: "유튜브 영상", visible: true },
  { id: "gallery", label: "사진 갤러리", visible: true },
  { id: "reviews", label: "고객 후기", visible: true },
  { id: "order", label: "주문/문의", visible: true },
];

// Defined outside the page component to prevent React focus loss on re-render
function SortableItem({
  section,
  index,
  onToggle,
  onExpand,
  isExpanded,
}: {
  section: SectionConfig;
  index: number;
  onToggle: () => void;
  onExpand: () => void;
  isExpanded: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderColor: "#E5E2DB" }}
      className="rounded-xl border"
      {...attributes}
    >
      <div className="flex items-center gap-3 p-4">
        {/* Drag handle */}
        <button
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none p-1"
          style={{ color: "#9B9B9B" }}
          aria-label="드래그하여 순서 변경"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="7" cy="4" r="1.5" />
            <circle cx="13" cy="4" r="1.5" />
            <circle cx="7" cy="10" r="1.5" />
            <circle cx="13" cy="10" r="1.5" />
            <circle cx="7" cy="16" r="1.5" />
            <circle cx="13" cy="16" r="1.5" />
          </svg>
        </button>

        {/* Order number */}
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{
            backgroundColor: section.visible ? "#2D5016" : "#9B9B9B",
            color: "#FFFFFF",
          }}
        >
          {index + 1}
        </span>

        {/* Section name + color preview */}
        <button
          onClick={onExpand}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <span
            className="text-sm font-medium"
            style={{ color: section.visible ? "#1A1A1A" : "#9B9B9B" }}
          >
            {section.label}
          </span>
          {(section.bgColor || section.bgImage) && (
            <span
              className="w-4 h-4 rounded-full border flex-shrink-0"
              style={{
                backgroundColor: section.bgColor || "#FFFFFF",
                backgroundImage: section.bgImage ? `url(${section.bgImage})` : undefined,
                backgroundSize: "cover",
                borderColor: "#E5E2DB",
              }}
            />
          )}
          <span className="text-xs" style={{ color: "#9B9B9B" }}>
            {isExpanded ? "▲" : "▼"}
          </span>
        </button>

        {/* Toggle visibility */}
        <button
          onClick={onToggle}
          className="w-12 h-7 rounded-full relative transition-colors flex-shrink-0"
          style={{
            backgroundColor: section.visible ? "#2D5016" : "#D1D1D1",
          }}
        >
          <span
            className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform"
            style={{
              transform: section.visible ? "translateX(22px)" : "translateX(2px)",
            }}
          />
        </button>
      </div>
    </div>
  );
}

// Separate component for the style editor panel to avoid re-render issues
function StyleEditor({
  section,
  onUpdate,
}: {
  section: SectionConfig;
  onUpdate: (updates: Partial<SectionConfig>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        onUpdate({ bgImage: data.url });
      } else {
        // Show the error from the API so the user knows what went wrong
        const data = await res.json().catch(() => null);
        setUploadError(data?.error?.message ?? `업로드 실패 (${res.status})`);
      }
    } catch (err) {
      setUploadError("네트워크 오류 — 다시 시도해주세요");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div
      className="px-4 pb-4 pt-0 space-y-3 border-t"
      style={{ borderColor: "#F5F1EC" }}
    >
      {/* Color picker */}
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: "#6B6B6B" }}>
          배경 색상
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onUpdate({ bgColor: color })}
              className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: color,
                borderColor: section.bgColor === color ? "#2D5016" : "#E5E2DB",
              }}
            />
          ))}
          {/* Custom color input */}
          <label
            className="w-8 h-8 rounded-lg border-2 overflow-hidden cursor-pointer flex items-center justify-center text-xs"
            style={{ borderColor: "#E5E2DB" }}
          >
            <input
              type="color"
              value={section.bgColor || "#FDFBF7"}
              onChange={(e) => onUpdate({ bgColor: e.target.value })}
              className="w-10 h-10 cursor-pointer opacity-0 absolute"
            />
            <span style={{ color: "#9B9B9B" }}>🎨</span>
          </label>
          {section.bgColor && (
            <button
              onClick={() => onUpdate({ bgColor: undefined })}
              className="h-8 px-2 rounded-lg border text-xs"
              style={{ borderColor: "#E5E2DB", color: "#9B9B9B" }}
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/* Background image */}
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: "#6B6B6B" }}>
          배경 이미지
        </label>
        {section.bgImage && (
          <div className="mb-2 rounded-xl overflow-hidden border" style={{ borderColor: "#E5E2DB" }}>
            <img
              src={section.bgImage}
              alt="배경 미리보기"
              className="w-full h-24 object-cover"
            />
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-50"
            style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
          >
            {uploading ? "업로드 중..." : section.bgImage ? "이미지 변경" : "이미지 선택"}
          </button>
          {section.bgImage && (
            <button
              onClick={() => onUpdate({ bgImage: undefined })}
              className="px-3 py-2 rounded-xl text-xs font-medium"
              style={{ backgroundColor: "#F5F1EC", color: "#9B9B9B" }}
            >
              삭제
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />
        {uploadError && (
          <p className="text-xs mt-1" style={{ color: "#D4421E" }}>
            {uploadError}
          </p>
        )}
      </div>
    </div>
  );
}

export default function LayoutEditorPage() {
  const [sections, setSections] = useState<SectionConfig[]>(DEFAULT_SECTIONS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  useEffect(() => {
    fetch("/api/admin/sections", { credentials: "include" })
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.sections_config && Array.isArray(data.sections_config)) {
          const saved = data.sections_config as SectionConfig[];
          const savedIds = new Set(saved.map((s) => s.id));
          // Merge saved config with defaults — preserves bgColor/bgImage from saved data
          const merged = [
            ...saved,
            ...DEFAULT_SECTIONS.filter((d) => !savedIds.has(d.id)),
          ];
          setSections(merged);
        }
      })
      .catch(() => {});
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const toggleVisibility = (index: number) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], visible: !newSections[index].visible };
    setSections(newSections);
  };

  const updateSection = (index: number, updates: Partial<SectionConfig>) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], ...updates };
    setSections(newSections);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/sections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sections }),
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
      <h1 className="text-xl font-bold mb-1" style={{ color: "#2D5016" }}>
        페이지 관리
      </h1>
      <p className="text-sm mb-8" style={{ color: "#6B6B6B" }}>
        섹션 순서, 보이기/숨기기, 배경 색상/이미지를 설정합니다
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {sections.map((section, index) => (
              <div key={section.id}>
                <SortableItem
                  section={section}
                  index={index}
                  onToggle={() => toggleVisibility(index)}
                  onExpand={() =>
                    setExpandedId(expandedId === section.id ? null : section.id)
                  }
                  isExpanded={expandedId === section.id}
                />
                {expandedId === section.id && (
                  <div
                    className="rounded-b-xl border border-t-0 -mt-1"
                    style={{ borderColor: "#E5E2DB", backgroundColor: "#FFFFFF" }}
                  >
                    <StyleEditor
                      section={section}
                      onUpdate={(updates) => updateSection(index, updates)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
          <p
            className="text-sm"
            style={{ color: message === "저장되었습니다!" ? "#4A7C2E" : "#D4421E" }}
          >
            {message}
          </p>
        )}
      </div>

      <div
        className="mt-6 rounded-xl p-4 text-xs leading-relaxed"
        style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
      >
        <p className="font-semibold mb-1" style={{ color: "#1A1A1A" }}>사용법</p>
        <ul className="space-y-1">
          <li>• <strong>⠿</strong> 아이콘을 잡고 드래그하여 순서를 변경합니다</li>
          <li>• <strong>토글 스위치</strong>로 섹션을 보이거나 숨깁니다</li>
          <li>• <strong>섹션 이름</strong>을 터치하면 배경 설정이 열립니다</li>
          <li>• 변경 후 <strong>저장하기</strong>를 눌러야 반영됩니다</li>
        </ul>
      </div>
    </div>
  );
}
