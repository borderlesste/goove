import { test, expect } from "@playwright/test";
const products = [1, 2, 3, 4].map((n) => ({
  id: `bag-${n}`,
  name: `Bag ${n}`,
  category: "handbag",
  featured: true,
  in_stock: true,
  price: 40 + n,
  description: "A useful everyday style.",
  image_url: "/images/signature.webp",
  gallery_images: ["/images/signature.webp", "/images/day-tote.webp"],
}));
products.push({
  id: "watch-a",
  name: "Signature Watch",
  category: "watch",
  audience: "women",
  featured: false,
  in_stock: true,
  price: 65,
  description: "The full detailed watch description, entered by the owner.",
  specifications: "Case: owner-confirmed sample\nStrap: owner-confirmed sample",
  image_url: "/images/watch.webp",
  gallery_images: ["/images/watch.webp", "/images/signature.webp"],
});
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
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.route("**/functions/v1/goove-api", (route) =>
    route.fulfill({ json: { handbags: products, gifts: [], settings } }),
  );
});
const order = (page) =>
  page.locator(".bag").evaluateAll((cards) => cards.map((card) => card.id));
const leave = (page) =>
  page.evaluate(() => window.dispatchEvent(new Event("blur")));
const returnToPage = (page) =>
  page.evaluate(() => window.dispatchEvent(new Event("focus")));

test("refresh changes order but active browsing, language changes and route navigation keep it steady", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await page.goto("/");
  await expect(page.locator(".bag")).toHaveCount(4);
  const initial = await order(page);
  await page.clock.fastForward(10 * 60 * 1000);
  expect(await order(page)).toEqual(initial);
  await page.locator(".language-selector select").selectOption("fr");
  expect(await order(page)).toEqual(initial);
  await page.getByRole("navigation").locator('a[href="/handbags"]').click();
  expect(await order(page)).toEqual(initial);
  await page.reload();
  await expect(page.locator(".bag")).toHaveCount(4);
  await expect.poll(() => order(page)).not.toEqual(initial);
  const after = await order(page);
  expect([...after].sort()).toEqual([...initial].sort());
  await page.getByRole("navigation").locator('a[href="/"]').click();
  expect(await order(page)).toEqual(after);
  await expect(
    page.getByRole("article", { name: "Signature Watch", exact: true }),
  ).toHaveCount(0);
});

test("returning after five minutes away reshuffles; a shorter absence leaves the order unchanged", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await page.goto("/handbags");
  await expect(page.locator(".bag")).toHaveCount(4);
  const initial = await order(page);
  await leave(page);
  await page.clock.fastForward(299000);
  await returnToPage(page);
  expect(await order(page)).toEqual(initial);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => window.testPageHidden,
    });
    window.testPageHidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(300000);
  expect(await order(page)).toEqual(initial);
  await page.evaluate(() => {
    window.testPageHidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => order(page)).not.toEqual(initial);
  expect([...(await order(page))].sort()).toEqual([...initial].sort());
});

test("an open preview keeps its product and photo until close, then applies the deferred shuffle", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00Z") });
  await page.goto("/handbags");
  await expect(page.locator(".bag")).toHaveCount(4);
  const initial = await order(page);
  const card = page.getByRole("article", { name: "Bag 1", exact: true });
  await card.locator(".product-image-button").click();
  const dialog = page.getByRole("dialog", { name: "Bag 1", exact: true });
  await dialog
    .getByRole("button", { name: "Next photo of Bag 1", exact: true })
    .click();
  await leave(page);
  await page.clock.fastForward(300000);
  await returnToPage(page);
  expect(await order(page)).toEqual(initial);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".product-detail-photo img")).toHaveAttribute(
    "src",
    "/images/day-tote.webp",
  );
  await dialog.locator(".close").click();
  await expect.poll(() => order(page)).not.toEqual(initial);
  await expect(card.locator(".product-image-button img")).toHaveAttribute(
    "src",
    "/images/day-tote.webp",
  );
});

test("watch image and title open the shared enlarged preview with full details and keyboard focus restoration", async ({
  page,
}) => {
  await page.goto("/watches");
  const card = page.getByRole("article", {
    name: "Signature Watch",
    exact: true,
  });
  const image = card.locator(".product-image-button");
  await image.focus();
  await page.keyboard.press("Enter");
  let dialog = page.getByRole("dialog", {
    name: "Signature Watch",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".product-full-description")).toHaveText(
    products[4].description,
  );
  await expect(dialog.locator(".product-specification-notes")).toHaveText(
    products[4].specifications,
  );
  await expect(dialog.locator(".product-detail-price")).toHaveText("$65.00");
  await expect(
    dialog.getByRole("link", { name: "BUY THIS WATCH", exact: true }),
  ).toBeVisible();
  await dialog.locator(".close").click();
  await expect(image).toBeFocused();
  const title = card
    .getByRole("heading", { name: "Signature Watch", exact: true })
    .getByRole("link");
  await title.focus();
  await page.keyboard.press("Enter");
  dialog = page.getByRole("dialog", { name: "Signature Watch", exact: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(title).toBeFocused();
});

test("modern typography is shared by shop, Rewards, Studio and watch preview", async ({
  page,
}) => {
  for (const path of ["/", "/watches", "/rewards", "/admin"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    const style = await page.locator("h1").evaluate((h) => ({
      family: getComputedStyle(h).fontFamily,
      weight: Number(getComputedStyle(h).fontWeight),
    }));
    expect(style.family).toContain("Inter");
    expect(style.weight).toBeGreaterThanOrEqual(700);
  }
  await page.goto("/watches");
  await page
    .getByRole("article", { name: "Signature Watch", exact: true })
    .locator(".product-image-button")
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("h2")).toHaveCSS("font-weight", "700");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
