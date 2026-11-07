import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20261107055956_storefront_product_details.sql",
    import.meta.url,
  ),
  "utf8",
);
test("storefront migration preserves products, bounds specifications, and updates only hero copy", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create table handbags(id int primary key, name text, image_url text); insert into handbags values (1,'Existing bag','/images/day-tote.webp'); create table goove_settings(id boolean primary key, hero_heading text, hero_description text, hero_cta_text text, hero_image_url text, whatsapp_number text); insert into goove_settings values(true,'Old title','Old subtitle','Old CTA','/images/hero.webp','17176554737');`,
    );
    await db.exec(migration);
    await db.exec(migration);
    const { rows } = await db.query("select * from handbags");
    assert.deepEqual(rows, [
      {
        id: 1,
        name: "Existing bag",
        image_url: "/images/day-tote.webp",
        specifications: "",
      },
    ]);
    await db.query("update handbags set specifications=$1", ["x".repeat(1500)]);
    await assert.rejects(
      db.query("update handbags set specifications=$1", ["x".repeat(1501)]),
      /check constraint/,
    );
    const settings = (await db.query("select * from goove_settings")).rows[0];
    assert.equal(settings.hero_heading, "Elevate Your Elegance");
    assert.equal(
      settings.hero_description,
      "Luxury Women's Handbags with Exclusive Matching Gift",
    );
    assert.equal(settings.hero_image_url, "/images/hero.webp");
    assert.equal(settings.whatsapp_number, "17176554737");
  } finally {
    await db.close();
  }
});
