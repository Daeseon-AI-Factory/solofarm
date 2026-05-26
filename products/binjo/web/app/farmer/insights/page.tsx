"use client";

import { useState, useEffect } from "react";
import {
  listCustomers,
  getMonthlyPdfUrl,
  type Customer,
  type MonthlySummary,
  getMonthlyReport,
} from "@/lib/farmerApi";

/**
 * Intelligence dashboard — AI insights, customer analytics, yearly overview.
 *
 * Shows:
 * - Customer analytics (top customers, repeat rate, channel distribution)
 * - Quick links to monthly/yearly reports
 * - AI insight cards (future — placeholder for now)
 */

function formatWon(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return `${Math.round(amount / 10000)}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

function CustomerCard({ customer, rank }: { customer: Customer; rank: number }) {
  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{ borderBottom: "1px solid #F5F1EC" }}
    >
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
        style={{
          backgroundColor: rank <= 3 ? "#2D5016" : "#E5E2DB",
          color: rank <= 3 ? "#FFFFFF" : "#6B6B6B",
        }}
      >
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "#1A1A1A" }}>
          {customer.name || customer.phone}
        </p>
        <p className="text-xs" style={{ color: "#9B9B9B" }}>
          {customer.total_orders}회 주문
          {customer.preferred_products.length > 0 &&
            ` · ${customer.preferred_products[0]}`}
        </p>
      </div>
      <p className="text-sm font-bold" style={{ color: "#2D5016" }}>
        {formatWon(customer.total_spent)}
      </p>
    </div>
  );
}

export default function InsightsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [yearlyData, setYearlyData] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const thisYear = new Date().getFullYear();
  const thisMonth = new Date().getMonth() + 1;

  useEffect(() => {
    async function loadData() {
      try {
        // Load customers
        const custData = await listCustomers();
        setCustomers(custData.customers);
        setTotalCustomers(custData.total);

        // Load last 3 months for quick summary
        const months: MonthlySummary[] = [];
        for (let i = 0; i < 3; i++) {
          let m = thisMonth - i;
          let y = thisYear;
          if (m <= 0) { m += 12; y--; }
          try {
            const report = await getMonthlyReport(y, m);
            months.push(report);
          } catch {
            // No data for this month — skip
          }
        }
        setYearlyData(months);
      } catch (err) {
        setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const repeatCustomers = customers.filter((c) => c.total_orders >= 2);
  const repeatRate = totalCustomers > 0
    ? Math.round((repeatCustomers.length / totalCustomers) * 100)
    : 0;
  const vipCustomers = customers.filter((c) => c.total_orders >= 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p style={{ color: "#9B9B9B" }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold" style={{ color: "#2D5016" }}>
        경영 인사이트
      </h1>

      {error && (
        <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>
          {error}
        </div>
      )}

      {/* Customer summary */}
      <div
        className="rounded-2xl p-6"
        style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
      >
        <p className="text-xs font-semibold mb-4" style={{ color: "#9B9B9B" }}>
          고객 분석
        </p>
        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div>
            <p className="text-2xl font-bold" style={{ color: "#2D5016" }}>
              {totalCustomers}
            </p>
            <p className="text-xs" style={{ color: "#6B6B6B" }}>총 고객</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: "#E8913A" }}>
              {repeatRate}%
            </p>
            <p className="text-xs" style={{ color: "#6B6B6B" }}>재구매율</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: "#D4421E" }}>
              {vipCustomers.length}
            </p>
            <p className="text-xs" style={{ color: "#6B6B6B" }}>VIP (3회+)</p>
          </div>
        </div>
      </div>

      {/* Top customers */}
      {customers.length > 0 && (
        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
        >
          <p className="text-xs font-semibold mb-3" style={{ color: "#9B9B9B" }}>
            상위 고객
          </p>
          {customers.slice(0, 5).map((c, i) => (
            <CustomerCard key={c.id} customer={c} rank={i + 1} />
          ))}
        </div>
      )}

      {/* Recent months */}
      {yearlyData.length > 0 && (
        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
        >
          <p className="text-xs font-semibold mb-4" style={{ color: "#9B9B9B" }}>
            최근 월별 현황
          </p>
          <div className="space-y-3">
            {yearlyData.map((m) => (
              <div
                key={`${m.year}-${m.month}`}
                className="flex items-center justify-between py-2"
                style={{ borderBottom: "1px solid #F5F1EC" }}
              >
                <span className="text-sm font-medium" style={{ color: "#1A1A1A" }}>
                  {m.year}.{m.month.toString().padStart(2, "0")}
                </span>
                <div className="flex gap-4 text-sm">
                  <span style={{ color: "#2D5016" }}>+{formatWon(m.total_income)}</span>
                  <span style={{ color: "#D4421E" }}>-{formatWon(m.total_expense)}</span>
                  <span
                    className="font-bold"
                    style={{ color: m.net_profit >= 0 ? "#2D5016" : "#DC2626" }}
                  >
                    {formatWon(m.net_profit)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report downloads */}
      <div
        className="rounded-2xl p-6"
        style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
      >
        <p className="text-xs font-semibold mb-4" style={{ color: "#9B9B9B" }}>
          리포트 다운로드
        </p>
        <div className="space-y-2">
          <a
            href={getMonthlyPdfUrl(thisYear, thisMonth)}
            target="_blank"
            className="block w-full py-3 rounded-xl font-bold text-center text-sm"
            style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
          >
            &#128202; {thisMonth}월 월간 리포트 (PDF)
          </a>
          {thisMonth > 1 && (
            <a
              href={getMonthlyPdfUrl(thisYear, thisMonth - 1)}
              target="_blank"
              className="block w-full py-3 rounded-xl font-bold text-center text-sm"
              style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
            >
              &#128202; {thisMonth - 1}월 월간 리포트 (PDF)
            </a>
          )}
        </div>
      </div>

      {/* AI insight placeholder */}
      <div
        className="rounded-2xl p-6"
        style={{ backgroundColor: "#EDF4E8", border: "1px solid #C5DEB5" }}
      >
        <p className="text-xs font-semibold mb-2" style={{ color: "#2D5016" }}>
          AI 인사이트 (준비 중)
        </p>
        <p className="text-sm" style={{ color: "#4A7C2E" }}>
          데이터가 더 쌓이면 AI가 맞춤 경영 제안을 드립니다.
          매출 예측, 비용 절감 포인트, 고객 재구매 알림 등을 제공할 예정입니다.
        </p>
      </div>
    </div>
  );
}
