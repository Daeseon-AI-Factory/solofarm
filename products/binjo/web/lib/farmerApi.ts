/**
 * Farmer API client — talks to the FastAPI backend.
 *
 * All requests include the JWT token from localStorage.
 * The base URL switches between local dev and production.
 */

// In dev, use Next.js rewrite proxy (/backend/*) to avoid CORS.
// In production, call the API directly.
const API_BASE =
  process.env.NODE_ENV === "production"
    ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002")
    : "/backend";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("farmer_token");
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const url = `${API_BASE}/api/v1${path}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData — browser sets it with boundary
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  console.log(`[farmerApi] ${options.method || "GET"} ${url}`);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    // Network error — backend is down or CORS blocked
    const message = err instanceof Error ? err.message : "알 수 없는 네트워크 오류";
    console.error(`[farmerApi] NETWORK ERROR: ${options.method || "GET"} ${url}`, err);
    throw new Error(`서버 연결 실패 (${API_BASE}): ${message}`);
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.error(`[farmerApi] HTTP ${res.status}: ${options.method || "GET"} ${url}`, errorBody);
    try {
      const error = JSON.parse(errorBody);
      throw new Error(error.error?.message || error.detail?.message || error.detail || `HTTP ${res.status}`);
    } catch (parseErr) {
      if (parseErr instanceof SyntaxError) {
        throw new Error(`서버 오류 (HTTP ${res.status}): ${errorBody.slice(0, 200)}`);
      }
      throw parseErr;
    }
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Auth ---

export async function getKakaoLoginUrl(): Promise<string> {
  const data = await apiFetch<{ login_url: string }>("/auth/kakao/login");
  return data.login_url;
}

export async function loginWithKakao(code: string): Promise<string> {
  const data = await apiFetch<{ access_token: string }>("/auth/kakao", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  localStorage.setItem("farmer_token", data.access_token);
  return data.access_token;
}

export async function getMyProfile(): Promise<{
  id: string;
  nickname: string | null;
  profile_image_url: string | null;
  role: string;
}> {
  return apiFetch("/auth/me");
}

export function logout(): void {
  localStorage.removeItem("farmer_token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// --- Voice ---

export async function uploadVoice(audioBlob: Blob): Promise<{
  id: string;
  status: string;
  message: string;
}> {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  return apiFetch("/voice/upload", {
    method: "POST",
    body: formData,
  });
}

export async function getVoiceResult(id: string): Promise<{
  id: string;
  status: string;
  transcript: string | null;
  parsed_data: ParsedFarmLog | null;
  created_at: string;
}> {
  return apiFetch(`/voice/${id}/result`);
}

// --- Farm Logs ---

export interface ParsedFarmLog {
  date: string;
  field_names: string[];
  crop: string;
  tasks: { stage: string; detail: string | null; duration_hours: number | null }[];
  chemicals: { type: string; name: string; amount: string | null; action: string }[];
  weather_farmer: string | null;
  notes: string | null;
}

export interface FarmLog {
  id: string;
  log_date: string;
  status: string;
  crop: string;
  tasks: { id: string; field_name: string | null; stage: string; detail: string | null; duration_hours: number | null }[];
  chemicals: { id: string; type: string; name: string; amount: string | null; action: string }[];
  weather_official: Record<string, unknown> | null;
  weather_farmer: string | null;
  notes: string | null;
  photo_urls: string[];
  created_at: string;
  updated_at: string;
}

export async function createFarmLog(data: {
  voice_recording_id?: string;
  log_date: string;
  crop?: string;
  tasks: { field_name?: string; stage: string; detail?: string; duration_hours?: number }[];
  chemicals?: { type: string; name: string; amount?: string; action?: string }[];
  weather_farmer?: string;
  notes?: string;
}): Promise<FarmLog> {
  return apiFetch("/farm-logs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listFarmLogs(dateFrom?: string, dateTo?: string): Promise<{
  logs: FarmLog[];
  total: number;
}> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  return apiFetch(`/farm-logs${qs ? `?${qs}` : ""}`);
}

export async function confirmFarmLog(id: string): Promise<FarmLog> {
  return apiFetch(`/farm-logs/${id}/confirm`, { method: "PUT" });
}

export async function deleteFarmLog(id: string): Promise<void> {
  return apiFetch(`/farm-logs/${id}`, { method: "DELETE" });
}

export async function uploadFarmLogPhotos(
  logId: string,
  photos: File[]
): Promise<{ photo_urls: string[]; message: string }> {
  const formData = new FormData();
  for (const photo of photos) {
    formData.append("files", photo);
  }
  return apiFetch(`/farm-logs/${logId}/photos`, {
    method: "POST",
    body: formData,
  });
}

export async function deleteFarmLogPhoto(
  logId: string,
  photoUrl: string
): Promise<{ photo_urls: string[]; message: string }> {
  const params = new URLSearchParams({ photo_url: photoUrl });
  return apiFetch(`/farm-logs/${logId}/photos?${params}`, {
    method: "DELETE",
  });
}

// --- Fields (필지) ---

export interface Field {
  id: string;
  name: string;
  area_pyeong: number | null;
  crop: string;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export async function listFields(): Promise<Field[]> {
  return apiFetch("/fields");
}

export async function createField(data: {
  name: string;
  area_pyeong?: number;
  crop?: string;
  address?: string;
  notes?: string;
}): Promise<Field> {
  return apiFetch("/fields", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Pesticides (농약 안전사용기준) ---

export interface PesticideInfo {
  id: string;
  name_kr: string;
  name_en: string;
  type: string;
  safety_days: number;
  dilution_ratio: string;
  target: string[];
  season: string[];
  notes: string;
}

export interface SafeHarvestResult {
  pesticide: string;
  safety_days: number;
  spray_date: string;
  safe_harvest_date: string;
  days_remaining: number;
  is_safe: boolean;
}

export async function listPesticides(): Promise<PesticideInfo[]> {
  return apiFetch("/pesticides/");
}

export async function lookupPesticide(name: string): Promise<PesticideInfo> {
  return apiFetch(`/pesticides/lookup?name=${encodeURIComponent(name)}`);
}

export async function checkSafeHarvest(
  sprayDate: string,
  pesticideName: string
): Promise<SafeHarvestResult> {
  return apiFetch(
    `/pesticides/safe-harvest?spray_date=${sprayDate}&pesticide_name=${encodeURIComponent(pesticideName)}`
  );
}

// --- Weather ---

export interface WeatherData {
  temperature: number | null;
  humidity: number | null;
  precipitation: string | null;
  wind_speed: number | null;
  sky: string | null;
  summary: string | null;
}

export async function getCurrentWeather(): Promise<WeatherData> {
  return apiFetch("/weather/current");
}

// --- Export ---

export function getExportUrl(dateFrom: string, dateTo: string): string {
  const token = getToken();
  return `${API_BASE}/api/v1/export/farm-diary?date_from=${dateFrom}&date_to=${dateTo}&token=${token}`;
}

// --- Transactions (Phase 3) ---

export interface Transaction {
  id: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  description: string | null;
  counterparty: string | null;
  transaction_date: string;
  source: string;
  source_id: string | null;
  farm_log_id: string | null;
  status: string;
  confidence: number | null;
  receipt_image_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function listTransactions(params?: {
  date_from?: string;
  date_to?: string;
  type?: string;
  category?: string;
  status?: string;
}): Promise<{ transactions: Transaction[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.date_from) qs.set("date_from", params.date_from);
  if (params?.date_to) qs.set("date_to", params.date_to);
  if (params?.type) qs.set("type", params.type);
  if (params?.category) qs.set("category", params.category);
  if (params?.status) qs.set("status", params.status);
  const q = qs.toString();
  return apiFetch(`/transactions${q ? `?${q}` : ""}`);
}

export async function createTransaction(data: {
  type: string;
  category: string;
  amount: number;
  description?: string;
  counterparty?: string;
  transaction_date: string;
  source?: string;
  notes?: string;
}): Promise<Transaction> {
  return apiFetch("/transactions", {
    method: "POST",
    body: JSON.stringify({ source: "manual", ...data }),
  });
}

export async function updateTransaction(
  id: string,
  data: Partial<{
    type: string;
    category: string;
    amount: number;
    description: string;
    counterparty: string;
    transaction_date: string;
    notes: string;
  }>
): Promise<Transaction> {
  return apiFetch(`/transactions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function confirmTransaction(id: string): Promise<Transaction> {
  return apiFetch(`/transactions/${id}/confirm`, { method: "PUT" });
}

