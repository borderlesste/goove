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
  const buttons = page.getByRole("button", { name: /^Select promo / });
  await expect(buttons.nth(1)).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
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

test("the first rewards action focuses access and lets customers switch codes", async ({
  page,
}) => {
  const verified = [];
  await page.route("**/functions/v1/goove-api", (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "catalog") return route.fulfill({ json: catalog });
    verified.push(body);
    return route.fulfill({
      json: {
        codes: [{ id: rewardId, code: "GIFT-••••••••", status: "available" }],
      },
    });
  });
  await page.goto("/rewards");
  await page
    .getByRole("button", { name: "ENTER ACCESS CODE", exact: true })
    .click();
  const access = page.getByLabel("Access code", { exact: true });
  await expect(access).toBeFocused();
  await access.fill("  goove-" + "a".repeat(48) + "  ");
  await expect(access).toHaveValue("GOOVE-" + "A".repeat(48));
  await page.getByRole("button", { name: "VIEW MY PROMO CODES" }).click();
  await expect(
    page.getByRole("heading", { name: "Promo codes" }),
  ).toBeFocused();
  await expect(page.getByRole("status")).toHaveText("1 promo is available.");
  expect(verified).toEqual([
    { action: "verify", access_code: "GOOVE-" + "A".repeat(48) },
  ]);
  await page
    .getByRole("button", { name: "Use a different access code" })
    .click();
  await expect(access).toHaveValue("");
  await expect(access).toBeFocused();
  await expect(
    page
      .getByRole("list", { name: "Reward progress" })
      .locator('[aria-current="step"]'),
  ).toHaveText("1Access code");
});

test("contact validation rejects blank names and phones without digits before reserving", async ({
  page,
}) => {
  let reservations = 0;
  await mockApi(page, (route) => {
    reservations += 1;
    return route.fulfill({ json: { claim } });
  });
  const dialog = await choosePromo(page);
  const name = dialog.getByLabel("Name", { exact: true });
  const phone = dialog.getByLabel("Phone number", { exact: true });
  const submit = dialog.getByRole("button", { name: "CONTINUE TO WHATSAPP" });
  await name.fill("  ");
  await submit.click();
  await expect(name).toBeFocused();
  expect(await name.evaluate((input) => input.validationMessage)).toContain(
    "at least two characters",
  );
  await name.fill("Test Customer");
  await phone.fill("-------");
  await submit.click();
  await expect(phone).toBeFocused();
  expect(await phone.evaluate((input) => input.validationMessage)).toContain(
    "7 to 15 digits",
  );
  expect(reservations).toBe(0);
  await phone.fill("letters!");
  expect(await phone.evaluate((input) => input.checkValidity())).toBe(false);
  await phone.fill("(717) 555-0100");
  expect(await phone.evaluate((input) => input.checkValidity())).toBe(true);
});

test("Owner access opens the studio and protects an in-flight sign-in", async ({
  page,
}) => {
  let finish;
  let started;
  const requested = new Promise((resolve) => {
    started = resolve;
  });
  const ready = new Promise((resolve) => {
    finish = resolve;
  });
  await mockApi(page, (route) => route.fulfill({ json: {} }));
  await page.route("**/auth/v1/token?*", async (route) => {
    started(route.request().postDataJSON());
    await ready;
    return route.fulfill({
      status: 400,
      json: {
        error_code: "invalid_credentials",
        msg: "Invalid login credentials",
      },
    });
  });
  await page.goto("/rewards");
  await page.getByRole("link", { name: "Owner access", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const password = page.getByLabel("Password", { exact: true });
  await page.getByLabel("Email address").fill("owner@example.test");
  await password.fill("test-password-only");
  await page.getByRole("checkbox", { name: "Show password" }).check();
  await expect(password).toHaveAttribute("type", "text");
  const setup = page.getByRole("button", {
    name: "First time? Set up your owner account",
  });
  await page.getByRole("button", { name: "SIGN IN", exact: true }).click();
  const body = await requested;
  expect(body.email).toBe("owner@example.test");
  await expect(password).toBeDisabled();
  await expect(setup).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "SIGNING IN…", exact: true }),
  ).toBeDisabled();
  finish();
  await expect(page.getByRole("alert")).toHaveText("Invalid login credentials");
  await expect(password).toBeEnabled();
  await setup.click();
  await expect(
    page.getByRole("heading", { name: "Set up owner access" }),
  ).toBeVisible();
  await expect(password).toHaveValue("");
  await expect(password).toHaveAttribute("type", "password");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("signup sends credentials to Auth and explains first-account administrator access", async ({
  page,
}) => {
  let signup;
  let redirectTo;
  let adminRequests = 0;
  await mockApi(page, (route) => {
    adminRequests += 1;
    return route.fulfill({ json: {} });
  });
  await page.route("**/auth/v1/signup*", (route) => {
    signup = route.request().postDataJSON();
    redirectTo = new URL(route.request().url()).searchParams.get("redirect_to");
    return route.fulfill({
      json: {
        user: {
          id: "44444444-4444-4444-8444-444444444444",
          email: signup.email,
          identities: [],
        },
        session: null,
      },
    });
  });
  await page.goto("/admin");
  await page
    .getByRole("button", { name: "First time? Set up your owner account" })
    .click();
  await expect(page.locator("#owner-help")).toContainText(
    "The first registered account is the administrator.",
  );
  await page.getByLabel("Email address").fill("new-owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .getByRole("button", { name: "CREATE OWNER ACCOUNT", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "first registered account receives administrator access automatically",
  );
  expect(signup.email).toBe("new-owner@example.test");
  expect(redirectTo).toBe("https://goove.vercel.app/");
  expect(signup.password).toBe("test-password-only");
  expect(signup).not.toHaveProperty("role");
  expect(signup.data || {}).not.toHaveProperty("role");
  expect(adminRequests).toBe(0);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
});

test("an existing owner session stays in a loading state until the server authorizes it", async ({
  page,
}) => {
  const user = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "owner@example.test",
  };
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
    Buffer.from(JSON.stringify({ sub: user.id, exp: expiresAt })).toString(
      "base64url",
    ),
    "test-signature",
  ].join(".");
  await page.addInitScript(
    (session) =>
      localStorage.setItem("sb-goove-test-auth-token", JSON.stringify(session)),
    {
      access_token: token,
      refresh_token: "test-refresh",
      expires_at: expiresAt,
      expires_in: 3600,
      token_type: "bearer",
      user,
    },
  );
  let finish;
  let started;
  const requested = new Promise((resolve) => {
    started = resolve;
  });
  const ready = new Promise((resolve) => {
    finish = resolve;
  });
  await mockApi(page, async (route, body) => {
    expect(body.action).toBe("admin_list");
    started();
    await ready;
    return route.fulfill({
      json: { ...catalog, claims: [], reward_codes: [], access_codes: [] },
    });
  });
  await page.goto("/admin");
  await requested;
  await expect(page.getByRole("status")).toHaveText(
    "Checking your owner session…",
  );
  await expect(page.getByLabel("Email address")).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Claims", exact: true }),
  ).toHaveCount(0);
  finish();
  await expect(
    page.getByRole("tab", { name: "Claims", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
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
