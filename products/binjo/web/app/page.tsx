import { prisma } from "@/lib/db";
import HeroSection from "@/components/brand/HeroSection";
import StorySection from "@/components/brand/StorySection";
import ProductsSection from "@/components/brand/ProductsSection";
import CalendarSection from "@/components/brand/CalendarSection";
import GallerySection from "@/components/brand/GallerySection";
import ReviewsSection from "@/components/brand/ReviewsSection";
import OrderSection from "@/components/brand/OrderSection";
import StickyOrderCTA from "@/components/brand/StickyOrderCTA";
import YoutubeSection from "@/components/brand/YoutubeSection";
import {
  getPublicSalesReadiness,
  isSafePublicImageUrl,
  sanitizePublicCalendarMonths,
  sanitizePublicFarmProfile,
  sanitizePublicProductItems,
} from "@/lib/publicFarmProfile";
import type {
  FarmProfile,
  GalleryPhotoItem,
  ProductItem,
  ReviewItem,
} from "@/types";

// The production image is built without database secrets. Fetch current farm
// data at request time after the runtime environment has been injected.
export const dynamic = "force-dynamic";

interface SectionConfig {
  id: string;
  label: string;
  visible: boolean;
  bgColor?: string;
  bgImage?: string;
}

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: "hero", label: "메인 배너", visible: true },
  { id: "products", label: "상품 소개", visible: true },
  { id: "story", label: "농장 이야기", visible: true },
  { id: "calendar", label: "제철 달력", visible: true },
  { id: "youtube", label: "유튜브 영상", visible: true },
  { id: "gallery", label: "사진 갤러리", visible: true },
  { id: "reviews", label: "고객 후기", visible: true },
  { id: "order", label: "주문/문의", visible: true },
];

async function getData() {
  const [farm, products, calendar, gallery, reviews] = await Promise.all([
    prisma.farm.findFirst(),
    prisma.product.findMany({ orderBy: { sort_order: "asc" } }),
    prisma.seasonalCalendar.findMany({ orderBy: { month: "asc" } }),
    prisma.galleryPhoto.findMany({ orderBy: { sort_order: "asc" } }),
    prisma.review.findMany({
      where: { is_visible: true },
      orderBy: { sort_order: "asc" },
    }),
  ]);
  return { farm, products, calendar, gallery, reviews };
}

export default async function BrandPage() {
  const { farm, products, calendar, gallery, reviews } = await getData();

  if (!farm) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFBF7" }}>
        <p style={{ color: "#66705F" }}>농장 페이지를 준비하고 있습니다.</p>
      </div>
    );
  }

  const farmProfile = sanitizePublicFarmProfile({
    ...farm,
    latitude: farm.latitude ? Number(farm.latitude) : null,
    longitude: farm.longitude ? Number(farm.longitude) : null,
    stats: farm.stats as FarmProfile["stats"],
  });

  // Direct checkout is externally dependent and therefore needs both a
  // build-time browser flag and a runtime server gate. A missing Toss key
  // always closes the workflow instead of falling back to a fake success.
  const directCheckoutEnabled =
    process.env.NEXT_PUBLIC_ENABLE_DIRECT_CHECKOUT === "true" &&
    process.env.ENABLE_DIRECT_CHECKOUT === "true" &&
    Boolean(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY?.trim());
  const productItems = sanitizePublicProductItems(
    products.map((p) => ({
      ...p,
      price_options: p.price_options as ProductItem["price_options"],
    }))
  );

  const calendarMonths = sanitizePublicCalendarMonths(
    calendar.map((c) => ({
      id: c.id,
      month: c.month,
      activities: c.activities,
      available_products: c.available_products,
      highlight: c.highlight,
    }))
  );

  const salesReadiness = getPublicSalesReadiness(
    farmProfile,
    productItems,
    directCheckoutEnabled
  );

  const galleryItems: GalleryPhotoItem[] = gallery
    .filter((g) => isSafePublicImageUrl(g.image_url))
    .map((g) => ({
      id: g.id,
      image_url: g.image_url,
      caption: g.caption,
      taken_at: g.taken_at ? g.taken_at.toISOString() : null,
      sort_order: g.sort_order,
    }));

  const reviewItems: ReviewItem[] = reviews.map((r) => ({
    id: r.id,
    customer_name: r.customer_name,
    customer_location: r.customer_location,
    content: r.content,
    rating: r.rating,
    sort_order: r.sort_order,
  }));

  // Read sections config from DB, fallback to defaults
  const sections: SectionConfig[] =
    farm.sections_config && Array.isArray(farm.sections_config)
      ? (farm.sections_config as unknown as SectionConfig[])
      : DEFAULT_SECTIONS;

  // Map section IDs to their React components
  const sectionComponents: Record<string, React.ReactNode> = {
    hero: (
      <HeroSection
        farm={farmProfile}
        salesMode={salesReadiness.mode}
      />
    ),
    story: <StorySection farm={farmProfile} />,
    products: (
      <ProductsSection
        products={productItems}
        directCheckoutEnabled={directCheckoutEnabled}
        salesMode={salesReadiness.mode}
      />
    ),
    calendar:
      calendarMonths.length > 0 ? (
        <CalendarSection calendar={calendarMonths} />
      ) : null,
    youtube: farmProfile.youtube_url ? (
      <YoutubeSection youtubeUrl={farmProfile.youtube_url} />
    ) : null,
    gallery: <GallerySection photos={galleryItems} />,
    reviews: <ReviewsSection reviews={reviewItems} />,
    order: (
      <OrderSection
        farm={farmProfile}
        products={productItems}
        directCheckoutEnabled={directCheckoutEnabled}
        salesMode={salesReadiness.mode}
      />
    ),
  };

  return (
    <main>
      {sections
        .filter((s) => s.visible)
        .map((s) => {
          const sectionComponent = sectionComponents[s.id];
          if (!sectionComponent) return null;

          const safeBackgroundImage = isSafePublicImageUrl(s.bgImage ?? null)
            ? s.bgImage
            : null;
          const hasCustomBg = !!(s.bgColor || safeBackgroundImage);
          return (
            <div
              key={s.id}
              style={{
                // Custom background from admin layout editor
                ...(s.bgColor ? { backgroundColor: s.bgColor } : {}),
                ...(safeBackgroundImage
                  ? {
                      backgroundImage: `url(${safeBackgroundImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : {}),
              }}
              // Force child section to be transparent so the wrapper's bg shows through
              className={hasCustomBg ? "custom-bg-wrapper" : ""}
            >
              {sectionComponent}
            </div>
          );
        })}
      <StickyOrderCTA
        kakaoUrl={farmProfile.kakao_chat_url}
        phone={farmProfile.phone}
        salesMode={salesReadiness.mode}
      />
    </main>
  );
}
