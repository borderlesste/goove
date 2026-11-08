import { test, expect } from "@playwright/test";

test("owners can upload and save ten ordered photos and cannot add an eleventh", async ({
  page,
}) => {
  const user = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "owner@example.test",
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
  await page.route("**/auth/v1/token?*", (route) =>
    route.fulfill({
      json: {
        access_token: token,
        refresh_token: "test-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      },
    }),
  );
  const original = [
    "/images/day-tote.webp",
    "/images/signature.webp",
    "/images/shoulder.webp",
  ];
  let item = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Gallery bag",
    description: "Owner gallery test",
    image_url: original[0],
    gallery_images: original,
    price: 45,
    in_stock: true,
  };
  let uploads = 0,
    saved;
  await page.route("**/storage/v1/object/upload/sign/**", (route) =>
    route.fulfill({ json: {} }),
  );
  await page.route("**/functions/v1/goove-api", (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "admin_upload") {
      uploads += 1;
      return route.fulfill({
        json: {
          path: `test-${uploads}.png`,
          token: "test-upload",
          public_url: `https://goove-test.supabase.co/storage/v1/object/public/goove-images/test-${uploads}.png`,
        },
      });
    }
    if (body.action === "admin_save") {
      saved = body.item;
      item = body.item;
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({
      json: {
        handbags: [item],
        gifts: [],
        reward_codes: [],
        access_codes: [],
        claims: [],
        settings: { business_name: "Goove", social_links: [] },
      },
    });
  });
  await page.goto("/admin");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "SIGN IN", exact: true }).click();
  await page.getByRole("tab", { name: "Handbags", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const upload = page.getByLabel(/Upload gallery photos/);
  const photo = {
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  };
  await upload.setInputFiles(
    Array.from({ length: 7 }, (_, i) => ({ ...photo, name: `photo-${i}.png` })),
  );
  await expect(page.getByText(/Current count: 10\./)).toBeVisible();
  expect(uploads).toBe(7);
  await upload.setInputFiles({ ...photo, name: "eleventh.png" });
  await expect(page.getByRole("alert")).toContainText(
    "up to 10 gallery photos",
  );
  expect(uploads).toBe(7);
  await page.getByRole("button", { name: /SAVE/, exact: false }).click();
  await expect(page.getByRole("status")).toContainText("Saved successfully");
  expect(saved.gallery_images).toHaveLength(10);
  expect(saved.gallery_images.slice(0, 3)).toEqual(original);
  expect(saved.gallery_images[9]).toContain("test-7.png");
});