export async function deleteTransaction(id: string): Promise<void> {
  return apiFetch(`/transactions/${id}`, { method: "DELETE" });
}

// --- Receipts (Phase 3) ---

export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: string;
  confidence: number;
}

export interface ParsedReceiptData {
  store_name: string | null;
  store_type: string | null;
  date: string | null;
  items: ParsedReceiptItem[];
  total_amount: number;
  payment_method: string | null;
  overall_confidence: number;
}

export interface ReceiptResult {
  receipt_scan_id: string;
  status: string;
  parsed_data: ParsedReceiptData | null;
  transaction_ids: string[];
  created_at: string;
  processed_at: string | null;
}

export async function uploadReceipt(imageFile: File): Promise<{
  receipt_scan_id: string;
  status: string;
  message: string;
}> {
  const formData = new FormData();
  formData.append("file", imageFile);
  return apiFetch("/receipts/upload", {
    method: "POST",
    body: formData,
  });
}

export async function getReceiptStatus(scanId: string): Promise<{
  receipt_scan_id: string;
  status: string;
  error_message: string | null;
}> {
  return apiFetch(`/receipts/${scanId}/status`);
}

export async function getReceiptResult(scanId: string): Promise<ReceiptResult> {
  return apiFetch(`/receipts/${scanId}/result`);
}

