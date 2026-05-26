"use client";

import { useEffect, useState } from "react";
import { ProductItem, PriceOption } from "@/types";
import ImageUpload from "@/components/admin/ImageUpload";

const MONTHS = ["", "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

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

  const addPriceOption = () => setPriceOptions([...priceOptions, { weight: "", price: 0 }]);
  const removePriceOption = (i: number) => setPriceOptions(priceOptions.filter((_, idx) => idx !== i));
  const updatePriceOption = (i: number, field: keyof PriceOption, value: string | number) => {
    setPriceOptions(priceOptions.map((opt, idx) => idx === i ? { ...opt, [field]: value } : opt));
  };

  const handleSubmit = async () => {
    setSaving(true);
    await onSave({
      name, name_en: nameEn || null, short_description: shortDesc || null,
      description: desc || null, harvest_start_month: startMonth, harvest_end_month: endMonth,
      is_available: isAvailable, image_url: imageUrl || null, price_options: priceOptions,
    });
    setSaving(false);
  };

  const inputClass = "w-full px-3 py-2 rounded-xl border outline-none text-sm";
  const inputStyle = { borderColor: "#E5E2DB", backgroundColor: "#FFFFFF" };

  return (
    <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: "#FFFFFF" }}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "#6B6B6B" }}>품종 이름 *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="부사" className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "#6B6B6B" }}>영문 이름</label>
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Fuji" className={inputClass} style={inputStyle} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "#6B6B6B" }}>한 줄 설명</label>
        <input value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} placeholder="아삭하고 달콤한 대표 품종" className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "#6B6B6B" }}>상세 설명</label>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={`${inputClass} resize-none`} style={inputStyle} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "#6B6B6B" }}>수확 시작</label>
          <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} className={inputClass} style={inputStyle}>
            {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "#6B6B6B" }}>수확 종료</label>
          <select value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))} className={inputClass} style={inputStyle}>
            {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      <ImageUpload
        label="상품 사진"
        value={imageUrl}
        onChange={setImageUrl}
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium" style={{ color: "#6B6B6B" }}>가격 옵션</label>
          <button onClick={addPriceOption} className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}>+ 추가</button>
        </div>
        <div className="space-y-2">
          {priceOptions.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input value={opt.weight} onChange={(e) => updatePriceOption(i, "weight", e.target.value)} placeholder="5kg (16-18과)" className={`flex-1 ${inputClass}`} style={inputStyle} />
              <input type="number" value={opt.price} onChange={(e) => updatePriceOption(i, "price", Number(e.target.value))} placeholder="35000" className={`w-28 ${inputClass}`} style={inputStyle} />
              <button onClick={() => removePriceOption(i)} className="text-gray-400 hover:text-red-500 px-2">×</button>
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <div
          className="w-10 h-6 rounded-full relative transition-colors"
          style={{ backgroundColor: isAvailable ? "#2D5016" : "#E5E2DB" }}
          onClick={() => setIsAvailable(!isAvailable)}
        >
          <div
            className="w-4 h-4 bg-white rounded-full absolute top-1 transition-transform"
            style={{ left: isAvailable ? "22px" : "4px" }}
          />
        </div>
        <span className="text-sm font-medium" style={{ color: "#1A1A1A" }}>
          {isAvailable ? "현재 판매 중" : "판매 중지"}
        </span>
      </label>

      <div className="flex gap-3 pt-2">
        <button onClick={handleSubmit} disabled={saving || !name} className="px-6 py-2.5 rounded-xl font-bold text-white text-sm disabled:opacity-50" style={{ backgroundColor: "#2D5016" }}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <button onClick={onCancel} className="px-6 py-2.5 rounded-xl text-sm" style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}>
          취소
        </button>
      </div>
    </div>
  );
}

export default function ProductsAdminPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch("/api/v1/products")
      .then((r) => r.json())
      .then((data) => { setProducts(data); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data: Partial<ProductItem>) => {
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setAdding(false); load(); }
  };

  const handleUpdate = async (id: string, data: Partial<ProductItem>) => {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setEditingId(null); load(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    load();
  };

  const toggleAvailable = async (product: ProductItem) => {
    await fetch(`/api/admin/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_available: !product.is_available }),
    });
    load();
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#2D5016" }}>상품 관리</h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B6B6B" }}>사과 품종을 추가하고 관리합니다</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="px-4 py-2 rounded-xl font-bold text-white text-sm"
          style={{ backgroundColor: "#2D5016" }}
        >
          + 품종 추가
        </button>
      </div>

      {adding && (
        <div className="mb-6">
          <ProductForm onSave={handleCreate} onCancel={() => setAdding(false)} />
        </div>
      )}

      {loading ? (
        <p style={{ color: "#9B9B9B" }}>불러오는 중...</p>
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
                <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ backgroundColor: "#FFFFFF" }}>
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-16 h-16 object-cover rounded-xl" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: "#F5F1EC" }}>🍎</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold" style={{ color: "#1A1A1A" }}>{product.name}</p>
                      <button
                        onClick={() => toggleAvailable(product)}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: product.is_available ? "#D4421E" : "#E5E2DB",
                          color: product.is_available ? "#FFFFFF" : "#6B6B6B",
                        }}
                      >
                        {product.is_available ? "판매 중" : "판매 중지"}
                      </button>
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "#9B9B9B" }}>{product.short_description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(product.id)} className="text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}>수정</button>
                    <button onClick={() => handleDelete(product.id)} className="text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#FEE8E5", color: "#D4421E" }}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {products.length === 0 && !adding && (
            <p className="text-center py-8" style={{ color: "#9B9B9B" }}>등록된 상품이 없습니다</p>
          )}
        </div>
      )}
    </div>
  );
}
