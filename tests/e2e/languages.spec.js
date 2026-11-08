import { test, expect } from "@playwright/test";
const bag = {
  featured: true,
  id: "bag-test",
  name: "Original bag",
  description: "Original description",
  specifications: "Original details",
  price: 45,
  in_stock: true,
  image_url: "/images/signature.webp",
  gallery_images: ["/images/signature.webp", "/images/day-tote.webp"],
  translations: {
    fr: {
      name: "Sac français",
      description: "Une description en français.",
      specifications: "Détails en français.",
    },
    ht: { name: "Valiz kreyòl", description: "Yon deskripsyon an kreyòl." },
    es: { name: "Bolso español", description: "Una descripción en español." },
  },
};
const settings = {
  business_name: "Goove",
  hero_heading: "Elevate Your Elegance",
  hero_description: "Luxury Women's Handbags with Exclusive Matching Gift",
  hero_cta_text: "Discover your exclusive rewards",
  hero_image_url: "/images/hero.webp",
  promo_banner_text: "Buy one bag and get your gift",
  whatsapp_number: "17176554737",
  social_links: [],
  translations: {
    fr: { hero_heading: "Une élégance à votre image" },
    ht: { hero_heading: "Elegans ki sanble avè ou" },
    es: { hero_heading: "Elegancia para ti" },
  },
};
test.beforeEach(async ({ page }) => {
  await page.route("**/functions/v1/goove-api", (route) => {
    const body = route.request().postDataJSON();
    return route.fulfill({
      json:
        body.action === "catalog"
          ? { settings, handbags: [bag], gifts: [] }
          : {
              error:
                "This access code has already been used. Ask Goove for a new access code.",
            },
      status: body.action === "catalog" ? 200 : 400,
    });
  });
});
for (const [code, label, title, name, buy, rewards, enter, access, error] of [
  [
    "fr",
    "Français",
    "Une élégance à votre image",
    "Sac français",
    "ACHETER CE SAC",
    "Cadeaux et récompenses",
    "SAISIR LE CODE D’ACCÈS",
    "Code d’accès",
    "Ce code d’accès a déjà été utilisé.",
  ],
  [
    "ht",
    "Kreyòl ayisyen",
    "Elegans ki sanble avè ou",
    "Valiz kreyòl",
    "ACHTE VALIZ SA A",
    "Kado ak rekonpans",
    "ANTRE KÒD AKSÈ A",
    "Kòd aksè",
    "Kòd aksè sa a deja sèvi.",
  ],
  [
    "es",
    "Español",
    "Elegancia para ti",
    "Bolso español",
    "COMPRAR ESTE BOLSO",
    "Regalos y recompensas",
    "INTRODUCIR CÓDIGO DE ACCESO",
    "Código de acceso",
    "Este código de acceso ya se ha utilizado.",
  ],
])
  test(`${label}: language persists across reloads, product Quick View and Rewards`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator(".language-selector select").selectOption(code);
    await expect(page.locator("html")).toHaveAttribute("lang", code);
    await expect(page.locator(".hero h1")).toHaveText(title);
    const card = page.getByRole("article", { name, exact: true });
    await expect(
      card.getByRole("link", { name: buy, exact: true }),
    ).toBeVisible();
    await card.locator(".product-image-button").click();
    const modal = page.getByRole("dialog", { name, exact: true });
    await expect(modal.locator(".product-full-description")).toHaveText(
      bag.translations[code].description,
    );
    await expect(modal.locator(".product-specification-notes")).toHaveText(
      bag.translations[code].specifications || bag.specifications,
    );
    await modal.locator(".close").click();
    await page.reload();
    await expect(page.locator(".language-selector select")).toHaveValue(code);
    await page
      .getByRole("navigation")
      .getByRole("link", { name: rewards, exact: true })
      .click();
    await page.getByRole("button", { name: enter, exact: true }).click();
    await page.getByLabel(access, { exact: true }).fill("GOOVE-USED");
    await page.locator(".reward-flow form button").click();
    await expect(page.getByRole("alert")).toContainText(error);
    await expect(page.getByRole("alert")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator(".language-selector select").selectOption("en");
    await page.locator(".promo-flag").click();
    await expect(page.locator(".hero h1")).toHaveText("Elevate Your Elegance");
    await expect(
      page.getByRole("article", { name: "Original bag", exact: true }),
    ).toBeVisible();
  });

