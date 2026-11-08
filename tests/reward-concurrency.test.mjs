import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";

const container = process.env.GOOVE_TEST_POSTGRES_CONTAINER;
let database = "postgres";
function sql(query, application = "goove_test") {
  return new Promise((resolve, reject) => {
    const process = spawn(
      "docker",
      [
        "exec",
        "-i",
        "-e",
        `PGAPPNAME=${application}`,
        container,
        "psql",
        "-U",
        "postgres",
        "-d",
        database,
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let output = "",
      error = "";
    process.stdout.on("data", (chunk) => (output += chunk));
    process.stderr.on("data", (chunk) => (error += chunk));
    process.on("error", reject);
    process.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(Error(error.trim())),
    );
    process.stdin.end(query);
  });
}
const reservation = (hash, reward, request) =>
  `set role service_role; select public.goove_select_reward('reserve','${hash}','${reward}','${request}');`;
const uuid = (n) => `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
const hash = (n) => n.toString(16).padStart(64, "0");

async function waitForState(application, condition) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (
      (await sql(
        `select exists(select 1 from pg_stat_activity where application_name='${application}' and ${condition});`,
      )) === "t"
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw Error(`Database session ${application} did not reach ${condition}`);
}

test(
  "real PostgreSQL serializes competing selections and keeps access refresh independent",
  { skip: !container, timeout: 45000 },
  async () => {
    const testDatabase = `goove_test_${Date.now()}_${process.pid}`;
    await sql(
      "do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if; end $$;",
    );
    await sql(`create database ${testDatabase};`);
    database = testDatabase;
    try {
      await sql(
        "create schema auth; create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),email_confirmed_at timestamptz,is_anonymous boolean default false,deleted_at timestamptz);",
      );
      await sql(
        await readFile(
          new URL("../supabase/schema.sql", import.meta.url),
          "utf8",
        ),
      );
      const migrationDir = new URL("../supabase/migrations/", import.meta.url);
      for (const file of (await readdir(migrationDir))
        .filter((file) => file.endsWith(".sql"))
        .sort())
        await sql(await readFile(new URL(file, migrationDir), "utf8"));
      await sql(
        `update goove_settings set legal_reviewed=true,promotion_enabled=true; insert into gift_types(id,name,description,active) values('${uuid(1)}','Concurrent gift','Test',true); insert into purchase_access_codes(code_hash,expires_at) values ${[1, 2, 3, 4, 5].map((n) => `('${hash(n)}',now()+interval '1 day')`).join(",")};`,
      );
      const reward = await sql(
        `select id from reward_codes where gift_type_id='${uuid(1)}';`,
      );

      const first = sql(
        `begin; ${reservation(hash(1), reward, uuid(101))} select pg_sleep(2); commit;`,
        "goove_first",
      );
      await waitForState("goove_first", "wait_event='PgSleep'");
      const second = sql(
        reservation(hash(2), reward, uuid(102)),
        "goove_second",
      );
      await waitForState("goove_second", "wait_event_type='Lock'");
      const [one, two] = await Promise.all([first, second]);
      const claimOne = JSON.parse(
        one.split("\n").find((line) => line.startsWith("{")),
      ).claim;
      const claimTwo = JSON.parse(two).claim;
      assert.notEqual(claimOne.code, claimTwo.code);
      assert.equal(
        await sql(
          "select count(*)=count(distinct selected_code) from reward_claims;",
        ),
        "t",
      );
      assert.equal(await sql("select count(*) from reward_claims;"), "2");

      const sameAccess = sql(
        `begin; ${reservation(hash(3), reward, uuid(103))} select pg_sleep(2); commit;`,
        "goove_same_first",
      );
      await waitForState("goove_same_first", "wait_event='PgSleep'");
      const duplicate = sql(
        reservation(hash(3), reward, uuid(104)),
        "goove_same_second",
      );
      // Attach the rejection handler before it can settle.
      const rejected = assert.rejects(duplicate, /already been used/);
      await waitForState("goove_same_second", "wait_event_type='Lock'");
      await Promise.all([sameAccess, rejected]);
      assert.equal(
        await sql(
          `select count(*) from reward_claims where purchase_access_code_id=(select id from purchase_access_codes where code_hash='${hash(3)}');`,
        ),
        "1",
      );

      const before = await sql("select code from reward_codes;");
      await sql(`select goove_refresh_access('${hash(6)}');`);
      assert.equal(await sql("select code from reward_codes;"), before);
      assert.equal(
        await sql(
          "select count(*) from purchase_access_codes where status='used';",
        ),
        "3",
      );
      await assert.rejects(
        sql(`select goove_select_reward('verify','${hash(1)}');`),
        /already been used/,
      );
      assert.equal(
        JSON.parse(await sql(reservation(hash(1), reward, uuid(101)))).claim
          .code,
        claimOne.code,
      );

      // Refresh waits for an in-flight selection, then preserves that used code.
      const fourth = sql(
        `begin; ${reservation(hash(6), reward, uuid(106))} select pg_sleep(2); commit;`,
        "goove_refresh_first",
      );
      await waitForState("goove_refresh_first", "wait_event='PgSleep'");
      const refreshing = sql(
        `select goove_refresh_access('${hash(7)}');`,
        "goove_refresh_second",
      );
      await waitForState("goove_refresh_second", "wait_event_type='Lock'");
      await Promise.all([fourth, refreshing]);
      assert.equal(
        await sql(
          `select status from purchase_access_codes where code_hash='${hash(6)}';`,
        ),
        "used",
      );
      assert.equal(await sql("select count(*) from reward_claims;"), "4");
    } finally {
      database = "postgres";
      await sql(`drop database ${testDatabase} with (force);`);
    }
  },
);
