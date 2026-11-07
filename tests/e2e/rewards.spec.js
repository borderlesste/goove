import { test, expect } from "@playwright/test";

const settings = {
  business_name: "Goove",
  whatsapp_number: "17176554737",
  hero_heading: "Everyday, exceptionally.",
  hero_description: "Handbags for every chapter.",
  hero_image_url: "/images/hero.webp",
  hero_cta_text: "VIEW GIFTS & REWARDS",
  social_links: [],
};
const catalog = { handbags: [], gifts: [], settings };
const rewardId = "11111111-1111-4111-8111-111111111111";
const claim = {
  id: "22222222-2222-4222-8222-222222222222",
  reward_code_id: rewardId,
  code: "GIFT-1234ABCD",
  selected_at: "2026-11-07T01:00:00Z",
};

test("signing out clears the owner view and generated codes", async ({
  page,
}) => {
  const user = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "owner@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
  };
  const token = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "test-signature",
  ].join(".");
  await page.route("**/auth/v1/token?*", (route) =>
    route.fulfill({
      json: {
        access_token: token,
        refresh_token: "test-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user,
      },
    }),
  );
  await page.route("**/auth/v1/logout?*", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  await mockApi(page, (route, body) =>
    route.fulfill({
      json:
        body.action === "admin_list"
          ? { ...catalog, reward_codes: [], access_codes: [], claims: [] }
          : { code: "GOOVE-TEST-GENERATED" },
    }),
  );
  await page.goto("/admin");
  const login = async () => {
    await page.getByLabel("Email address").fill(user.email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("test-password-only");
    await page.getByRole("button", { name: "SIGN IN", exact: true }).click();
    await page.getByRole("tab", { name: "Codes", exact: true }).click();
  };
  await login();
  await page
    .getByRole("button", { name: "REFRESH ACCESS CODE", exact: true })
    .click();
  await expect(page.locator("code")).toHaveText("GOOVE-TEST-GENERATED");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.locator("code")).toHaveCount(0);
  await login();
  await expect(page.locator("code")).toHaveCount(0);
});

async function mockApi(page, handle) {
  await page.route("**/functions/v1/goove-api", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "catalog") return route.fulfill({ json: catalog });
    if (body.action === "verify") {
      return route.fulfill({
        json: {
          codes: [
            { id: rewardId, code: "GIFT-••••••••", status: "available" },
            { id: "unavailable", code: "GIFT-••••••••", status: "reserved" },
          ],
        },
      });
    }
    return handle(route, body);
  });
}

async function choosePromo(page) {
  await page.goto("/rewards");
  await page
    .getByRole("button", { name: "VIEW AVAILABLE PROMO CODES" })
    .click();
  await page
    .getByLabel("Access code", { exact: true })
    .fill("GOOVE-" + "A".repeat(48));
  await page.getByRole("button", { name: "VIEW MY PROMO CODES" }).click();
  const buttons = page.getByRole("button", { name: "SEND THIS CODE" });
  await expect(buttons.nth(1)).toBeDisabled();
  await buttons.first().click();
  const dialog = page.getByRole("dialog", { name: "Send your promo code" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Name", { exact: true }).fill("Test Customer");
  await dialog
    .getByLabel("Phone number", { exact: true })
    .fill("+1 717 555 0100");
  return dialog;
}

test("owner sign-in remains reachable when the public catalog fails", async ({
  page,
}) => {
  await page.route("**/functions/v1/goove-api", (route) =>
    route.fulfill({ status: 503, json: { error: "Catalog unavailable" } }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toHaveText("Catalog unavailable");
  await page.goto("/admin");
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Goove Studio" }),
  ).toBeVisible();
});

test("reservation failures are visible inside the dialog", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockApi(page, (route) =>
    route.fulfill({
      status: 400,
      json: { error: "This promo is unavailable." },
    }),
  );
  const dialog = await choosePromo(page);
  await dialog.getByRole("button", { name: "CONTINUE TO WHATSAPP" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This promo is unavailable.",
  );
  await expect(
    dialog.getByRole("button", { name: "CONTINUE TO WHATSAPP" }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("Escape cannot dismiss a reservation while it is being saved", async ({
  page,
}) => {
  let finish;
  let started;
  const requestStarted = new Promise((resolve) => {
    started = resolve;
  });
  const responseReady = new Promise((resolve) => {
    finish = resolve;
  });
  await mockApi(page, async (route) => {
    started();
    await responseReady;
    return route.fulfill({ status: 400, json: { error: "Please try again." } });
  });
  const dialog = await choosePromo(page);
  await dialog.getByRole("button", { name: "CONTINUE TO WHATSAPP" }).click();
  await requestStarted;
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  finish();
  await expect(dialog.getByRole("alert")).toHaveText("Please try again.");
});

test("a saved reservation remains usable when WhatsApp does not navigate", async ({
  page,
}) => {
  const reservations = [];
  await page.route("https://wa.me/**", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  await mockApi(page, (route, body) => {
    reservations.push(body);
    return route.fulfill({ json: { claim } });
  });
  const dialog = await choosePromo(page);
  await dialog.getByRole("button", { name: "CONTINUE TO WHATSAPP" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name: claim.code })).toBeVisible();
  const resend = page.getByRole("button", { name: "CONTINUE TO WHATSAPP" });
  await expect(resend).toBeEnabled();
  await resend.click();
  await expect.poll(() => reservations.length).toBe(2);
  expect(reservations.every((body) => body.reward_code_id === rewardId)).toBe(
    true,
  );
  expect(
    reservations.every(
      (body) => !("customer_name" in body) && !("phone" in body),
    ),
  ).toBe(true);
  await expect(resend).toBeEnabled();
});
