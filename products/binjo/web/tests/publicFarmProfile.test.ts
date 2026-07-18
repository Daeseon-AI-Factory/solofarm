import assert from "node:assert/strict";
import test from "node:test";
import {
  getPublicSalesReadiness,
  sanitizePublicCalendarMonths,
  sanitizePublicFarmProfile,
  sanitizePublicProductItems,
} from "../lib/publicFarmProfile";
import type { CalendarMonth, FarmProfile, ProductItem } from "../types";

function farmProfile(overrides: Partial<FarmProfile> = {}): FarmProfile {
  return {
    id: "farm-1",
    name: "빈조농장",
    name_en: null,
    tagline: null,
    story: null,
    phone: null,
    kakao_chat_url: null,
    naver_store_url: null,
    youtube_url: null,
    address: null,
    address_short: null,
    latitude: null,
    longitude: null,
    hero_image_url: null,
    farmer_image_url: null,
    stats: null,
    ...overrides,
  };
}

test("public profile removes seed contacts and unsafe external images", () => {
  const sanitized = sanitizePublicFarmProfile(
    farmProfile({
      tagline: "한 알 한 알, 정성으로 키웁니다",
      story:
        "경남 사천시 용치골에서 15년째 사과를 키우고 있습니다.\n\n농약을 최소화하고, 하나하나 손으로 돌보며 정성껏 재배한 사과입니다. 대형마트에서는 볼 수 없는, 농부가 직접 고른 최고의 사과를 보내드립니다.\n\n저희 농장의 사과는 향이 깊고 당도가 높아 한 번 드셔보신 분들이 해마다 다시 찾아주십니다. 가족이 먹는다는 마음으로 키웁니다.",
      phone: "010-0000-0000",
      kakao_chat_url: "https://pf.kakao.com/_xxxxx/chat",
      naver_store_url: "https://smartstore.naver.com/binjofarm",
      address: "경상남도 사천시 용현면 용치골길 00",
      address_short: "경남 사천시 용치골",
      hero_image_url: `/uploads/${"a".repeat(32)}.jpg`,
      farmer_image_url: "https://cdn.example.com/farmer.jpg",
      stats: { area: "3,000평", experience: "15년", varieties: "3종" },
    })
  );

  assert.equal(sanitized.tagline, null);
  assert.equal(sanitized.story, null);
  assert.equal(sanitized.phone, null);
  assert.equal(sanitized.kakao_chat_url, null);
  assert.equal(sanitized.naver_store_url, null);
  assert.equal(sanitized.address, null);
  assert.equal(sanitized.address_short, null);
  assert.equal(sanitized.hero_image_url, `/uploads/${"a".repeat(32)}.jpg`);
  assert.equal(sanitized.farmer_image_url, null);
  assert.equal(sanitized.stats, null);
});

test("public profile preserves real verified-looking content", () => {
  const sanitized = sanitizePublicFarmProfile(
    farmProfile({
      tagline: "오늘 수확한 사과를 농장에서 보냅니다",
      story: "농장주가 직접 확인한 실제 농장 이야기입니다.",
      phone: "055-123-4567",
      kakao_chat_url: "https://pf.kakao.com/_realFarm/chat",
      address: "경상남도 사천시 실제로 12",
      address_short: "경남 사천시",
      stats: { area: "2,400평", experience: "12년" },
    })
  );

  assert.equal(sanitized.tagline, "오늘 수확한 사과를 농장에서 보냅니다");
  assert.equal(sanitized.story, "농장주가 직접 확인한 실제 농장 이야기입니다.");
  assert.equal(sanitized.phone, "055-123-4567");
  assert.equal(sanitized.kakao_chat_url, "https://pf.kakao.com/_realFarm/chat");
  assert.equal(sanitized.address, "경상남도 사천시 실제로 12");
  assert.deepEqual(sanitized.stats, {
    area: "2,400평",
    experience: "12년",
    varieties: undefined,
  });
});

function product(overrides: Partial<ProductItem> = {}): ProductItem {
  return {
    id: "product-1",
    name: "부사",
    name_en: "Fuji",
    description: "개발용 상품 설명",
    short_description: "아삭하고 달콤한 대표 품종",
    harvest_start_month: 10,
    harvest_end_month: 12,
    is_available: true,
    price_options: [
      { weight: "5kg (16-18과)", price: 35_000 },
      { weight: "10kg (32-36과)", price: 60_000 },
    ],
    image_url: null,
    sort_order: 1,
    ...overrides,
  };
}

test("public catalog hides untouched seed products and keeps edited products", () => {
  const sanitized = sanitizePublicProductItems([
    product(),
    product({
      id: "product-2",
      short_description: "올해 농장에서 확인한 부사",
      image_url: "http://unsafe.example/apple.jpg",
    }),
  ]);

  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].id, "product-2");
  assert.equal(sanitized[0].image_url, null);
});

test("public calendar hides untouched seed months and keeps edited farm news", () => {
  const seededJuly: CalendarMonth = {
    id: "july",
    month: 7,
    activities: ["봉지 씌우기", "관수 관리"],
    available_products: [],
    highlight: "한여름 더위 속 사과가 자라는 중",
  };
  const editedJuly = {
    ...seededJuly,
    id: "edited-july",
    highlight: "오늘 농장에서 확인한 관수 작업",
  };

  assert.deepEqual(sanitizePublicCalendarMonths([seededJuly, editedJuly]), [
    editedJuly,
  ]);
});

test("sales readiness opens only when a real product and order path exist", () => {
  const realProduct = product({
    short_description: "올해 농장에서 확인한 부사",
  });

  assert.equal(
    getPublicSalesReadiness(farmProfile(), [realProduct], false).mode,
    "preparing"
  );
  assert.equal(
    getPublicSalesReadiness(
      farmProfile({ phone: "055-123-4567" }),
      [realProduct],
      false
    ).mode,
    "inquiry"
  );
  assert.equal(
    getPublicSalesReadiness(farmProfile(), [realProduct], true).mode,
    "direct"
  );
  assert.equal(
    getPublicSalesReadiness(
      farmProfile({ phone: "055-123-4567" }),
      [],
      false
    ).mode,
    "preparing"
  );
});
