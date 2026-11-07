import { createClient } from "@supabase/supabase-js";
import { formatPromoActiveAt } from "./dateTime";
import { readEmailConfirmation, confirmEmailReturn } from "./emailConfirmation";
// Capture the result before Supabase consumes a successful confirmation hash.
const emailCallback = readEmailConfirmation(window.location.href);
export const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const supabase = configured
  ? createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    )
  : null;
export const emailConfirmation = confirmEmailReturn(
  supabase?.auth,
  emailCallback,
).finally(() => {
  if (emailCallback) {
    history.replaceState(
      history.state,
      "",
      location.pathname + location.search,
    );
  }
});
export const sampleBags = [
  [
    "day-tote",
    "The Day Tote",
    "Effortless and refined, with a relaxed silhouette for wherever the day leads.",
  ],
  [
    "signature",
    "The Signature",
    "Polished, versatile, and quietly distinctive — a forever favorite.",
  ],
  [
    "shoulder",
    "The Shoulder",
    "A modern classic with everyday ease and enduring appeal.",
  ],
  [
    "woven",
    "The Woven",
    "Artisanal texture, everyday elegance, made for getting away and coming home.",
  ],
  ["mini", "The Mini", "Compact, considered, and always in good company."],
  [
    "essential",
    "The Essential",
    "Understated and versatile, for the moments that matter most.",
  ],
].map(([id, name, description], i) => ({
  id,
  name,
  description,
  image_url: `/images/${id}.webp`,
  price: null,
  display_order: i,
}));
export const sampleGifts = [
  {
    id: "watch",
    name: "Luxury Women's Watch",
    description: "A beautiful fashion watch designed to complement your style.",
    image_url: "/images/watch.webp",
    discount_percent: 0,
  },
  ...[5, 3, 2].map((n) => ({
    id: String(n),
    name: `${n}% Discount`,
    description:
      n === 5
        ? "Enjoy 5% off your next handbag purchase."
        : n === 3
          ? "Receive 3% off your next handbag purchase."
          : "Enjoy a special 2% discount on your next handbag purchase.",
    discount_percent: n,
  })),
];
export const defaultSettings = {
  business_name: "Goove",
  whatsapp_number: "17176554737",
  public_phone: "",
  public_email: "",
  social_links: [],
  promotion_mode: "hidden",
  promotion_enabled: false,
  legal_reviewed: false,
  hero_heading: "Elevate Your Elegance",
  hero_description: "Luxury Women's Handbags with Exclusive Matching Gift",
  hero_cta_text: "SHOP THE COLLECTION",
  hero_image_url: "/images/hero.webp",
  promo_banner_text: "Buy any bag and unlock a special Goove promo.",
};
export async function callApi(action, payload = {}) {
  if (!supabase)
    throw Error(
      "Reward registration is not open yet. Please contact our team for assistance.",
    );
  const { data, error } = await supabase.functions.invoke("goove-api", {
    body: { action, ...payload },
  });
  if (error) {
    let message;
    try {
      message = (await error.context.json()).error;
    } catch {}
    throw Error(
      message || "We could not complete your request. Please try again.",
    );
  }
  if (data?.error) throw Error(data.error);
  return data;
}
export async function loadCatalog() {
  if (supabase) return callApi("catalog");
  if (import.meta.env.DEV) {
    return {
      handbags: sampleBags,
      gifts: sampleGifts,
      settings: defaultSettings,
    };
  }
  throw Error(
    "The collection is temporarily unavailable. Please try again later.",
  );
}
export function whatsappUrl(number, name, code) {
  if (!/^\d{8,15}$/.test(number || "")) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(`Hello! My name is ${name}.\n\nI recently purchased a handbag from your collection.\n\nMy selected reward code is ${code}.\n\nI would like to submit my reward code for verification.\n\nThank you!`)}`;
}
export function whatsappBagUrl(number, name, itemUrl, imageUrl) {
  if (!/^\d{8,15}$/.test(number || "")) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(`Hello Goove! I would like to buy ${name}.\n\nSelected product: ${itemUrl}\n\nProduct photo: ${imageUrl}\n\nPlease let me know how to order. Thank you!`)}`;
}
export function whatsappPromoUrl(number, code, name, phone, selectedAt) {
  if (!/^\d{8,15}$/.test(number || "")) return null;
  const activeAt = formatPromoActiveAt(selectedAt);
  return `https://wa.me/${number}?text=${encodeURIComponent(`Hello Goove! I would like to use this promo code.\n\nName: ${name}\nPhone: ${phone}\nPromo code: ${code}\nActive date and time: ${activeAt}\n\nPlease help me redeem it. Thank you!`)}`;
}
