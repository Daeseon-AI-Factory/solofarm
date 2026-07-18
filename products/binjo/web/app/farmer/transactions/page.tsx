"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  confirmTransaction,
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
  type Transaction,
} from "@/lib/farmerApi";
import { localDateISO } from "@/lib/farmerDate";

const INCOME_CATEGORIES = ["직거래", "스마트스토어", "도매/경매", "보조금", "기타수입"];
const EXPENSE_CATEGORIES = ["농약", "비료", "자재", "인건비", "연료비", "포장비", "운송비", "시설투자", "기타지출"];

type TransactionType = "income" | "expense";
type FilterType = "all" | TransactionType;
type FormMode = "create" | "edit" | "review";

interface FormState {
  type: TransactionType;
  category: string;
  amount: string;
  description: string;
  counterparty: string;
  transactionDate: string;
  notes: string;
}

function makeInitialForm(): FormState {
  return {
    type: "expense",
    category: EXPENSE_CATEGORIES[0],
    amount: "",
    description: "",
    counterparty: "",
    transactionDate: localDateISO(),
    notes: "",
  };
}

function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    manual: "직접 입력",
    receipt_photo: "영수증",
    voice: "음성",
    order: "주문",
    nh_screenshot: "거래내역",
  };
  return labels[source] ?? source;
}

