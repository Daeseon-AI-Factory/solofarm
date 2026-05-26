import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding 빈조농장 data...");

  const farm = await prisma.farm.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "빈조농장",
      name_en: "Binjo Farm",
      tagline: "한 알 한 알, 정성으로 키웁니다",
      story:
        "경남 사천시 용치골에서 15년째 사과를 키우고 있습니다.\n\n농약을 최소화하고, 하나하나 손으로 돌보며 정성껏 재배한 사과입니다. 대형마트에서는 볼 수 없는, 농부가 직접 고른 최고의 사과를 보내드립니다.\n\n저희 농장의 사과는 향이 깊고 당도가 높아 한 번 드셔보신 분들이 해마다 다시 찾아주십니다. 가족이 먹는다는 마음으로 키웁니다.",
      phone: "010-0000-0000",
      kakao_chat_url: "https://pf.kakao.com/_xxxxx/chat",
      naver_store_url: "https://smartstore.naver.com/binjofarm",
      address: "경상남도 사천시 용현면 용치골길 00",
      address_short: "경남 사천시 용치골",
      stats: {
        area: "3,000평",
        experience: "15년",
        varieties: "3종",
      },
    },
  });

  console.log("Farm created:", farm.id);

  // Products
  const products = [
    {
      name: "부사",
      name_en: "Fuji",
      short_description: "아삭하고 달콤한 대표 품종",
      description:
        "부사(후지)는 사과의 대명사입니다. 아삭한 식감과 높은 당도, 풍부한 향이 특징으로 오래 두어도 맛이 변하지 않아 선물용으로도 인기가 높습니다. 빈조농장의 부사는 10월 말부터 수확하여 직접 선별 포장해드립니다.",
      harvest_start_month: 10,
      harvest_end_month: 12,
      is_available: true,
      price_options: [
        { weight: "5kg (16-18과)", price: 35000 },
        { weight: "10kg (32-36과)", price: 60000 },
      ],
      sort_order: 1,
    },
    {
      name: "홍로",
      name_en: "Hongro",
      short_description: "새콤달콤, 가을의 첫 맛",
      description:
        "홍로는 가을 사과 중 가장 먼저 수확되는 조생종입니다. 선명한 붉은색과 새콤달콤한 맛이 특징으로, 사과 특유의 향이 진합니다. 9월 중순부터 한정 수확되어 수량이 많지 않습니다.",
      harvest_start_month: 9,
      harvest_end_month: 10,
      is_available: false,
      price_options: [
        { weight: "5kg", price: 30000 },
        { weight: "10kg", price: 55000 },
      ],
      sort_order: 2,
    },
    {
      name: "시나노골드",
      name_en: "Shinano Gold",
      short_description: "상큼한 황금빛 프리미엄 사과",
      description:
        "시나노골드는 황금빛 외관의 프리미엄 품종입니다. 상큼하고 산뜻한 맛과 아삭한 식감이 특징으로, 일본에서 개발된 품종이지만 사천의 기후에서 최상의 맛을 냅니다. 선물용으로 특히 인기 있습니다.",
      harvest_start_month: 10,
      harvest_end_month: 11,
      is_available: false,
      price_options: [
        { weight: "3kg", price: 25000 },
        { weight: "5kg", price: 40000 },
      ],
      sort_order: 3,
    },
  ];

  for (const p of products) {
    await prisma.product.create({
      data: { ...p, farm_id: farm.id },
    });
  }

  console.log("Products created:", products.length);

  // Seasonal calendar
  const calendar = [
    {
      month: 1,
      activities: ["전정 작업 시작"],
      available_products: [],
      highlight: "겨울 전정으로 내년 수확을 준비합니다",
    },
    {
      month: 2,
      activities: ["전정 작업", "자재 준비"],
      available_products: [],
      highlight: "꼼꼼한 전정이 좋은 사과의 시작",
    },
    {
      month: 3,
      activities: ["전정 마무리", "비료 시비"],
      available_products: [],
      highlight: "봄을 맞아 과수원에 영양을 줍니다",
    },
    {
      month: 4,
      activities: ["꽃눈 관리", "서리 대비"],
      available_products: [],
      highlight: "사과꽃 피기 전 긴장의 시간",
    },
    {
      month: 5,
      activities: ["사과꽃 개화", "인공수분", "적화"],
      available_products: [],
      highlight: "하얀 사과꽃이 과수원을 가득 채웁니다",
    },
    {
      month: 6,
      activities: ["적과 작업", "병해충 관리"],
      available_products: [],
      highlight: "좋은 열매만 남기는 정성 적과",
    },
    {
      month: 7,
      activities: ["봉지 씌우기", "관수 관리"],
      available_products: [],
      highlight: "한여름 더위 속 사과가 자라는 중",
    },
    {
      month: 8,
      activities: ["봉지 벗기기", "착색 관리"],
      available_products: [],
      highlight: "사과가 빨갛게 물들기 시작합니다",
    },
    {
      month: 9,
      activities: ["홍로 수확 시작", "선별 작업"],
      available_products: ["홍로"],
      highlight: "홍로 수확! 가을의 첫 사과",
    },
    {
      month: 10,
      activities: ["부사·시나노골드 수확", "직거래 시작"],
      available_products: ["부사", "시나노골드"],
      highlight: "본격 수확! 주문 받습니다",
    },
    {
      month: 11,
      activities: ["부사 후기 수확", "저장 작업"],
      available_products: ["부사"],
      highlight: "마지막 부사 수확, 서두르세요",
    },
    {
      month: 12,
      activities: ["과수원 정리", "내년 계획"],
      available_products: [],
      highlight: "한 해를 마무리하며 감사합니다",
    },
  ];

  for (const entry of calendar) {
    await prisma.seasonalCalendar.create({
      data: { ...entry, farm_id: farm.id },
    });
  }

  console.log("Seasonal calendar created: 12 months");
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
