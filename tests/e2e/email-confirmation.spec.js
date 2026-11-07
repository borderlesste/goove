import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/functions/v1/goove-api", (route) =>
    route.fulfill({
      json: {
        handbags: [],
        gifts: [],
        settings: { business_name: "Goove", social_links: [] },
      },
    }),
  );
});

test("expired links display a safe explanation and remove callback details", async ({
  page,
}) => {
  await page.goto(
    "/#error=access_denied&error_code=otp_expired&error_description=UNTRUSTED_DESCRIPTION&sb=tracking",
  );
  await expect(page.getByRole("alert")).toContainText(
    "expired or has already been used",
  );
  await expect(page.getByText("UNTRUSTED_DESCRIPTION")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("link", { name: "Continue to owner access" }).click();
  await expect(page.getByLabel("Email address")).toBeVisible();
});

test("a URL flag cannot claim confirmation", async ({ page }) => {
  await page.goto("/?verified=true#type=signup");
  await expect(page.getByRole("alert")).toContainText(
    "We could not confirm your email",
  );
  await expect(
    page.getByText("Your email is confirmed.", { exact: false }),
  ).toHaveCount(0);
});

for (const confirmed of [true, false]) {
  test(`signup callback ${confirmed ? "confirms" : "rejects"} the live Auth identity`, async ({
    page,
  }) => {
    const user = {
      id: "33333333-3333-4333-8333-333333333333",
      email: "owner@example.test",
      email_confirmed_at: confirmed ? "2026-01-01T00:00:00Z" : null,
      is_anonymous: false,
    };
    const token = [
      Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
      Buffer.from(
        JSON.stringify({
          sub: user.id,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url"),
      "test-signature",
    ].join(".");
    await page.route("**/auth/v1/user", (route) =>
      route.fulfill({ json: user }),
    );
    await page.goto(
      `/#access_token=${token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
    );
    if (confirmed) {
      await expect(page.getByRole("status")).toContainText(
        "Your email is confirmed.",
      );
    } else {
      await expect(page.getByRole("alert")).toContainText(
        "We could not confirm your email",
      );
    }
    await expect(page).toHaveURL(/\/$/);
  });
}

test("confirmation can be resent without a password and uses the canonical URL", async ({
  page,
}) => {
  let request;
  let redirectTo;
  let finish;
  const ready = new Promise((resolve) => {
    finish = resolve;
  });
  await page.route("**/auth/v1/resend*", async (route) => {
    request = route.request().postDataJSON();
    redirectTo = new URL(route.request().url()).searchParams.get("redirect_to");
    await ready;
    await route.fulfill({ json: {} });
  });
  await page.goto("/admin");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page
    .getByRole("button", { name: "Resend confirmation email", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sending confirmation…" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "SIGN IN", exact: true }),
  ).toBeDisabled();
  finish();
  await expect(page.getByRole("status")).toContainText(
    "If this account needs confirmation",
  );
  expect(request).toMatchObject({
    type: "signup",
    email: "owner@example.test",
    gotrue_meta_security: {},
  });
  expect(redirectTo).toBe("https://goove.vercel.app/");
});

test("resend validates email and recovers from delivery errors", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/auth/v1/resend*", (route) => {
    attempts += 1;
    return route.fulfill({
      status: 429,
      json: { msg: "PRIVATE_PROVIDER_DETAIL" },
    });
  });
  await page.goto("/admin");
  const resend = page.getByRole("button", {
    name: "Resend confirmation email",
    exact: true,
  });
  await resend.click();
  await expect(page.getByLabel("Email address")).toBeFocused();
  expect(attempts).toBe(0);
  await page.getByLabel("Email address").fill("owner@example.test");
  await resend.click();
  await expect(page.getByRole("alert")).toContainText(
    "We could not send a confirmation link",
  );
  await expect(page.getByText("PRIVATE_PROVIDER_DETAIL")).toHaveCount(0);
  await expect(resend).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "SIGN IN", exact: true }),
  ).toBeEnabled();
  expect(attempts).toBe(1);
});
