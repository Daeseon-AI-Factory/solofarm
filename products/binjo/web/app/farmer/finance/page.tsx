"use client";

import { useState, useEffect } from "react";
import {
  getFinancialDashboard,
  getMonthlyPdfUrl,
  type DashboardData,
  type Transaction,
} from "@/lib/farmerApi";

/**
 * Financial dashboard — farmer sees income, expenses, net profit at a glance.
 * Bar chart shows 6-month trend. Recent transactions listed below.
 * Designed for phone screen with large numbers — passes the Glove Test.
 */

const MONTH_NAMES = ["", "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

const CATEGORY_LABELS: Record<string, string> = {
  pesticide: "농약",
  fertilizer: "비료",
  materials: "자재",
  labor: "인건비",
  fuel: "연료비",
  packaging: "포장비",
  shipping: "운송비",
  other_expense: "기타",
  direct: "직거래",
  smartstore: "스마트스토어",
  wholesale: "도매/경매",
  subsidy: "보조금",
  other_income: "기타",
};

function formatWon(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return `${Math.round(amount / 10000)}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

function TrendChart({ trend }: { trend: DashboardData["trend"] }) {
  if (trend.length === 0) return null;
  const maxVal = Math.max(...trend.map((t) => Math.max(t.total_income, t.total_expense)), 1);

  return (
    <div className="flex items-end gap-2 h-32">
      {trend.map((t) => (
        <div key={`${t.year}-${t.month}`} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex gap-0.5 items-end" style={{ height: "100px" }}>
            <div
              className="flex-1 rounded-t"
              style={{
                height: `${Math.max((t.total_income / maxVal) * 100, 2)}%`,
                backgroundColor: "#2D5016",
              }}
            />
            <div
              className="flex-1 rounded-t"
              style={{
                height: `${Math.max((t.total_expense / maxVal) * 100, 2)}%`,
                backgroundColor: "#D4421E",
              }}
            />
          </div>
          <span className="text-[10px]" style={{ color: "#9B9B9B" }}>
            {t.month}월
          </span>
        </div>
      ))}
    </div>
  );
}

function TransactionRow({ txn }: { txn: Transaction }) {
  const isIncome = txn.type === "income";
  return (
    <div
      className="flex items-center justify-between py-3"
      style={{ borderBottom: "1px solid #F5F1EC" }}
    >
      <div>
        <p className="text-sm font-medium" style={{ color: "#1A1A1A" }}>
          {txn.description || txn.category}
        </p>
        <p className="text-xs" style={{ color: "#9B9B9B" }}>
          {txn.transaction_date} {txn.counterparty ? `· ${txn.counterparty}` : ""}
        </p>
      </div>
      <p
        className="font-bold text-sm"
        style={{ color: isIncome ? "#2D5016" : "#D4421E" }}
      >
        {isIncome ? "+" : "-"}
        {txn.amount.toLocaleString()}원
      </p>
    </div>
  );
}

export default function FinanceDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getFinancialDashboard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p style={{ color: "#9B9B9B" }}>불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8">
        <div className="rounded-xl p-4" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { current_month: cm, trend, recent_transactions } = data;
  const now = new Date();

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Current month summary */}
      <div
        className="rounded-2xl p-6"
        style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
      >
        <p className="text-xs font-semibold mb-4" style={{ color: "#9B9B9B" }}>
          {cm.year}년 {MONTH_NAMES[cm.month]} 현황
        </p>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs mb-1" style={{ color: "#6B6B6B" }}>수입</p>
            <p className="text-lg font-bold" style={{ color: "#2D5016" }}>
              {formatWon(cm.total_income)}
            </p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: "#6B6B6B" }}>지출</p>
            <p className="text-lg font-bold" style={{ color: "#D4421E" }}>
              {formatWon(cm.total_expense)}
            </p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: "#6B6B6B" }}>순이익</p>
            <p
              className="text-lg font-bold"
              style={{ color: cm.net_profit >= 0 ? "#2D5016" : "#D4421E" }}
            >
              {formatWon(cm.net_profit)}
            </p>
          </div>
        </div>

        {/* Category breakdown */}
        {Object.keys(cm.income_by_category).length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid #E5E2DB" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "#9B9B9B" }}>수입 내역</p>
            {Object.entries(cm.income_by_category).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between text-sm py-0.5">
                <span style={{ color: "#6B6B6B" }}>{CATEGORY_LABELS[cat] || cat}</span>
                <span style={{ color: "#2D5016" }}>{amt.toLocaleString()}원</span>
              </div>
            ))}
          </div>
        )}

        {Object.keys(cm.expense_by_category).length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid #E5E2DB" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "#9B9B9B" }}>지출 내역</p>
            {Object.entries(cm.expense_by_category).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between text-sm py-0.5">
                <span style={{ color: "#6B6B6B" }}>{CATEGORY_LABELS[cat] || cat}</span>
                <span style={{ color: "#D4421E" }}>{amt.toLocaleString()}원</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6-month trend chart */}
      {trend.length > 0 && (
        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold" style={{ color: "#9B9B9B" }}>
              최근 6개월 추이
            </p>
            <div className="flex gap-3 text-[10px]">
              <span style={{ color: "#2D5016" }}>&#9632; 수입</span>
              <span style={{ color: "#D4421E" }}>&#9632; 지출</span>
            </div>
          </div>
          <TrendChart trend={trend} />
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <a
          href="/farmer/receipt"
          className="flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm"
          style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
        >
          <span>&#128247;</span> 영수증 촬영
        </a>
        <a
          href={getMonthlyPdfUrl(now.getFullYear(), now.getMonth() + 1)}
          target="_blank"
          className="flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm"
          style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}
        >
          <span>&#128202;</span> 월간 리포트
        </a>
      </div>

      {/* Recent transactions */}
      <div
        className="rounded-2xl p-6"
        style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold" style={{ color: "#9B9B9B" }}>
            최근 거래
          </p>
          <a
            href="/farmer/transactions"
            className="text-xs font-medium px-3 py-2 rounded-lg inline-flex items-center"
            style={{ color: "#2D5016", minHeight: "44px" }}
          >
            전체 보기 &rarr;
          </a>
        </div>

        {recent_transactions.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: "#9B9B9B" }}>
            아직 거래 내역이 없습니다
          </p>
        ) : (
          recent_transactions.map((txn) => (
            <TransactionRow key={txn.id} txn={txn} />
          ))
        )}
      </div>
    </div>
  );
}
