import type {
  CalendarMonth,
  FarmProfile,
  FarmStats,
  PriceOption,
  ProductItem,
} from "@/types";
import { isStoredLocalImageUrl } from "@/lib/imageUrl";

const PLACEHOLDER_PHONE = /^010[-\s]?0{4}[-\s]?0{4}$/;
const PLACEHOLDER_ADDRESS = /(?:\s|길|로)00(?:번지)?\s*$/;
const PLACEHOLDER_TEXT = /(xxxxx|example|\.\.\.|준비중)/i;

// These values ship with the repository for local development. They are useful
// as a demo, but they are not evidence about the real farm and must never be
// promoted into public claims just because the seed command was run.
const KNOWN_SEED_TAGLINE = "한 알 한 알, 정성으로 키웁니다";
const KNOWN_SEED_STORY =
  "경남 사천시 용치골에서 15년째 사과를 키우고 있습니다.\n\n농약을 최소화하고, 하나하나 손으로 돌보며 정성껏 재배한 사과입니다. 대형마트에서는 볼 수 없는, 농부가 직접 고른 최고의 사과를 보내드립니다.\n\n저희 농장의 사과는 향이 깊고 당도가 높아 한 번 드셔보신 분들이 해마다 다시 찾아주십니다. 가족이 먹는다는 마음으로 키웁니다.";
const KNOWN_SEED_STATS: Required<FarmStats> = {
  area: "3,000평",
  experience: "15년",
  varieties: "3종",
};

interface SeedProductSignature {
  shortDescription: string;
  harvestStartMonth: number;
  harvestEndMonth: number;
  priceOptions: PriceOption[];
}

const KNOWN_SEED_PRODUCTS: Record<string, SeedProductSignature> = {
  부사: {
    shortDescription: "아삭하고 달콤한 대표 품종",
    harvestStartMonth: 10,
    harvestEndMonth: 12,
    priceOptions: [
      { weight: "5kg (16-18과)", price: 35_000 },
      { weight: "10kg (32-36과)", price: 60_000 },
    ],
  },
  홍로: {
    shortDescription: "새콤달콤, 가을의 첫 맛",
    harvestStartMonth: 9,
    harvestEndMonth: 10,
    priceOptions: [
      { weight: "5kg", price: 30_000 },
      { weight: "10kg", price: 55_000 },
    ],
  },
  시나노골드: {
    shortDescription: "상큼한 황금빛 프리미엄 사과",
    harvestStartMonth: 10,
    harvestEndMonth: 11,
    priceOptions: [
      { weight: "3kg", price: 25_000 },
      { weight: "5kg", price: 40_000 },
    ],
  },
};

const KNOWN_SEED_CALENDAR: Record<
  number,
  Pick<CalendarMonth, "activities" | "available_products" | "highlight">
> = {
  1: { activities: ["전정 작업 시작"], available_products: [], highlight: "겨울 전정으로 내년 수확을 준비합니다" },
  2: { activities: ["전정 작업", "자재 준비"], available_products: [], highlight: "꼼꼼한 전정이 좋은 사과의 시작" },
  3: { activities: ["전정 마무리", "비료 시비"], available_products: [], highlight: "봄을 맞아 과수원에 영양을 줍니다" },
  4: { activities: ["꽃눈 관리", "서리 대비"], available_products: [], highlight: "사과꽃 피기 전 긴장의 시간" },
  5: { activities: ["사과꽃 개화", "인공수분", "적화"], available_products: [], highlight: "하얀 사과꽃이 과수원을 가득 채웁니다" },
  6: { activities: ["적과 작업", "병해충 관리"], available_products: [], highlight: "좋은 열매만 남기는 정성 적과" },
  7: { activities: ["봉지 씌우기", "관수 관리"], available_products: [], highlight: "한여름 더위 속 사과가 자라는 중" },
  8: { activities: ["봉지 벗기기", "착색 관리"], available_products: [], highlight: "사과가 빨갛게 물들기 시작합니다" },
  9: { activities: ["홍로 수확 시작", "선별 작업"], available_products: ["홍로"], highlight: "홍로 수확! 가을의 첫 사과" },
  10: { activities: ["부사·시나노골드 수확", "직거래 시작"], available_products: ["부사", "시나노골드"], highlight: "본격 수확! 주문 받습니다" },
  11: { activities: ["부사 후기 수확", "저장 작업"], available_products: ["부사"], highlight: "마지막 부사 수확, 서두르세요" },
  12: { activities: ["과수원 정리", "내년 계획"], available_products: [], highlight: "한 해를 마무리하며 감사합니다" },
};

export type PublicSalesMode = "direct" | "inquiry" | "preparing";

export interface PublicSalesReadiness {
  mode: PublicSalesMode;
  hasInquiryChannel: boolean;
  availableProductCount: number;
}