function TransactionsPageContent() {
  const searchParams = useSearchParams();
  const requestedNewType = searchParams.get("new");
  const queryHandledRef = useRef<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(makeInitialForm);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionId, setActionId] = useState("");

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listTransactions(filter === "all" ? undefined : { type: filter });
      setTransactions(response.transactions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "거래 내역을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (result, transaction) => {
        result[transaction.type] += transaction.amount;
        return result;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions]);

  const categories = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const openCreateForm = useCallback((type: TransactionType = "expense") => {
    const initialForm = makeInitialForm();
    setForm({
      ...initialForm,
      type,
      category: type === "income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
    });
    setEditingTransaction(null);
    setFormMode("create");
    setFormError("");
    setFormOpen(true);
  }, []);

  const openTransactionForm = (transaction: Transaction, mode: "edit" | "review") => {
    setEditingTransaction(transaction);
    setFormMode(mode);
    setForm({
      type: transaction.type,
      category: transaction.category,
      amount: String(transaction.amount),
      description: transaction.description ?? "",
      counterparty: transaction.counterparty ?? "",
      transactionDate: transaction.transaction_date,
      notes: transaction.notes ?? "",
    });
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setFormError("");
  };

  useEffect(() => {
    if (requestedNewType !== "income" && requestedNewType !== "expense") return;
    if (queryHandledRef.current === requestedNewType) return;
    queryHandledRef.current = requestedNewType;
    openCreateForm(requestedNewType);
  }, [openCreateForm, requestedNewType]);

  const changeType = (type: TransactionType) => {
    setForm((current) => ({
      ...current,
      type,
      category: type === "income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    const amount = Number(form.amount.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("0원보다 큰 금액을 입력해주세요.");
      return;
    }
    if (!form.transactionDate) {
      setFormError("거래 날짜를 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type: form.type,
        category: form.category,
        amount,
        description: form.description.trim() || undefined,
        counterparty: form.counterparty.trim() || undefined,
        transaction_date: form.transactionDate,
        notes: form.notes.trim() || undefined,
      };

      if (formMode === "create") {
        await createTransaction(payload);
      } else if (editingTransaction) {
        await updateTransaction(editingTransaction.id, payload);
        if (formMode === "review" && editingTransaction.status !== "confirmed") {
          await confirmTransaction(editingTransaction.id);
        }
      }
      setForm(makeInitialForm());
      setFormOpen(false);
      setEditingTransaction(null);
      await loadTransactions();
    } catch (createError) {
      setFormError(createError instanceof Error ? createError.message : "거래를 저장하지 못했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    if (!window.confirm(`${formatWon(transaction.amount)} 거래를 삭제하시겠습니까?`)) return;
    setActionId(transaction.id);
    try {
      await deleteTransaction(transaction.id);
      await loadTransactions();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "거래를 삭제하지 못했습니다");
    } finally {
      setActionId("");
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#243D18" }}>거래 내역</h1>
          <p className="mt-1 text-sm" style={{ color: "#66705F" }}>수입과 지출을 빠뜨리지 않고 기록합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => openCreateForm("expense")}
          className="min-h-12 rounded-xl px-4 text-sm font-bold text-white"
          style={{ backgroundColor: "#2D5016" }}
        >
          + 거래 입력
        </button>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#DDE5D8" }}>
          <p className="text-xs font-semibold" style={{ color: "#66705F" }}>표시된 수입</p>
          <p className="mt-1 text-xl font-bold" style={{ color: "#2D6B3F" }}>+{formatWon(totals.income)}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#E9DDD6" }}>
          <p className="text-xs font-semibold" style={{ color: "#66705F" }}>표시된 지출</p>
          <p className="mt-1 text-xl font-bold" style={{ color: "#B54D2A" }}>-{formatWon(totals.expense)}</p>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 rounded-xl p-1" style={{ backgroundColor: "#E9EDE5" }}>
        {([
          ["all", "전체"],
          ["income", "수입"],
          ["expense", "지출"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className="min-h-12 rounded-lg text-sm font-bold"
            style={{
              backgroundColor: filter === value ? "#FFFFFF" : "transparent",
              color: filter === value ? "#243D18" : "#66705F",
              boxShadow: filter === value ? "0 1px 3px rgba(31,61,18,0.12)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border p-4 text-sm" style={{ backgroundColor: "#FFF7ED", borderColor: "#F2C48D", color: "#8A4515" }} role="alert">
          {error}
          <button type="button" onClick={() => void loadTransactions()} className="ml-2 font-bold underline">다시 시도</button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: "#66705F" }}>거래 내역을 확인하고 있습니다...</div>
      ) : transactions.length === 0 ? (
        <section className="rounded-3xl border px-6 py-12 text-center" style={{ backgroundColor: "#FFFFFF", borderColor: "#DDE5D8" }}>
          <p className="font-bold" style={{ color: "#243D18" }}>아직 거래 내역이 없습니다</p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "#66705F" }}>
            첫 수입이나 지출을 직접 입력하면 가계부와 월간 리포트에 반영됩니다.
          </p>
          <button type="button" onClick={() => openCreateForm("expense")} className="mt-5 min-h-14 rounded-xl px-6 text-base font-bold text-white" style={{ backgroundColor: "#2D5016" }}>
            첫 거래 입력하기
          </button>
        </section>
      ) : (
        <section className="space-y-3">
          {transactions.map((transaction) => {
            const isIncome = transaction.type === "income";
            const busy = actionId === transaction.id;
            return (
              <article key={transaction.id} className="rounded-2xl border p-4" style={{ backgroundColor: "#FFFFFF", borderColor: "#DDE5D8" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: isIncome ? "#E9F5EC" : "#FBEDE8", color: isIncome ? "#2D6B3F" : "#A04426" }}>
                        {transaction.category}
                      </span>
                      <span className="text-xs" style={{ color: "#7B8575" }}>{sourceLabel(transaction.source)}</span>
                      {transaction.status !== "confirmed" && (
                        <span className="rounded-full px-2 py-1 text-[11px] font-bold" style={{ backgroundColor: "#FFF4D6", color: "#8A5A12" }}>확인 필요</span>
                      )}
                    </div>
                    <p className="mt-2 font-semibold" style={{ color: "#243D18" }}>
                      {transaction.description || transaction.counterparty || "내용 없음"}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "#7B8575" }}>
                      {transaction.transaction_date}{transaction.counterparty ? ` · ${transaction.counterparty}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-lg font-bold" style={{ color: isIncome ? "#2D6B3F" : "#B54D2A" }}>
                    {isIncome ? "+" : "-"}{formatWon(transaction.amount)}
                  </p>
                </div>
                <div className="mt-3 flex justify-end gap-2 border-t pt-3" style={{ borderColor: "#EEF1EB" }}>
                  {transaction.status !== "confirmed" && (
                    <button type="button" disabled={busy} onClick={() => openTransactionForm(transaction, "review")} className="min-h-12 rounded-lg px-4 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}>
                      검토 후 확인
                    </button>
                  )}
                  <button type="button" disabled={busy} onClick={() => openTransactionForm(transaction, "edit")} className="min-h-12 rounded-lg px-4 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: "#F1F5EE", color: "#2D5016" }}>
                    수정
                  </button>
                  <button type="button" disabled={busy} onClick={() => void handleDelete(transaction)} className="min-h-12 rounded-lg px-4 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: "#F7F2EF", color: "#9F3F24" }}>
                    삭제
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 px-0 md:items-center md:px-4" role="dialog" aria-modal="true" aria-labelledby="transaction-form-title">
          <form onSubmit={handleSubmit} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 shadow-2xl md:rounded-3xl" style={{ backgroundColor: "#FFFFFF" }}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 id="transaction-form-title" className="text-lg font-bold" style={{ color: "#243D18" }}>
                  {formMode === "create" ? "거래 입력" : formMode === "review" ? "거래 내용 검토" : "거래 수정"}
                </h2>
                <p className="mt-1 text-sm" style={{ color: "#66705F" }}>
                  {formMode === "review"
                    ? "금액과 분류를 확인한 뒤 확정해주세요."
                    : "저장하면 가계부와 월간 현황에 반영됩니다."}
                </p>
              </div>
              <button type="button" onClick={closeForm} className="h-12 w-12 rounded-full text-xl" style={{ backgroundColor: "#F1F4EF", color: "#66705F" }} aria-label="닫기">×</button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl p-1" style={{ backgroundColor: "#E9EDE5" }}>
              {(["expense", "income"] as const).map((type) => (
                <button key={type} type="button" onClick={() => changeType(type)} className="min-h-13 rounded-lg text-base font-bold" style={{ backgroundColor: form.type === type ? "#FFFFFF" : "transparent", color: form.type === type ? (type === "income" ? "#2D6B3F" : "#A04426") : "#66705F" }}>
                  {type === "income" ? "수입" : "지출"}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold" style={{ color: "#384832" }}>분류</span>
                <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="min-h-14 w-full rounded-xl border px-4 text-base" style={{ borderColor: "#D7DDD2", backgroundColor: "#FAFBF9" }}>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold" style={{ color: "#384832" }}>금액</span>
                <div className="relative">
                  <input type="number" inputMode="numeric" min="1" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="예: 35000" className="min-h-14 w-full rounded-xl border px-4 pr-10 text-lg font-bold" style={{ borderColor: "#D7DDD2", backgroundColor: "#FAFBF9", color: "#243D18" }} autoFocus={formMode === "create"} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#66705F" }}>원</span>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold" style={{ color: "#384832" }}>거래 날짜</span>
                <input type="date" value={form.transactionDate} onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} className="min-h-14 w-full rounded-xl border px-4 text-base" style={{ borderColor: "#D7DDD2", backgroundColor: "#FAFBF9" }} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold" style={{ color: "#384832" }}>내용</span>
                <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder={form.type === "income" ? "예: 부사 5kg 판매" : "예: 복합비료 구입"} className="min-h-14 w-full rounded-xl border px-4 text-base" style={{ borderColor: "#D7DDD2", backgroundColor: "#FAFBF9" }} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold" style={{ color: "#384832" }}>거래처 <span className="font-normal" style={{ color: "#8A9385" }}>(선택)</span></span>
                <input value={form.counterparty} onChange={(event) => setForm((current) => ({ ...current, counterparty: event.target.value }))} placeholder="예: 사천농협" className="min-h-14 w-full rounded-xl border px-4 text-base" style={{ borderColor: "#D7DDD2", backgroundColor: "#FAFBF9" }} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold" style={{ color: "#384832" }}>메모 <span className="font-normal" style={{ color: "#8A9385" }}>(선택)</span></span>
                <textarea rows={2} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="결제 방식이나 특이사항" className="min-h-14 w-full resize-none rounded-xl border px-4 py-3 text-base" style={{ borderColor: "#D7DDD2", backgroundColor: "#FAFBF9" }} />
              </label>
            </div>

            {formError && <p className="mt-4 rounded-xl p-3 text-sm" style={{ backgroundColor: "#FFF7ED", color: "#9A4518" }} role="alert">{formError}</p>}

            <button type="submit" disabled={saving} className="mt-5 min-h-14 w-full rounded-xl text-base font-bold text-white disabled:opacity-50" style={{ backgroundColor: "#2D5016" }}>
              {saving
                ? "저장 중..."
                : formMode === "review"
                  ? "내용 확인 및 확정"
                  : formMode === "edit"
                    ? "수정 저장"
                    : `${form.type === "income" ? "수입" : "지출"} 저장`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm" style={{ color: "#66705F" }}>
          거래 내역을 준비하고 있습니다...
        </div>
      }
    >
      <TransactionsPageContent />
    </Suspense>
  );
}
