import { test, expect } from "@playwright/test";

const longDescription =
  "A thoughtfully designed handbag for your everyday essentials. ".repeat(8);
const bags = [
  {
    featured: true,
    id: "signature",
    name: "The Signature",
    description: longDescription,
    image_url: "/images/signature.webp",
    gallery_images: ["/images/signature.webp", "/images/day-tote.webp"],
    price: 45,
    in_stock: true,
    specifications: "Material: owner-confirmed sample\nDimensions: 30 × 20 cm",
  },
  {
    featured: true,
    id: "shoulder",
    name: "The Shoulder",
    description: "Polished and versatile.",
    image_url: "/images/shoulder.webp",
    price: 38,
    in_stock: true,
  },
  {
    featured: true,
    id: "woven",
    name: "The Woven with an exceptionally long product name for a considered wardrobe",
    description:
      "Artisanal texture, everyday elegance, made for getting away and coming home.",
    image_url: "/images/woven.webp",
    price: 35,
    in_stock: false,
  },
  {
    featured: true,
    id: "mini",
    name: "The Mini",
    description: "Compact and refined.",
    image_url: "/images/mini.webp",
    price: null,
    in_stock: true,
  },
];
const catalog = {
  handbags: bags,
  gifts: [],
  settings: {
    business_name: "Goove",
    whatsapp_number: "17176554737",
    social_links: [],
    hero_heading: "Elevate Your Elegance",
    hero_description: "Luxury Women's Handbags with Exclusive Matching Gift",
    hero_cta_text: "Discover your exclusive rewards",
    hero_image_url: "/images/hero.webp",
    promo_banner_text: "Choose a bag, discover your matching gift.",
  },
};
test.beforeEach(async ({ page }) => {
  await page.route("**/functions/v1/goove-api", (route) =>
    route.fulfill({ json: catalog }),
  );
});

async function assertAlignedCards(page) {
  for (const card of await page.locator(".bag").all()) {
    const clipped = await card
      .locator(".product-description")
      .evaluate((p) => p.scrollHeight > p.clientHeight + 1);
    if (clipped)
      await expect(
        card.getByRole("button", { name: "Read more", exact: true }),
      ).toBeVisible();
  }
  const boxes = await page.locator(".bag").evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect();
      const action = card
        .querySelector(".product-purchase")
        .getBoundingClientRect();
      return { top: box.top, height: box.height, actionTop: action.top };
    }),
  );

  for (const first of boxes)
    for (const other of boxes) {
      if (Math.abs(first.top - other.top) < 2) {
        expect(Math.abs(first.actionTop - other.actionTop)).toBeLessThan(2);
        expect(Math.abs(first.height - other.height)).toBeLessThan(2);
      }
    }
}