function safeHttpsUrl(
  value: string | null,
  allowedHosts: readonly string[]
): string | null {
  if (!value || PLACEHOLDER_TEXT.test(value)) return null;

  try {
    const url = new URL(value);
    const allowed = allowedHosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
    );
    return url.protocol === "https:" && allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

function safePhone(value: string | null): string | null {
  if (!value || PLACEHOLDER_PHONE.test(value) || PLACEHOLDER_TEXT.test(value)) {
    return null;
  }

  // Keep formatting for display/tel links, but reject values that cannot be a
  // Korean phone number instead of exposing an inert CTA.
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 11 ? value.trim() : null;
}

function safeAddress(value: string | null): string | null {
  if (!value || PLACEHOLDER_ADDRESS.test(value.trim()) || PLACEHOLDER_TEXT.test(value)) {
    return null;
  }
  return value.trim();
}

function safeImageUrl(value: string | null): string | null {
  if (!value || PLACEHOLDER_TEXT.test(value)) return null;
  if (isStoredLocalImageUrl(value)) return value;
  try {
    const url = new URL(value);
    const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (!configuredSupabaseUrl || url.protocol !== "https:") return null;

    const storageHost = new URL(configuredSupabaseUrl).hostname;
    return url.hostname === storageHost ? url.toString() : null;
  } catch {
    return null;
  }
}

function sanitizeSeedStats(stats: FarmStats | null): FarmStats | null {
  if (!stats) return null;

  const sanitized: FarmStats = {
    area: stats.area === KNOWN_SEED_STATS.area ? undefined : stats.area,
    experience:
      stats.experience === KNOWN_SEED_STATS.experience
        ? undefined
        : stats.experience,
    varieties:
      stats.varieties === KNOWN_SEED_STATS.varieties
        ? undefined
        : stats.varieties,
  };

  return sanitized.area || sanitized.experience || sanitized.varieties
    ? sanitized
    : null;
}

function priceOptionsMatch(
  actual: ProductItem["price_options"],
  expected: PriceOption[]
): boolean {
  return Boolean(
    actual &&
      actual.length === expected.length &&
      actual.every(
        (option, index) =>
          option.weight === expected[index].weight &&
          option.price === expected[index].price
      )
  );
}

function isKnownSeedProduct(product: ProductItem): boolean {
  const signature = KNOWN_SEED_PRODUCTS[product.name];
  if (!signature) return false;

  return (
    !product.image_url &&
    product.short_description === signature.shortDescription &&
    product.harvest_start_month === signature.harvestStartMonth &&
    product.harvest_end_month === signature.harvestEndMonth &&
    priceOptionsMatch(product.price_options, signature.priceOptions)
  );
}

function stringArraysMatch(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function isKnownSeedCalendarMonth(month: CalendarMonth): boolean {
  const signature = KNOWN_SEED_CALENDAR[month.month];
  if (!signature) return false;

  return (
    month.highlight === signature.highlight &&
    stringArraysMatch(month.activities, signature.activities) &&
    stringArraysMatch(
      month.available_products,
      signature.available_products
    )
  );
}

/**
 * Removes seed/example values before they can become public links or claims.
 * Admin data is left untouched so a real value can replace the placeholder.
 */
export function sanitizePublicFarmProfile(farm: FarmProfile): FarmProfile {
  const address = safeAddress(farm.address);
  const hasPlaceholderFullAddress = Boolean(farm.address && !address);
  const naverStoreUrl = safeHttpsUrl(farm.naver_store_url, [
    "smartstore.naver.com",
    "brand.naver.com",
  ]);

  return {
    ...farm,
    tagline: farm.tagline === KNOWN_SEED_TAGLINE ? null : farm.tagline,
    story: farm.story === KNOWN_SEED_STORY ? null : farm.story,
    phone: safePhone(farm.phone),
    kakao_chat_url: safeHttpsUrl(farm.kakao_chat_url, [
      "pf.kakao.com",
      "open.kakao.com",
    ]),
    // This is the repository's known seed URL, not a verified live store.
    naver_store_url:
      naverStoreUrl === "https://smartstore.naver.com/binjofarm"
        ? null
        : naverStoreUrl,
    youtube_url: safeHttpsUrl(farm.youtube_url, ["youtube.com", "youtu.be"]),
    address,
    // A short location derived from a placeholder full address must not make
    // that placeholder look verified on the hero section.
    address_short: hasPlaceholderFullAddress
      ? null
      : safeAddress(farm.address_short),
    hero_image_url: safeImageUrl(farm.hero_image_url),
    farmer_image_url: safeImageUrl(farm.farmer_image_url),
    stats: sanitizeSeedStats(farm.stats),
  };
}

export function isSafePublicImageUrl(value: string | null): value is string {
  return safeImageUrl(value) !== null;
}

/**
 * Keeps the public catalog closed until a seeded product has been replaced by
 * real farm content. Editing any meaningful catalog field or adding a real
 * image makes the product distinct from the repository demo.
 */
export function sanitizePublicProductItems(
  products: ProductItem[]
): ProductItem[] {
  return products
    .filter((product) => !isKnownSeedProduct(product))
    .map((product) => ({
      ...product,
      image_url: safeImageUrl(product.image_url),
    }));
}

/** Removes untouched demo months while preserving any month edited by admin. */
export function sanitizePublicCalendarMonths(
  calendar: CalendarMonth[]
): CalendarMonth[] {
  return calendar.filter((month) => !isKnownSeedCalendarMonth(month));
}

export function getPublicSalesReadiness(
  farm: FarmProfile,
  products: ProductItem[],
  directCheckoutEnabled: boolean
): PublicSalesReadiness {
  const hasInquiryChannel = Boolean(
    farm.kakao_chat_url || farm.phone || farm.naver_store_url
  );
  const availableProductCount = products.filter(
    (product) => product.is_available
  ).length;

  if (directCheckoutEnabled && availableProductCount > 0) {
    return { mode: "direct", hasInquiryChannel, availableProductCount };
  }

  if (hasInquiryChannel && availableProductCount > 0) {
    return { mode: "inquiry", hasInquiryChannel, availableProductCount };
  }

  return { mode: "preparing", hasInquiryChannel, availableProductCount };
}