test("standard banner frame fits wide and portrait uploads without cropping or layout shifts", async ({
  page,
}) => {
  await page.goto("/");
  const frame = page.locator(".hero-photo-frame");
  const before = await frame.boundingBox();
  for (const [width, height] of [
    [2000, 500],
    [500, 2000],
  ]) {
    await page.locator(".hero-image").evaluate(
      (img, { width, height }) => {
        img.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="green"/></svg>`)}`;
      },
      { width, height },
    );
    await expect
      .poll(() =>
        page
          .locator(".hero-image")
          .evaluate((img) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
    const after = await frame.boundingBox();
    expect(after.height).toBeCloseTo(before.height, 0);
    expect(after.width / after.height).toBeCloseTo(1.6, 1);
    await expect(page.locator(".hero-image")).toHaveCSS(
      "object-fit",
      "contain",
    );
  }
});

test("owner can save product and banner translations and preview the standard photo frame", async ({
  page,
}) => {
  const user = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "owner@example.test",
  };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
    Buffer.from(JSON.stringify({ sub: user.id, exp })).toString("base64url"),
    "test-signature",
  ].join(".");
  await page.addInitScript(
    (session) =>
      localStorage.setItem("sb-goove-test-auth-token", JSON.stringify(session)),
    {
      access_token: token,
      refresh_token: "test-refresh",
      expires_at: exp,
      expires_in: 3600,
      token_type: "bearer",
      user,
    },
  );
  const storedBag = structuredClone(bag),
    storedSettings = { ...settings, promotion_enabled: false };
  const writes = [];
  await page.route("**/functions/v1/goove-api", (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "admin_save") {
      writes.push(body);
      Object.assign(storedBag, body.item);
    }
    if (body.action === "admin_settings") {
      writes.push(body);
      Object.assign(storedSettings, body.settings);
    }
    return route.fulfill({
      json: ["catalog", "admin_list"].includes(body.action)
        ? {
            settings: storedSettings,
            handbags: [storedBag],
            gifts: [],
            claims: [],
            access_codes: [],
            reward_codes: [],
          }
        : { ok: true },
    });
  });
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Handbags", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByText("Language translations (optional)", { exact: true })
    .click();
  await page
    .getByLabel("Description — Français", { exact: true })
    .fill("Traduction enregistrée.");
  await page.getByRole("button", { name: "SAVE CHANGES", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].item.translations.fr.description).toBe(
    "Traduction enregistrée.",
  );
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await expect(page.locator(".banner-preview")).toHaveCSS(
    "object-fit",
    "contain",
  );
  await page
    .getByText("Language translations (optional)", { exact: true })
    .click();
  await page
    .getByLabel("Banner headline — Español", { exact: true })
    .fill("Un estilo especial");
  await page
    .getByLabel("Promo flag text — Kreyòl ayisyen", { exact: true })
    .fill("Achte yon valiz epi resevwa yon kado");
  await page
    .getByRole("button", { name: "SAVE SETTINGS", exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].settings.translations.es.hero_heading).toBe(
    "Un estilo especial",
  );
  expect(writes[1].settings.translations.ht.promo_banner_text).toBe(
    "Achte yon valiz epi resevwa yon kado",
  );
  await page.goto("/");
  await page.locator(".language-selector select").selectOption("fr");
  await expect(page.locator(".product-description")).toHaveText(
    "Traduction enregistrée.",
  );
  await page.locator(".language-selector select").selectOption("es");
  await expect(page.locator(".hero h1")).toHaveText("Un estilo especial");
});

test("photo controls stay compact and do not cover images with a Quick View badge", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.locator(".bag").first();
  await expect(card.locator(".quick-view-label")).toHaveCount(0);
  const next = card.locator(".product-photo-arrow.next");
  const box = await next.boundingBox();
  expect(box.width).toBeLessThanOrEqual(30);
  expect(box.height).toBeGreaterThanOrEqual(24);
  const photo = card.locator(".product-image-button img");
  const before = await photo.getAttribute("src");
  await next.click();
  await expect(photo).not.toHaveAttribute("src", before);
  await card.locator(".product-image-button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
