import { test } from "node:test";
import assert from "node:assert/strict";
import { productLink, readProductTarget } from "../src/productLinks.js";

test("product links preserve the exact item and selected photo on the canonical storefront", () => {
  for (const id of [
    "signature",
    "12345678-1234-4234-8234-123456789abc",
    "bag & gift",
  ]) {
    for (let photoIndex = 0; photoIndex < 3; photoIndex++) {
      const href = productLink(id, photoIndex);
      assert.equal(new URL(href).origin, "https://goove.vercel.app");
      assert.deepEqual(readProductTarget(href), { id, photoIndex, open: true });
    }
  }
});

test("legacy bag anchors still work and malformed photo parameters fall back safely", () => {
  assert.equal(readProductTarget("https://goove.vercel.app/"), null);
  assert.equal(readProductTarget("https://goove.vercel.app/#bag-%ZZ"), null);
  assert.deepEqual(
    readProductTarget("https://goove.vercel.app/#bag-signature"),
    { id: "signature", photoIndex: 0, open: false },
  );
  for (const photo of ["0", "-1", "4", "1.5", "https://example.invalid"]) {
    assert.deepEqual(
      readProductTarget(
        `https://goove.vercel.app/?bag=signature&photo=${photo}`,
      ),
      { id: "signature", photoIndex: 0, open: true },
    );
  }
});