// --- Financial Reports (Phase 3) ---

export interface MonthlySummary {
  year: number;
  month: number;
  total_income: number;
  total_expense: number;
  net_profit: number;
  income_by_category: Record<string, number>;
  expense_by_category: Record<string, number>;
  status: string;
  report_pdf_url: string | null;
}

export interface MonthlyTrend {
  year: number;
  month: number;
  total_income: number;
  total_expense: number;
  net_profit: number;
}

export interface DashboardData {
  current_month: MonthlySummary;
  trend: MonthlyTrend[];
  recent_transactions: Transaction[];
}

export async function getFinancialDashboard(): Promise<DashboardData> {
  return apiFetch("/reports/dashboard");
}

export async function getMonthlyReport(
  year: number,
  month: number
): Promise<MonthlySummary> {
  return apiFetch(`/reports/monthly?year=${year}&month=${month}`);
}

export function getMonthlyPdfUrl(year: number, month: number): string {
  const token = getToken();
  return `${API_BASE}/api/v1/reports/monthly/pdf?year=${year}&month=${month}&token=${token}`;
}

// --- Orders (Phase 3-4) ---

export interface SalesOrder {
  id: string;
  channel: string;
  customer_name: string | null;
  customer_phone: string | null;
  product_name: string | null;
  quantity: number;
  weight_option: string | null;
  unit_price: number | null;
  total_amount: number | null;
  status: string;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function listAdminOrders(params?: {
  status?: string;
  channel?: string;
}): Promise<SalesOrder[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.channel) qs.set("channel", params.channel);
  const q = qs.toString();
  return apiFetch(`/admin/orders${q ? `?${q}` : ""}`);
}

export async function confirmOrder(id: string): Promise<SalesOrder> {
  return apiFetch(`/admin/orders/${id}/confirm`, { method: "PUT" });
}

export async function shipOrder(
  id: string,
  carrier: string,
  trackingNumber: string
): Promise<SalesOrder> {
  return apiFetch(
    `/admin/orders/${id}/ship?carrier=${encodeURIComponent(carrier)}&tracking_number=${encodeURIComponent(trackingNumber)}`,
    { method: "PUT" }
  );
}

export async function deliverOrder(id: string): Promise<SalesOrder> {
  return apiFetch(`/admin/orders/${id}/deliver`, { method: "PUT" });
}

export async function cancelOrder(
  id: string,
  reason?: string
): Promise<SalesOrder> {
  const qs = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  return apiFetch(`/admin/orders/${id}/cancel${qs}`, { method: "PUT" });
}

// --- Customers (Phase 4) ---

export interface Customer {
  id: string;
  phone: string;
  name: string | null;
  address: string | null;
  total_orders: number;
  total_spent: number;
  first_order_at: string | null;
  last_order_at: string | null;
  preferred_products: string[];
  notes: string | null;
  created_at: string;
}

export async function listCustomers(): Promise<{
  customers: Customer[];
  total: number;
}> {
  return apiFetch("/admin/orders/customers");
}

// --- Public Checkout (Phase 4, no auth) ---

const PUBLIC_API = API_BASE;

export async function publicCheckout(data: {
  product_name: string;
  product_id?: string;
  quantity: number;
  weight_option?: string;
  unit_price: number;
  total_amount: number;
  recipient_name: string;
  recipient_phone: string;
  postal_code?: string;
  address: string;
  address_detail?: string;
  delivery_message?: string;
}): Promise<{
  order_id: string;
  toss_order_id: string;
  amount: number;
  product_name: string;
}> {
  const res = await fetch(`${PUBLIC_API}/api/v1/payments/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail?.message || `결제 준비 실패 (HTTP ${res.status})`);
  }
  return res.json();
}

export async function publicConfirmPayment(data: {
  payment_key: string;
  order_id: string;
  amount: number;
}): Promise<{
  id: string;
  order_id: string;
  toss_order_id: string;
  amount: number;
  status: string;
}> {
  const res = await fetch(`${PUBLIC_API}/api/v1/payments/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail?.message || `결제 확인 실패 (HTTP ${res.status})`);
  }
  return res.json();
}

export async function publicGetOrderStatus(orderId: string): Promise<{
  order_id: string;
  status: string;
  product_name: string | null;
  total_amount: number | null;
  payment_status: string | null;
  tracking_number: string | null;
  carrier: string | null;
  created_at: string;
}> {
  const res = await fetch(
    `${PUBLIC_API}/api/v1/payments/orders/${orderId}/status`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail?.message || `주문 조회 실패`);
  }
  return res.json();
}
