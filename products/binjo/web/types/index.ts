export interface FarmProfile {
  id: string;
  name: string;
  name_en: string | null;
  tagline: string | null;
  story: string | null;
  phone: string | null;
  kakao_chat_url: string | null;
  naver_store_url: string | null;
  youtube_url: string | null;
  address: string | null;
  address_short: string | null;
  latitude: number | null;
  longitude: number | null;
  hero_image_url: string | null;
  farmer_image_url: string | null;
  stats: FarmStats | null;
}

export interface FarmStats {
  area?: string;
  experience?: string;
  varieties?: string;
}

export interface PriceOption {
  weight: string;
  price: number;
}

export interface ProductItem {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  short_description: string | null;
  harvest_start_month: number | null;
  harvest_end_month: number | null;
  is_available: boolean;
  price_options: PriceOption[] | null;
  image_url: string | null;
  sort_order: number;
}

export interface CalendarMonth {
  id: string;
  month: number;
  activities: string[];
  available_products: string[];
  highlight: string | null;
}

export interface GalleryPhotoItem {
  id: string;
  image_url: string;
  caption: string | null;
  taken_at: string | null;
  sort_order: number;
}

export interface ReviewItem {
  id: string;
  customer_name: string | null;
  customer_location: string | null;
  content: string;
  rating: number;
  sort_order: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
