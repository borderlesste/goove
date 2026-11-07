import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { HttpError, readJsonBody } from "../_shared/http.ts";
import { authorizeOwner } from "../_shared/owner.ts";
const url = Deno.env.get("SUPABASE_URL")!;
const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const unwrap = ({ data, error }: any) => {
  if (error) throw Error(error.message);
  return data;
};
const sha = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const randomCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
const text = (v: unknown, max = 100) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const uuid = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
async function settings() {
  return unwrap(
    await db.from("goove_settings").select("*").eq("id", true).single(),
  );
}
async function withImages(rows: any[], table: string, foreignKey: string) {
  if (!rows.length) return rows;
  const images = unwrap(
    await (db as any)
      .from(table)
      .select(`${foreignKey},image_url,display_order`)
      .in(
        foreignKey,
        rows.map((r) => r.id),
      )
      .order("display_order"),
  );
  const byItem = new Map<string, string[]>();
  for (const image of images) {
    const list = byItem.get(image[foreignKey]) || [];
    list.push(image.image_url);
    byItem.set(image[foreignKey], list);
  }
  return rows.map((r) => ({
    ...r,
    gallery_images: byItem.get(r.id) || (r.image_url ? [r.image_url] : []),
  }));
}
async function allClaims() {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const page = unwrap(
      await db
        .from("reward_claims")
        .select("*")
        .order("selected_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + 499),
    );
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows.map((c: any) => ({
    ...c,
    code: c.selected_code,
    benefit: c.benefit_name,
    status:
      c.status === "verified" &&
      c.expires_at &&
      new Date(c.expires_at) < new Date()
        ? "expired"
        : c.status,
  }));
}
async function owner(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
  if (!token) throw new HttpError(401, "Owner sign-in is required.");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Please sign in again.");
  return authorizeOwner(db, data.user);
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return reply({ error: "Method not allowed." }, 405);
  try {
    const body = await readJsonBody(req);
    const action = body.action;
    if (action === "catalog") {
      const [handbags, gifts, s] = await Promise.all([
        db.from("handbags").select("*").order("display_order"),
        db
          .from("gift_types")
          .select("*")
          .eq("active", true)
          .order("discount_percent"),
        settings(),
      ]);
      return reply({
        handbags: await withImages(
          unwrap(handbags),
          "handbag_images",
          "handbag_id",
        ),
        gifts: await withImages(
          unwrap(gifts),
          "gift_type_images",
          "gift_type_id",
        ),
        settings: {
          business_name: s.business_name,
          whatsapp_number: s.whatsapp_number,
          public_phone: s.public_phone,
          public_email: s.public_email,
          social_links: s.social_links,
          promotion_mode: s.promotion_mode,
          promotion_enabled: s.promotion_enabled,
          hero_heading: s.hero_heading,
          hero_description: s.hero_description,
          hero_cta_text: s.hero_cta_text,
          hero_image_url: s.hero_image_url,
          promo_banner_text: s.promo_banner_text,
        },
      });
    }
    if (["verify", "reserve"].includes(action)) {
      const access = text(body.access_code, 100).toUpperCase();
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const allowed = unwrap(
        await db.rpc("goove_rate_limit", { p_key: await sha("ip:" + ip) }),
      );
      if (!allowed)
        return reply(
          { error: "Too many attempts. Please try again in five minutes." },
          429,
        );
      if (!/^GOOVE-[A-F0-9]{48}$/.test(access))
        return reply({ error: "This access code is invalid or expired." }, 400);
      if (action === "reserve" && !uuid(body.reward_code_id))
        return reply({ error: "Choose a valid reward code." }, 400);
      return reply(
        unwrap(
          await db.rpc("goove_reward", {
            p_action: action,
            p_hash: await sha(access),
            p_reward_id: action === "reserve" ? body.reward_code_id : null,
            p_name:
              typeof body.customer_name === "string"
                ? body.customer_name
                : null,
            p_reference:
              typeof body.purchase_reference === "string"
                ? body.purchase_reference
                : null,
          }),
        ),
      );
    }
    await owner(req); // Every remaining action requires a live Auth user and database allowlist.
    if (action === "admin_list") {
      const [handbags, gifts, codes, access, s, claims] = await Promise.all([
        db.from("handbags").select("*").order("display_order"),
        db.from("gift_types").select("*").order("name"),
        db
          .from("reward_codes")
          .select("*,gift_types(name)")
          .order("created_at", { ascending: false })
          .limit(1000),
        db
          .from("purchase_access_codes")
          .select("id,purchase_reference,status,expires_at,used_at,created_at")
          .order("created_at", { ascending: false })
          .limit(1000),
        settings(),
        allClaims(),
      ]);
      return reply({
        handbags: await withImages(
          unwrap(handbags),
          "handbag_images",
          "handbag_id",
        ),
        gifts: await withImages(
          unwrap(gifts),
          "gift_type_images",
          "gift_type_id",
        ),
        reward_codes: unwrap(codes),
        access_codes: unwrap(access),
        settings: s,
        claims,
      });
    }
    if (action === "admin_export") return reply({ rows: await allClaims() });
    if (action === "admin_search_promo_code") {
      const pasted = text(body.code, 1000).toUpperCase();
      const match = pasted.match(/GIFT-[A-F0-9]{8}/);
      if (!match)
        return reply(
          {
            error:
              "Paste a promo code like GIFT-1A2B3C4D, or paste the customer message containing it.",
          },
          400,
        );
      const code = match[0];
      const claim = unwrap(
        await db
          .from("reward_claims")
          .select(
            "id,reward_code_id,selected_code,selected_at,benefit_name,discount_percent,status,purchase_reference,activated_at,expires_at",
          )
          .eq("selected_code", code)
          .maybeSingle(),
      );
      if (!claim)
        return reply(
          {
            error:
              "No customer use was found for that promo code. Check the code and try again.",
          },
          404,
        );
      const reward = unwrap(
        await db
          .from("reward_codes")
          .select("gift_type_id")
          .eq("id", claim.reward_code_id)
          .single(),
      );
      const gift = unwrap(
        await db
          .from("gift_types")
          .select("name")
          .eq("id", reward.gift_type_id)
          .single(),
      );
      return reply({
        result: { ...claim, code: claim.selected_code, gift_name: gift.name },
      });
    }
    if (action === "admin_refresh_access") {
      const code = "GOOVE-" + randomCode();
      unwrap(await db.rpc("goove_refresh_access", { p_hash: await sha(code) }));
      return reply({ code });
    }
    if (action === "admin_generate_rewards") {
      if (!uuid(body.gift_type_id)) throw Error("Choose a promotion.");
      const gift = unwrap(
        await db
          .from("gift_types")
          .select("id")
          .eq("id", body.gift_type_id)
          .eq("active", true)
          .single(),
      );
      const existing = unwrap(
        await db
          .from("reward_codes")
          .select("id")
          .eq("gift_type_id", gift.id)
          .maybeSingle(),
      );
      if (existing)
        throw Error(
          "This promotion already has a promo code. Reactivate it in the inventory, or add another promotion.",
        );
      const code = "GIFT-" + randomCode().slice(0, 8);
      unwrap(
        await db.from("reward_codes").insert({ code, gift_type_id: gift.id }),
      );
      return reply({ code });
    }
    if (action === "admin_refresh_promo") {
      if (!uuid(body.gift_type_id)) throw Error("Choose a promotion.");
      const gift = unwrap(
        await db
          .from("gift_types")
          .select("id")
          .eq("id", body.gift_type_id)
          .eq("active", true)
          .single(),
      );
      const code = "GIFT-" + randomCode().slice(0, 8);
      unwrap(
        await db.rpc("goove_refresh_promo_code", {
          p_gift_type_id: gift.id,
          p_code: code,
        }),
      );
      return reply({ code });
    }
    if (action === "admin_refresh_promo_codes")
      return reply(unwrap(await db.rpc("goove_refresh_available_promo_codes")));
    if (action === "admin_save") {
      if (!["handbags", "gift_types"].includes(body.table))
        throw Error("Invalid collection.");
      const i = body.item || {};
      if (!text(i.name) || !text(i.description, 500))
        throw Error("Name and description are required.");
      const image = text(i.image_url, 2000);
      if (
        image &&
        !image.startsWith("/images/") &&
        !image.startsWith(url + "/storage/v1/object/public/goove-images/")
      )
        throw Error("Upload the image using the photo control.");
      const item: any = {
        name: text(i.name),
        description: text(i.description, 500),
        image_url: image || null,
      };
      const photos = Array.isArray(i.gallery_images) ? i.gallery_images : [];
      const saveGallery = !i.id || photos.length > 0;
      if (
        saveGallery &&
        (photos.length < 1 ||
          photos.length > 3 ||
          photos.some(
            (p: any) =>
              typeof p !== "string" ||
              (!p.startsWith("/images/") &&
                !p.startsWith(url + "/storage/v1/object/public/goove-images/")),
          ))
      )
        throw Error("Add between 1 and 3 uploaded photos for each item.");
      if (saveGallery) item.image_url = photos[0];
      if (body.table === "handbags") {
        const price =
          i.price === "" || i.price == null ? null : Number(i.price);
        if (price === null || !Number.isFinite(price) || price <= 0)
          throw Error("Enter a price greater than zero for each handbag.");
        item.price = price;
        item.display_order = Number.isInteger(i.display_order)
          ? i.display_order
          : 0;
        item.in_stock = i.in_stock !== false;
      } else {
        item.active = Boolean(i.active);
        item.discount_percent = Number(i.discount_percent);
        if (
          !Number.isInteger(item.discount_percent) ||
          item.discount_percent < 0 ||
          item.discount_percent > 100
        )
          throw Error("Invalid discount.");
      }
      let saved: any;
      if (i.id) {
        if (!uuid(i.id)) throw Error("Invalid item.");
        saved = unwrap(
          await db
            .from(body.table)
            .update(item)
            .eq("id", i.id)
            .select("id")
            .single(),
        );
      } else
        saved = unwrap(
          await db.from(body.table).insert(item).select("id").single(),
        );
      if (saveGallery) {
        const gift = body.table === "gift_types";
        unwrap(
          await db.rpc(
            gift ? "goove_replace_gift_images" : "goove_replace_handbag_images",
            gift
              ? { p_gift_type_id: saved.id, p_images: photos }
              : { p_handbag_id: saved.id, p_images: photos },
          ),
        );
      }
      return reply({ ok: true });
    }
    if (action === "admin_handbag_stock") {
      if (!uuid(body.id) || typeof body.in_stock !== "boolean")
        throw Error("Invalid handbag stock update.");
      unwrap(
        await db
          .from("handbags")
          .update({ in_stock: body.in_stock })
          .eq("id", body.id)
          .select("id")
          .single(),
      );
      return reply({ ok: true });
    }
    if (action === "admin_delete_handbag") {
      if (!uuid(body.id)) throw Error("Invalid handbag.");
      unwrap(await db.from("handbags").delete().eq("id", body.id));
      return reply({ ok: true });
    }
    if (action === "admin_claim_status") {
      if (!uuid(body.id)) throw Error("Invalid claim.");
      return reply(
        unwrap(
          await db.rpc("goove_set_claim_status", {
            p_id: body.id,
            p_status: body.status,
          }),
        ),
      );
    }
    if (action === "admin_reward_status") {
      if (!uuid(body.id) || !["available", "disabled"].includes(body.status))
        throw Error("Invalid availability.");
      const rows = unwrap(
        await db
          .from("reward_codes")
          .update({ status: body.status })
          .eq("id", body.id)
          .in("status", ["available", "disabled"])
          .select("id"),
      );
      if (!rows.length) throw Error("Claimed rewards cannot be changed.");
      return reply({ ok: true });
    }
    if (action === "admin_revoke_access") {
      if (!uuid(body.id)) throw Error("Invalid access code.");
      const rows = unwrap(
        await db
          .from("purchase_access_codes")
          .update({ status: "revoked" })
          .eq("id", body.id)
          .eq("status", "active")
          .select("id"),
      );
      if (!rows.length)
        throw Error("This access code has already been used or revoked.");
      return reply({ ok: true });
    }
    if (action === "admin_upload") {
      const ext = (
        {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        } as Record<string, string>
      )[body.content_type];
      if (!ext) throw Error("Choose a JPG, PNG, or WebP image.");
      const path = crypto.randomUUID() + "." + ext;
      const signed = unwrap(
        await db.storage.from("goove-images").createSignedUploadUrl(path),
      );
      return reply({
        path,
        token: signed.token,
        public_url: db.storage.from("goove-images").getPublicUrl(path).data
          .publicUrl,
      });
    }
    if (action === "admin_settings") {
      const s = body.settings || {};
      if (!text(s.business_name) || !/^\d{8,15}$/.test(s.whatsapp_number))
        throw Error("Check the business name and WhatsApp number.");
      const publicPhone = text(s.public_phone, 30) || null;
      const publicEmail = text(s.public_email, 254).toLowerCase() || null;
      if (publicPhone && !/^\+?[0-9][0-9 ()-]{6,28}$/.test(publicPhone))
        throw Error("Check the visible phone number.");
      if (publicEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicEmail))
        throw Error("Check the public email address.");
      const heroHeading = text(s.hero_heading, 120);
      const heroDescription = text(s.hero_description, 400);
      const heroCtaText = text(s.hero_cta_text, 50);
      const heroImage = text(s.hero_image_url, 2000);
      const promoBannerText = text(s.promo_banner_text, 150);
      if (!heroHeading || !heroDescription || !heroCtaText || !promoBannerText)
        throw Error("Complete the home page banner and promo flag text.");
      if (
        !heroImage ||
        (!heroImage.startsWith("/images/") &&
          !heroImage.startsWith(
            url + "/storage/v1/object/public/goove-images/",
          ))
      )
        throw Error("Upload a valid home page banner image.");
      const links = Array.isArray(s.social_links) ? s.social_links : [];
      if (links.length > 8) throw Error("Add no more than eight social links.");
      const socialLinks = links.map((link: any) => {
        const label = text(link?.label, 40);
        const value = text(link?.url, 500);
        let parsed: URL;
        try {
          parsed = new URL(value);
        } catch {
          throw Error("Check each social media link.");
        }
        if (label.length < 2 || parsed.protocol !== "https:")
          throw Error("Enter a social media name and a secure https link.");
        return { label, url: parsed.toString() };
      });
      if (s.promotion_enabled && !s.legal_reviewed)
        throw Error(
          "Complete the promotion legal review before opening registration.",
        );
      unwrap(
        await db
          .from("goove_settings")
          .update({
            business_name: text(s.business_name),
            whatsapp_number: s.whatsapp_number,
            public_phone: publicPhone,
            public_email: publicEmail,
            social_links: socialLinks,
            hero_heading: heroHeading,
            hero_description: heroDescription,
            hero_cta_text: heroCtaText,
            hero_image_url: heroImage,
            promo_banner_text: promoBannerText,
            promotion_mode: "hidden",
            promotion_enabled: Boolean(s.promotion_enabled),
            legal_reviewed: Boolean(s.legal_reviewed),
          })
          .eq("id", true),
      );
      return reply({ ok: true });
    }
    return reply({ error: "Unknown action." }, 400);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Unable to complete the request.";
    const safe =
      /^(This |Your |Please |Reward |Enter |Choose |Only |Complete |Owner |Invalid |A handbag|Name and|Upload |Claimed |Check |Too many)/.test(
        message,
      );
    return reply(
      {
        error:
          e instanceof HttpError || safe
            ? message
            : "Unable to complete the request. Please try again or contact our team.",
      },
      e instanceof HttpError ? e.status : 400,
    );
  }
});
