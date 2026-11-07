import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20261107042500_bootstrap_first_administrator.sql",
    import.meta.url,
  ),
  "utf8",
);
const ids = [1, 2, 3, 4].map(
  (n) => `${String(n).repeat(8)}-1111-4111-8111-111111111111`,
);
async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create role supabase_auth_admin;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, created_at timestamptz default now(),
      email_confirmed_at timestamptz, deleted_at timestamptz,
      is_anonymous boolean default false, raw_user_meta_data jsonb default '{}'
    );
    create table public.goove_owners (user_id uuid primary key references auth.users(id) on delete cascade);
    alter table public.goove_owners enable row level security;
    revoke all on public.goove_owners from public, anon, authenticated;
    grant usage on schema auth to supabase_auth_admin;
    grant insert on auth.users to supabase_auth_admin;
  `);
  return db;
}

test("the first real signup gets the administrator row through the Auth trigger only once", async () => {
  const db = await fixture();
  try {
    await db.exec(migration);
    await db.exec("set role supabase_auth_admin");
    await db.query("insert into auth.users(id,is_anonymous) values($1,true)", [
      ids[0],
    ]);
    await db.query(
      "insert into auth.users(id,email) values($1,'first@example.test')",
      [ids[1]],
    );
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,'next@example.test','{\"role\":\"admin\"}')",
      [ids[2]],
    );
    await db.exec("reset role");
    assert.deepEqual(
      (await db.query("select user_id from goove_owners")).rows,
      [{ user_id: ids[1] }],
    );
    await db.exec(migration);
    assert.deepEqual(
      (await db.query("select user_id from goove_owners")).rows,
      [{ user_id: ids[1] }],
    );
    await db.query("delete from auth.users where id=$1", [ids[1]]);
    await db.query(
      "insert into auth.users(id,email) values($1,'later@example.test')",
      [ids[3]],
    );
    assert.equal((await db.query("select * from goove_owners")).rows.length, 0);
    assert.equal(
      (
        await db.query(
          "select user_id from goove_private.initial_administrator",
        )
      ).rows[0].user_id,
      null,
    );
    await db.exec(migration);
    assert.equal(
      (await db.query("select * from goove_owners")).rows.length,
      0,
      "reinstalling must not reopen setup after deletion",
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query("select * from goove_private.initial_administrator"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select goove_private.bootstrap_first_administrator()"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("insert into goove_owners values($1)", [ids[3]]),
        /permission denied/,
      );
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});

test("backfill chooses the earliest registration rather than the first confirmed or signed-in account", async () => {
  const db = await fixture();
  try {
    await db.query(
      "insert into auth.users(id,email,created_at) values($1,'earliest@example.test','2026-01-01')",
      [ids[0]],
    );
    await db.query(
      "insert into auth.users(id,email,created_at,email_confirmed_at) values($1,'confirmed@example.test','2026-01-02',now())",
      [ids[1]],
    );
    await db.exec(migration);
    assert.deepEqual(
      (await db.query("select user_id from goove_owners")).rows,
      [{ user_id: ids[0] }],
    );
    await db.query("delete from goove_owners where user_id=$1", [ids[0]]);
    await db.exec(migration);
    assert.equal(
      (await db.query("select * from goove_owners")).rows.length,
      0,
      "reinstalling must preserve an explicit access revocation",
    );
  } finally {
    await db.close();
  }
});

test("a rolled-back signup cannot consume the initial administrator slot", async () => {
  const db = await fixture();
  try {
    await db.exec(migration);
    await db.exec("begin");
    await db.query(
      "insert into auth.users(id,email) values($1,'rolled-back@example.test')",
      [ids[0]],
    );
    await db.exec("rollback");
    await Promise.all(
      ids
        .slice(1)
        .map((id, index) =>
          db.query("insert into auth.users(id,email) values($1,$2)", [
            id,
            `signup-${index}@example.test`,
          ]),
        ),
    );
    assert.equal((await db.query("select * from goove_owners")).rows.length, 1);
    assert.equal(
      (await db.query("select * from goove_private.initial_administrator")).rows
        .length,
      1,
    );
  } finally {
    await db.close();
  }
});
