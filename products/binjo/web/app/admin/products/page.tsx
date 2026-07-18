"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ProductItem, PriceOption } from "@/types";
import ImageUpload from "@/components/admin/ImageUpload";
import AdminPage from "@/components/admin/AdminPage";
import AdminNotice from "@/components/admin/AdminNotice";

const MONTHS = ["", "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const INPUT_CLASS = "min-h-12 w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-[#2D5016]/20";
const INPUT_STYLE = { borderColor: "#D8D4CB", backgroundColor: "#FFFFFF" };

async function responseError(response: Response, fallback: string): Promise<Error> {
  const data = await response.json().catch(() => null);
  return new Error(data?.error?.message ?? fallback);
}

function ProductForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<ProductItem>;
  onSave: (data: Partial<ProductItem>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [nameEn, setNameEn] = useState(initial?.name_en ?? "");
  const [shortDesc, setShortDesc] = useState(initial?.short_description ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [startMonth, setStartMonth] = useState(initial?.harvest_start_month ?? 9);
  const [endMonth, setEndMonth] = useState(initial?.harvest_end_month ?? 11);
  const [isAvailable, setIsAvailable] = useState(initial?.is_available ?? false);
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>(
    initial?.price_options ?? [{ weight: "5kg", price: 30000 }]
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const addPriceOption = () => setPriceOptions((current) => [...current, { weight: "", price: 0 }]);
  const removePriceOption = (index: number) => {
    setPriceOptions((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };
  const updatePriceOption = (
    index: number,
    field: keyof PriceOption,
    value: string | number
  ) => {
    setPriceOptions((current) =>
      current.map((option, currentIndex) =>
        currentIndex === index ? { ...option, [field]: value } : option
      )
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("품종 이름을 입력해주세요");
      return;
    }

    const normalizedOptions = priceOptions
      .filter((option) => option.weight.trim() || option.price > 0)
      .map((option) => ({ weight: option.weight.trim(), price: Number(option.price) }));
    const hasInvalidPrice = normalizedOptions.some(
      (option) => !option.weight || !Number.isInteger(option.price) || option.price <= 0
    );
    if (hasInvalidPrice) {
      setFormError("각 가격 옵션의 중량과 1원 이상의 정수 가격을 확인해주세요");
      return;
    }
    if (isAvailable && normalizedOptions.length === 0) {
      setFormError("판매 문의를 받으려면 가격 옵션을 하나 이상 입력해주세요");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        name_en: nameEn.trim() || null,
        short_description: shortDesc.trim() || null,
        description: desc.trim() || null,
        harvest_start_month: startMonth,
        harvest_end_month: endMonth,
        is_available: isAvailable,
        image_url: imageUrl || null,
        price_options: normalizedOptions,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "상품을 저장하지 못했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border bg-white p-4 sm:p-6"
      style={{ borderColor: "#DEE3DA" }}
    >
      <section>
        <h2 className="text-lg font-bold" style={{ color: "#1F3D12" }}>
          {initial?.id ? "상품 수정" : "새 상품"}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "#66705F" }}>
          고객이 먼저 확인하는 이름, 사진과 가격부터 입력하세요.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold" style={{ color: "#34422F" }}>
          품종 이름 *
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="부사"
            maxLength={100}
            className={`${INPUT_CLASS} mt-1`}
            style={INPUT_STYLE}
            autoFocus
          />
        </label>
        <label className="text-sm font-semibold" style={{ color: "#34422F" }}>
          영문 이름
          <input
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
            placeholder="Fuji"
            maxLength={100}
            className={`${INPUT_CLASS} mt-1`}
            style={INPUT_STYLE}
          />
        </label>
      </div>

      <ImageUpload
        label="상품 사진"
        hint="고객이 상품을 바로 알아볼 수 있는 밝은 정면 사진을 권장합니다."
        value={imageUrl}
        onChange={setImageUrl}
      />

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold" style={{ color: "#34422F" }}>가격 옵션</h3>
            <p className="mt-0.5 text-xs" style={{ color: "#66705F" }}>중량·구성과 고객 안내 가격을 입력하세요.</p>
          </div>
          <button
            type="button"
            onClick={addPriceOption}
            className="min-h-11 rounded-xl px-4 text-sm font-bold"
            style={{ backgroundColor: "#EFF4EC", color: "#2D5016" }}
          >
            + 옵션 추가
          </button>
        </div>
        <div className="space-y-3">
          {priceOptions.map((option, index) => (
            <div key={index} className="grid grid-cols-[1fr_120px_48px] gap-2">
              <label className="sr-only" htmlFor={`weight-${index}`}>중량과 구성</label>
              <input
                id={`weight-${index}`}
                value={option.weight}
                onChange={(event) => updatePriceOption(index, "weight", event.target.value)}
                placeholder="5kg (16~18과)"
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              />
              <label className="sr-only" htmlFor={`price-${index}`}>가격</label>
              <input
                id={`price-${index}`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={option.price || ""}
                onChange={(event) => updatePriceOption(index, "price", Number(event.target.value))}
                placeholder="35000"
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              />
              <button
                type="button"
                onClick={() => removePriceOption(index)}
                aria-label={`${index + 1}번째 가격 옵션 삭제`}
                className="min-h-12 rounded-xl text-xl font-bold"
                style={{ backgroundColor: "#FFF0ED", color: "#9F3218" }}
              >
                ×
              </button>
            </div>
          ))}
          {priceOptions.length === 0 && (
            <p className="rounded-xl p-3 text-sm" style={{ backgroundColor: "#F7F5F0", color: "#66705F" }}>
              소개만 표시할 상품은 가격 없이 저장할 수 있습니다.
            </p>
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={() => setIsAvailable((current) => !current)}
        aria-pressed={isAvailable}
        className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border px-4 text-left"
        style={{
          borderColor: isAvailable ? "#9DBB8E" : "#D8D4CB",
          backgroundColor: isAvailable ? "#EEF6EA" : "#F7F5F0",
        }}
      >
        <span>
          <span className="block font-bold" style={{ color: "#1F3D12" }}>
            {isAvailable ? "판매 문의 가능" : "소개만 표시"}
          </span>
          <span className="mt-1 block text-xs leading-relaxed" style={{ color: "#66705F" }}>
            판매를 중지해도 상품 소개는 고객 페이지에 계속 보입니다.
          </span>
        </span>
        <span
          aria-hidden="true"
          className="relative h-8 w-14 shrink-0 rounded-full transition-colors"
          style={{ backgroundColor: isAvailable ? "#2D5016" : "#B8BDB4" }}
        >
          <span
            className="absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform"
            style={{ transform: isAvailable ? "translateX(28px)" : "translateX(4px)" }}
          />
        </span>
      </button>

      <details className="rounded-2xl border p-4" style={{ borderColor: "#DEE3DA", backgroundColor: "#FBFAF7" }}>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold" style={{ color: "#2D5016" }}>
          설명과 수확 시기
        </summary>
        <div className="mt-3 space-y-4">
          <label className="block text-sm font-semibold" style={{ color: "#34422F" }}>
            한 줄 설명
            <input
              value={shortDesc}
              onChange={(event) => setShortDesc(event.target.value)}
              placeholder="아삭하고 달콤한 대표 품종"
              maxLength={200}
              className={`${INPUT_CLASS} mt-1`}
              style={INPUT_STYLE}
            />
          </label>
          <label className="block text-sm font-semibold" style={{ color: "#34422F" }}>
            상세 설명
            <textarea
              value={desc}
              onChange={(event) => setDesc(event.target.value)}
              rows={4}
              className={`${INPUT_CLASS} mt-1 resize-y`}
              style={INPUT_STYLE}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-semibold" style={{ color: "#34422F" }}>
              수확 시작
              <select
                value={startMonth}
                onChange={(event) => setStartMonth(Number(event.target.value))}
                className={`${INPUT_CLASS} mt-1`}
                style={INPUT_STYLE}
              >
                {MONTHS.slice(1).map((month, index) => (
                  <option key={index + 1} value={index + 1}>{month}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold" style={{ color: "#34422F" }}>
              수확 종료
              <select
                value={endMonth}
                onChange={(event) => setEndMonth(Number(event.target.value))}
                className={`${INPUT_CLASS} mt-1`}
                style={INPUT_STYLE}
              >
                {MONTHS.slice(1).map((month, index) => (
                  <option key={index + 1} value={index + 1}>{month}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </details>

      {formError && <AdminNotice tone="error">{formError}</AdminNotice>}

      <div className="flex flex-wrap gap-2 border-t pt-5" style={{ borderColor: "#E7E3DB" }}>
        <button
          type="submit"
          disabled={saving}
          className="min-h-13 flex-1 rounded-xl px-6 text-sm font-bold text-white disabled:opacity-50 sm:flex-none"
          style={{ backgroundColor: "#2D5016" }}
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-h-13 flex-1 rounded-xl px-6 text-sm font-bold disabled:opacity-50 sm:flex-none"
          style={{ backgroundColor: "#F0EEE8", color: "#5F675A" }}
        >
          취소
        </button>
      </div>
    </form>
  );
}

export default function ProductsAdminPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/products", { cache: "no-store" });
      if (!response.ok) throw await responseError(response, "상품을 불러오지 못했습니다");
      setProducts(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "상품을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (data: Partial<ProductItem>) => {
    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw await responseError(response, "상품을 추가하지 못했습니다");
    setAdding(false);
    setNotice("상품을 추가했습니다.");
    await load();
  };

  const handleUpdate = async (id: string, data: Partial<ProductItem>) => {
    const response = await fetch(`/api/admin/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw await responseError(response, "상품을 수정하지 못했습니다");
    setEditingId(null);
    setNotice("상품 정보를 저장했습니다.");
    await load();
  };

  const handleDelete = async (product: ProductItem) => {
    if (!confirm(`'${product.name}' 상품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    setUpdatingId(product.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      if (!response.ok) throw await responseError(response, "상품을 삭제하지 못했습니다");
      setNotice("상품을 삭제했습니다.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "상품을 삭제하지 못했습니다");
    } finally {
      setUpdatingId("");
    }
  };

  const toggleAvailable = async (product: ProductItem) => {
    setUpdatingId(product.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: !product.is_available }),
      });
      if (!response.ok) throw await responseError(response, "판매 상태를 변경하지 못했습니다");
      setNotice(
        product.is_available
          ? "판매 문의를 중지했습니다. 상품 소개는 계속 표시됩니다."
          : "판매 문의 가능 상태로 변경했습니다."
      );
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "판매 상태를 변경하지 못했습니다");
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <AdminPage
      title="상품"
      description="고객에게 보이는 품종, 사진, 가격과 판매 문의 상태를 관리합니다."
      eyebrow="PRODUCT CATALOG"
      maxWidth="wide"
      actions={
        <>
          <Link
            href="/"
            target="_blank"
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl border bg-white px-4 text-sm font-bold sm:flex-none"
            style={{ borderColor: "#CFD6CA", color: "#2D5016" }}
          >
            고객 화면 보기 ↗
          </Link>
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
              setNotice("");
            }}
            className="min-h-12 flex-1 rounded-xl px-5 text-sm font-bold text-white sm:flex-none"
            style={{ backgroundColor: "#2D5016" }}
          >
            + 상품 추가
          </button>
        </>
      }
    >
      {notice && <AdminNotice tone="success" className="mb-4">{notice}</AdminNotice>}
      {error && (
        <AdminNotice
          tone="error"
          title="상품 작업을 완료하지 못했습니다"
          className="mb-4"
          action={
            <button
              type="button"
              onClick={() => void load()}
              className="min-h-11 rounded-xl border bg-white px-4 text-sm font-bold"
              style={{ borderColor: "#C9806E" }}
            >
              다시 불러오기
            </button>
          }
        >
          {error}
        </AdminNotice>
      )}

      {adding && (
        <div className="mb-6">
          <ProductForm onSave={handleCreate} onCancel={() => setAdding(false)} />
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-sm" style={{ borderColor: "#DEE3DA", color: "#66705F" }}>
          상품을 불러오고 있습니다...
        </div>
      ) : products.length === 0 && !adding ? (
        <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: "#CDD3C8", color: "#66705F" }}>
          <p className="font-semibold">등록된 상품이 없습니다.</p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 min-h-12 rounded-xl px-4 text-sm font-bold underline"
            style={{ color: "#2D5016" }}
          >
            첫 상품 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <div key={product.id}>
              {editingId === product.id ? (
                <ProductForm
                  initial={product}
                  onSave={(data) => handleUpdate(product.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <article className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "#DEE3DA" }}>
                  <div className="flex items-start gap-4">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-24 sm:w-24" />
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl text-sm font-bold sm:h-24 sm:w-24" style={{ backgroundColor: "#F3F1EB", color: "#8A8174" }}>
                        사진 없음
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold" style={{ color: "#1F3D12" }}>{product.name}</h2>
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-bold"
                          style={{
                            backgroundColor: product.is_available ? "#E7F2E1" : "#EEEDE9",
                            color: product.is_available ? "#2D5016" : "#66705F",
                          }}
                        >
                          {product.is_available ? "판매 문의 가능" : "소개만 표시"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed" style={{ color: "#66705F" }}>
                        {product.short_description || "한 줄 설명이 없습니다."}
                      </p>
                      <p className="mt-2 text-sm font-semibold" style={{ color: "#34422F" }}>
                        {(product.price_options ?? []).length > 0
                          ? `${product.price_options?.length}개 가격 옵션`
                          : "가격 정보 없음"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <button
                      type="button"
                      onClick={() => void toggleAvailable(product)}
                      disabled={updatingId === product.id}
                      aria-pressed={product.is_available}
                      className="min-h-12 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
                      style={{ backgroundColor: "#EFF4EC", color: "#2D5016" }}
                    >
                      {product.is_available ? "판매 중지" : "판매 시작"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(product.id);
                        setAdding(false);
                        setNotice("");
                      }}
                      className="min-h-12 rounded-xl px-4 text-sm font-bold"
                      style={{ backgroundColor: "#F0EEE8", color: "#34422F" }}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(product)}
                      disabled={updatingId === product.id}
                      className="min-h-12 rounded-xl px-4 text-sm font-bold disabled:opacity-50 sm:col-start-auto"
                      style={{ backgroundColor: "#FFF0ED", color: "#9F3218" }}
                    >
                      삭제
                    </button>
                  </div>
                </article>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
