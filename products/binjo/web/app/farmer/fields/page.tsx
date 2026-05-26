"use client";

import { useEffect, useState, useCallback } from "react";
import { listFields, createField, type Field } from "@/lib/farmerApi";

// --- Types for the add/edit form ---

interface FieldFormData {
  name: string;
  crop: string;
  area_pyeong: string; // string for input, parsed to number on submit
  address: string;
  notes: string;
}

const EMPTY_FORM: FieldFormData = {
  name: "",
  crop: "사과",
  area_pyeong: "",
  address: "",
  notes: "",
};

export default function FieldsPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FieldFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // --- Data fetching ---

  const fetchFields = useCallback(async () => {
    try {
      setError(null);
      const data = await listFields();
      setFields(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "필지 목록을 불러오지 못했습니다";
      setError(message);
      console.error("[FieldsPage] Failed to fetch fields:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  // --- Modal handlers ---

  const openAddModal = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormError(null);
  };

  const handleSave = async () => {
    // Validate required field
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFormError("필지 이름을 입력해주세요");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload: {
        name: string;
        crop?: string;
        area_pyeong?: number;
        address?: string;
        notes?: string;
      } = { name: trimmedName };

      if (form.crop.trim()) payload.crop = form.crop.trim();
      if (form.area_pyeong.trim()) {
        const parsed = Number(form.area_pyeong);
        if (isNaN(parsed) || parsed <= 0) {
          setFormError("면적은 0보다 큰 숫자를 입력해주세요");
          setSaving(false);
          return;
        }
        payload.area_pyeong = parsed;
      }
      if (form.address.trim()) payload.address = form.address.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();

      await createField(payload);
      closeModal();
      await fetchFields();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "필지 등록에 실패했습니다";
      setFormError(message);
      console.error("[FieldsPage] Failed to create field:", err);
    } finally {
      setSaving(false);
    }
  };

  // --- Delete handler (disabled — backend not ready) ---

  const handleDelete = () => {
    // No-op: backend update/delete endpoints not yet available
  };

  // --- Render helpers ---

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      {/* Leaf icon */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: "#EDF4E8" }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2D5016"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66L7 18" />
          <path d="M17 8c3-1 7 2 7 2s-2 6-6 7" />
          <path d="M17 8l-1-4" />
        </svg>
      </div>
      <p
        className="text-base font-medium mb-1"
        style={{ color: "#3D3D3D" }}
      >
        등록된 필지가 없습니다
      </p>
      <p className="text-sm mb-6" style={{ color: "#9B9B9B" }}>
        과수원 필지를 등록하면 일지 작성이 편해집니다
      </p>
      <button
        onClick={openAddModal}
        className="px-6 font-medium rounded-xl text-white transition-opacity active:opacity-80"
        style={{
          backgroundColor: "#2D5016",
          height: 56,
          minWidth: 200,
          fontSize: 16,
        }}
      >
        첫 필지 등록하기
      </button>
    </div>
  );

  const renderFieldCard = (field: Field) => (
    <div
      key={field.id}
      className="rounded-2xl p-4 mb-3 border"
      style={{
        backgroundColor: "#FFFFFF",
        borderColor: "#E5E2DB",
      }}
    >
      {/* Top row: name + crop/area */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3
            className="text-base font-bold"
            style={{ color: "#2D2D2D" }}
          >
            {field.name}
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "#6B6B6B" }}>
            {field.crop || "사과"}
            {field.area_pyeong != null && ` · ${field.area_pyeong}평`}
          </p>
        </div>
      </div>

      {/* Address */}
      {field.address && (
        <p className="text-sm mb-1" style={{ color: "#9B9B9B" }}>
          {field.address}
        </p>
      )}

      {/* Notes */}
      {field.notes && (
        <p
          className="text-sm rounded-lg p-2 mt-2"
          style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
        >
          {field.notes}
        </p>
      )}

      {/* Action buttons — disabled since backend doesn't support update/delete yet */}
      <div className="flex gap-2 mt-3">
        <button
          disabled
          title="준비 중"
          className="flex-1 text-sm font-medium rounded-xl border transition-opacity"
          style={{
            height: 44,
            borderColor: "#E5E2DB",
            color: "#C4C4C4",
            backgroundColor: "#FAFAFA",
            cursor: "not-allowed",
          }}
        >
          수정
        </button>
        <button
          disabled
          title="준비 중"
          onClick={handleDelete}
          className="flex-1 text-sm font-medium rounded-xl border transition-opacity"
          style={{
            height: 44,
            borderColor: "#E5E2DB",
            color: "#C4C4C4",
            backgroundColor: "#FAFAFA",
            cursor: "not-allowed",
          }}
        >
          삭제
        </button>
      </div>
    </div>
  );

  const renderModal = () => {
    if (!modalOpen) return null;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-50"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={closeModal}
        />

        {/* Bottom sheet */}
        <div
          className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl"
          style={{ backgroundColor: "#FFFFFF", maxHeight: "90vh" }}
        >
          <div className="overflow-y-auto p-5" style={{ maxHeight: "85vh" }}>
            {/* Drag handle */}
            <div className="flex justify-center mb-4">
              <div
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: "#D9D9D9" }}
              />
            </div>

            <h2
              className="text-lg font-bold mb-5"
              style={{ color: "#2D2D2D" }}
            >
              필지 등록
            </h2>

            {/* Form error */}
            {formError && (
              <div
                className="rounded-xl p-3 mb-4 text-sm"
                style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
              >
                {formError}
              </div>
            )}

            {/* Name (required) */}
            <label className="block mb-4">
              <span
                className="text-sm font-medium block mb-1.5"
                style={{ color: "#3D3D3D" }}
              >
                필지 이름 <span style={{ color: "#DC2626" }}>*</span>
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: A동 후지, 뒷밭"
                className="w-full rounded-xl border px-4 text-base outline-none transition-colors focus:ring-2"
                style={{
                  height: 56,
                  borderColor: "#E5E2DB",
                  backgroundColor: "#FDFBF7",
                  color: "#2D2D2D",
                  // ring color handled by focus:ring
                }}
              />
            </label>

            {/* Crop */}
            <label className="block mb-4">
              <span
                className="text-sm font-medium block mb-1.5"
                style={{ color: "#3D3D3D" }}
              >
                작물
              </span>
              <input
                type="text"
                value={form.crop}
                onChange={(e) => setForm({ ...form, crop: e.target.value })}
                placeholder="사과"
                className="w-full rounded-xl border px-4 text-base outline-none transition-colors focus:ring-2"
                style={{
                  height: 56,
                  borderColor: "#E5E2DB",
                  backgroundColor: "#FDFBF7",
                  color: "#2D2D2D",
                }}
              />
            </label>

            {/* Area (평) */}
            <label className="block mb-4">
              <span
                className="text-sm font-medium block mb-1.5"
                style={{ color: "#3D3D3D" }}
              >
                면적 (평)
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={form.area_pyeong}
                onChange={(e) =>
                  setForm({ ...form, area_pyeong: e.target.value })
                }
                placeholder="500"
                className="w-full rounded-xl border px-4 text-base outline-none transition-colors focus:ring-2"
                style={{
                  height: 56,
                  borderColor: "#E5E2DB",
                  backgroundColor: "#FDFBF7",
                  color: "#2D2D2D",
                }}
              />
            </label>

            {/* Address */}
            <label className="block mb-4">
              <span
                className="text-sm font-medium block mb-1.5"
                style={{ color: "#3D3D3D" }}
              >
                주소
              </span>
              <input
                type="text"
                value={form.address}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
                placeholder="경남 사천시 ..."
                className="w-full rounded-xl border px-4 text-base outline-none transition-colors focus:ring-2"
                style={{
                  height: 56,
                  borderColor: "#E5E2DB",
                  backgroundColor: "#FDFBF7",
                  color: "#2D2D2D",
                }}
              />
            </label>

            {/* Notes */}
            <label className="block mb-6">
              <span
                className="text-sm font-medium block mb-1.5"
                style={{ color: "#3D3D3D" }}
              >
                메모
              </span>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value })
                }
                placeholder="특이사항, 토양 정보 등"
                rows={3}
                className="w-full rounded-xl border px-4 py-3 text-base outline-none transition-colors resize-none focus:ring-2"
                style={{
                  borderColor: "#E5E2DB",
                  backgroundColor: "#FDFBF7",
                  color: "#2D2D2D",
                }}
              />
            </label>

            {/* Buttons */}
            <div className="flex gap-3 pb-4">
              <button
                onClick={closeModal}
                disabled={saving}
                className="flex-1 font-medium rounded-xl border transition-opacity active:opacity-80"
                style={{
                  height: 56,
                  borderColor: "#E5E2DB",
                  color: "#6B6B6B",
                  backgroundColor: "#FFFFFF",
                }}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 font-medium rounded-xl text-white transition-opacity active:opacity-80 disabled:opacity-50"
                style={{
                  height: 56,
                  backgroundColor: "#2D5016",
                }}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  // --- Main render ---

  return (
    <div className="px-4 py-5" style={{ backgroundColor: "#F5F1EC", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold" style={{ color: "#2D2D2D" }}>
          필지 관리
        </h2>
        <button
          onClick={openAddModal}
          className="font-medium rounded-xl text-white transition-opacity active:opacity-80"
          style={{
            backgroundColor: "#2D5016",
            height: 44,
            paddingLeft: 20,
            paddingRight: 20,
            fontSize: 15,
          }}
        >
          + 추가
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="rounded-xl p-3 mb-4 text-sm"
          style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
        >
          {error}
          <button
            onClick={() => {
              setLoading(true);
              fetchFields();
            }}
            className="ml-2 underline font-medium"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-20">
          <p style={{ color: "#9B9B9B" }}>불러오는 중...</p>
        </div>
      )}

      {/* Content */}
      {!loading && !error && fields.length === 0 && renderEmptyState()}
      {!loading && fields.length > 0 && (
        <div>
          <p className="text-sm mb-3" style={{ color: "#9B9B9B" }}>
            총 {fields.length}개 필지
          </p>
          {fields.map(renderFieldCard)}
        </div>
      )}

      {/* Add modal (bottom sheet) */}
      {renderModal()}
    </div>
  );
}
