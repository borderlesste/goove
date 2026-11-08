import { test, expect } from "@playwright/test";
const base = {
  description: "A considered everyday design.",
  image_url: "/images/signature.webp",
  gallery_images: ["/images/signature.webp", "/images/day-tote.webp"],
  price: 45,
  in_stock: true,
};
const products = [
  {
    ...base,
    id: "curated",
    name: "Curated handbag",
    category: "handbag",
    featured: true,
  },
  {
    ...base,
    id: "new-bag",
    name: "New handbag",
    category: "handbag",
    featured: false,
  },
  {
    ...base,
    id: "women-watch",
    name: "Women’s watch",
    category: "watch",
    audience: "women",
    featured: false,
    translations: { fr: { description: "Une montre pour votre quotidien." } },
  },
  {
    ...base,
    id: "men-watch",
    name: "Men’s watch",
    category: "watch",
    audience: "men",
    featured: true,
  },
];
const settings = {
  business_name: "Goove",
  whatsapp_number: "17176554737",
  hero_heading: "Elevate Your Elegance",
  hero_description: "Women’s watches and handbags, with select men’s watches.",
  hero_cta_text: "Discover your exclusive rewards",
  hero_image_url: "/images/hero.webp",
  promo_banner_text: "Discover watches, handbags & exclusive rewards",
  social_links: [],
};
test.beforeEach(async ({ page }) =>
  page.route("**/functions/v1/goove-api", (route) =>
    route.fulfill({ json: { handbags: products, gifts: [], settings } }),
  ),
);

test("home shows selected products; full collection pages separate handbags and watches", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".bag")).toHaveCount(2);
  await expect(
    page.getByRole("article", { name: "New handbag", exact: true }),
  ).toHaveCount(0);
  const nav = page.getByRole("navigation");
  await nav.getByRole("link", { name: "Watches", exact: true }).click();
  await expect(page).toHaveURL(/\/watches$/);
  await expect(
    nav.getByRole("link", { name: "Watches", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("article", { name: "Curated handbag", exact: true }),
  ).toHaveCount(0);
  const women = page.getByRole("region", {
      name: "Women’s watches",
      exact: true,
    }),
    men = page.getByRole("region", {
      name: "Select men’s watches",
      exact: true,
    });
  await expect(
    women.getByRole("article", { name: "Women’s watch", exact: true }),
  ).toBeVisible();
  await expect(
    men.getByRole("article", { name: "Men’s watch", exact: true }),
  ).toBeVisible();
  expect((await women.boundingBox()).y).toBeLessThan(
    (await men.boundingBox()).y,
  );
  await page.reload();
  await expect(page.locator(".bag")).toHaveCount(2);
  await nav.getByRole("link", { name: "Handbags", exact: true }).click();
  await expect(page).toHaveURL(/\/handbags$/);
  await expect(page.locator(".bag")).toHaveCount(2);
  await expect(
    page.getByRole("article", { name: "New handbag", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("watch inquiry links reopen the exact watch and photo, and non-featured handbag links still work", async ({
  page,
}) => {
  await page.goto("/watches");
  const card = page.getByRole("article", {
    name: "Women’s watch",
    exact: true,
  });
  await card
    .getByRole("button", { name: "Next photo of Women’s watch", exact: true })
    .click();
  const href = await card
    .getByRole("link", { name: "BUY THIS WATCH", exact: true })
    .getAttribute("href");
  const text = new URL(href).searchParams.get("text"),
    link = text.match(/Selected product: (\S+)/)[1];
  expect(new URL(link).pathname).toBe("/watches");
  expect(text).toContain("/images/day-tote.webp");
  const shared = new URL(link);
  await page.goto(shared.pathname + shared.search + shared.hash);
  const dialog = page.getByRole("dialog", {
    name: "Women’s watch",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".product-detail-photo img")).toHaveAttribute(
    "src",
    "/images/day-tote.webp",
  );
  await dialog.locator(".close").click();
  await page.locator(".language-selector select").selectOption("fr");
  await expect(
    page
      .getByRole("article", { name: "Women’s watch", exact: true })
      .locator(".product-description"),
  ).toHaveText("Une montre pour votre quotidien.");
  await page.locator(".language-selector select").selectOption("en");
  await page.goto("/?bag=new-bag&photo=1#bag-new-bag");
  await expect(
    page.getByRole("dialog", { name: "New handbag", exact: true }),
  ).toBeVisible();
});

test("owner manages watch audience and home placement, and new products default to collection only", async ({
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
  const inventory = structuredClone(products),
    writes = [];
  await page.route("**/functions/v1/goove-api", (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "admin_save") {
      writes.push(body);
      Object.assign(
        inventory.find((item) => item.id === body.item.id),
        body.item,
      );
    }
    return route.fulfill({
      json: ["catalog", "admin_list"].includes(body.action)
        ? {
            handbags: inventory,
            gifts: [],
            settings,
            claims: [],
            access_codes: [],
            reward_codes: [],
          }
        : { ok: true },
    });
  });
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Watches", exact: true }).click();
  const row = page.locator(".catalog-row").filter({ hasText: "Women’s watch" });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    page.getByLabel("Feature on home page", { exact: true }),
  ).not.toBeChecked();
  await page
    .getByLabel("Collection audience", { exact: true })
    .selectOption("men");
  await page.getByLabel("Feature on home page", { exact: true }).check();
  await page.getByRole("button", { name: "SAVE CHANGES", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].item).toMatchObject({
    category: "watch",
    audience: "men",
    featured: true,
  });
  await expect(
    page.locator(".catalog-row").filter({ hasText: "Women’s watch" }),
  ).toContainText("Featured on home");
  await page.getByRole("button", { name: "Add watch", exact: true }).click();
  await expect(
    page.getByLabel("Product collection", { exact: true }),
  ).toHaveValue("watch");
  await expect(
    page.getByLabel("Collection audience", { exact: true }),
  ).toHaveValue("women");
  await expect(
    page.getByLabel("Feature on home page", { exact: true }),
  ).not.toBeChecked();
  await page.goto("/");
  await expect(
    page.getByRole("article", { name: "Women’s watch", exact: true }),
  ).toBeVisible();
});