test("hero uses the requested copy and separates image, text, and CTA", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const title = page.getByRole("heading", {
    name: "Elevate Your Elegance",
    exact: true,
  });
  await expect(title).toBeVisible();
  await expect(page.locator(".hero-subtitle")).toHaveText(
    "Luxury Women's Handbags with Exclusive Matching Gift",
  );
  const heading = await title.boundingBox();
  const subtitle = await page.locator(".hero-subtitle").boundingBox();
  const image = await page.locator(".hero-image").boundingBox();
  const copy = await page.locator(".hero-copy").boundingBox();
  expect(image.height).toBeLessThanOrEqual(isMobile ? 250 : 380);
  expect(subtitle.y).toBeGreaterThan(heading.y + heading.height);
  if (isMobile)
    expect(image.y).toBeGreaterThanOrEqual(copy.y + copy.height - 1);
  else {
    expect(image.x).toBeGreaterThanOrEqual(copy.x + copy.width - 1);
    expect(image.width).toBeGreaterThan(400);
  }
  await page
    .locator(".hero")
    .getByRole("link", { name: "Discover your exclusive rewards" })
    .click();
  await expect(page).toHaveURL(/\/rewards$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("cards and actions align even when descriptions expand", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const card = page.getByRole("article", {
    name: "The Signature",
    exact: true,
  });
  const toggle = card.getByRole("button", { name: "Read more", exact: true });
  await expect(toggle).toBeVisible();
  for (const item of await page.locator(".bag").all()) {
    const title = await item.locator("h3").boundingBox();
    const description = await item
      .locator(".product-description")
      .boundingBox();
    expect(description.y - title.y - title.height).toBeLessThanOrEqual(5);
  }
  const preview = await card.locator(".product-description").evaluate((p) => ({
    height: p.getBoundingClientRect().height,
    lineHeight: parseFloat(getComputedStyle(p).lineHeight),
  }));
  expect(preview.height / preview.lineHeight).toBeLessThanOrEqual(2.51);
  for (const item of await page.locator(".bag").all()) {
    const details = await item.locator(".product-read-more").boundingBox();
    const price = await item.locator(".product-price").boundingBox();
    expect(price.y - details.y - details.height).toBeLessThanOrEqual(5);
  }
  await assertAlignedCards(page);
  await toggle.click();
  await expect(
    card.getByRole("button", { name: "Read less", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  expect(
    await card
      .locator(".product-description")
      .evaluate((p) => p.scrollHeight <= p.clientHeight + 1),
  ).toBe(true);
  await assertAlignedCards(page);
  await card.getByRole("button", { name: "Read less", exact: true }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await assertAlignedCards(page);
  await expect(
    page
      .getByRole("article", { name: bags[2].name })
      .getByRole("link", { name: "BUY THIS BAG" }),
  ).toHaveCount(0);
});

test("Quick View opens from the image, shows full details, and restores keyboard focus", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "Quick view The Signature",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const modal = page.getByRole("dialog", {
    name: "The Signature",
    exact: true,
  });
  await expect(modal).toBeVisible();
  await expect(modal.locator(".product-full-description")).toHaveText(
    longDescription.trim(),
  );
  await expect(modal.locator(".product-specification-notes")).toContainText(
    "Dimensions: 30 × 20 cm",
  );
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );
  const controls = modal.getByRole("button");
  await controls.last().focus();
  await page.keyboard.press("Tab");
  expect(
    await modal.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  expect(
    await modal.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await trigger.click();
  await modal
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  await trigger.click();
  await modal.click({ position: { x: 5, y: 5 } });
  await expect(modal).toBeVisible();
  await page.mouse.click(0, 0);
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("WhatsApp inquiries include the canonical bag link and the exact selected photo", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.getByRole("article", {
    name: "The Signature",
    exact: true,
  });
  const checkMessage = async (link, photo) => {
    const url = new URL(await link.getAttribute("href"));
    expect(url.origin + url.pathname).toBe("https://wa.me/17176554737");
    const message = url.searchParams.get("text");
    expect(message).toContain("The Signature");
    expect(message).toContain(
      `https://goove.vercel.app/?bag=signature&photo=${photo === "signature" ? 1 : 2}#bag-signature`,
    );
    expect(message).toContain(
      `Product photo: https://goove.vercel.app/images/${photo}.webp`,
    );
  };
  await checkMessage(
    card.getByRole("link", { name: "BUY THIS BAG" }),
    "signature",
  );
  await card
    .getByRole("button", { name: "Next photo of The Signature" })
    .click();
  await checkMessage(
    card.getByRole("link", { name: "BUY THIS BAG" }),
    "day-tote",
  );
  await card
    .getByRole("button", { name: "Quick view The Signature", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "The Signature",
    exact: true,
  });
  await expect(
    modal.getByRole("img", { name: "The Signature, photo 2 of 2" }),
  ).toHaveAttribute("src", "/images/day-tote.webp");
  await checkMessage(
    modal.getByRole("link", { name: "BUY THIS BAG" }),
    "day-tote",
  );
  await modal
    .getByRole("button", { name: "Show photo 1 of The Signature" })
    .click();
  await checkMessage(
    modal.getByRole("link", { name: "BUY THIS BAG" }),
    "signature",
  );
});

test("a WhatsApp recipient opens the exact bag and selected photo directly", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.getByRole("article", {
    name: "The Signature",
    exact: true,
  });
  await card
    .getByRole("button", { name: "Next photo of The Signature" })
    .click();
  const message = new URL(
    await card.getByRole("link", { name: "BUY THIS BAG" }).getAttribute("href"),
  ).searchParams.get("text");
  const productURL = new URL(message.match(/Selected product: (.+)/)[1]);
  await page.goto(productURL.pathname + productURL.search + productURL.hash);
  const modal = page.getByRole("dialog", {
    name: "The Signature",
    exact: true,
  });
  await expect(modal).toBeVisible();
  await expect(modal.locator(".product-detail-photo img")).toHaveAttribute(
    "src",
    "/images/day-tote.webp",
  );
  await modal
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page
    .locator(".hero")
    .getByRole("link", { name: "Discover your exclusive rewards", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("gift flag stays visible while scrolling and across website routes", async ({
  page,
}) => {
  await page.goto("/");
  const flag = page.locator(".promo-flag");
  await expect(flag).toBeInViewport();
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(flag).toBeInViewport();
  expect(
    await page
      .locator(".promo-flag-bar")
      .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
  ).toBe(0);
  await flag.click();
  await expect(page).toHaveURL(/\/#collection$/);
  await page
    .getByRole("link", { name: "Gifts & Rewards", exact: true })
    .click();
  await expect(page).toHaveURL(/\/rewards$/);
  await expect(flag).toBeInViewport();
  await page.getByRole("link", { name: "Owner access", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(flag).toBeInViewport();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await flag.evaluate((el) => getComputedStyle(el, "::after").animationName),
  ).toBe("none");
});

test("shared product links identify the exact bag and unavailable photos fail gracefully", async ({
  page,
}) => {
  await page.route("**/images/mini.webp", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.goto("/#bag-mini");
  const card = page.getByRole("article", { name: "The Mini", exact: true });
  await expect(card).toBeInViewport();
  await expect(
    card.getByText("Photo unavailable", { exact: true }),
  ).toBeVisible();
  await card
    .getByRole("button", { name: "Quick view The Mini", exact: true })
    .click();
  const modal = page.getByRole("dialog", { name: "The Mini", exact: true });
  await expect(
    modal.getByText("Photo unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    modal.getByText(
      "Ask our team for materials, dimensions, and matching gift details.",
    ),
  ).toHaveCount(0);
});

test("three-photo galleries open the shared photo and cycle with previous and next arrows", async ({
  page,
}) => {
  const photos = Array.from(
    { length: 3 },
    (_, i) => `/images/signature.webp?photo=${i + 1}`,
  );
  await page.route("**/functions/v1/goove-api", (route) =>
    route.fulfill({
      json: { ...catalog, handbags: [{ ...bags[0], gallery_images: photos }] },
    }),
  );
  await page.goto("/?bag=signature&photo=3#bag-signature");
  const modal = page.getByRole("dialog", {
    name: "The Signature",
    exact: true,
  });
  await expect(modal.locator(".product-detail-photo img")).toHaveAttribute(
    "src",
    photos[2],
  );
  await expect(modal.locator(".product-photo-count")).toHaveText("3 / 3");
  await modal
    .getByRole("button", { name: "Next photo of The Signature", exact: true })
    .click();
  await expect(modal.locator(".product-detail-photo img")).toHaveAttribute(
    "src",
    photos[0],
  );
  await modal
    .getByRole("button", {
      name: "Previous photo of The Signature",
      exact: true,
    })
    .click();
  await expect(modal.locator(".product-detail-photo img")).toHaveAttribute(
    "src",
    photos[2],
  );
  await modal
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page.getByRole("link", { name: "Goove home", exact: true }).click();
  await page
    .getByRole("link", { name: "Gifts & Rewards", exact: true })
    .click();
  await page.locator(".promo-flag").click();
  await expect(page).toHaveURL(/\/#collection$/);
  await expect(
    page.getByRole("heading", { name: "Featured watches & handbags." }),
  ).toBeInViewport();
});
