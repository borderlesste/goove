import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizeOwner } from "../supabase/functions/_shared/owner.ts";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "Owner@Example.test",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  is_anonymous: false,
};
function database(owners = [], invitations = []) {
  const allowed = new Set(owners);
  return {
    allowed,
    from(table) {
      return {
        select() {
          return {
            eq(column, value) {
              return {
                async maybeSingle() {
                  return {
                    error: null,
                    data:
                      table === "goove_owners"
                        ? allowed.has(value)
                          ? { user_id: value }
                          : null
                        : invitations.includes(value)
                          ? { email: value }
                          : null,
                  };
                },
              };
            },
          };
        },
        async upsert({ user_id }) {
          allowed.add(user_id);
          return { data: null, error: null };
        },
      };
    },
  };
}

test("a confirmed administrator is authorized through its database membership", async () => {
  assert.equal(await authorizeOwner(database([user.id]), user), user.id);
});

test("an administrator slot does not bypass email confirmation or permit anonymous access", async () => {
  for (const identity of [
    { ...user, email_confirmed_at: null },
    { ...user, is_anonymous: true },
  ]) {
    await assert.rejects(
      authorizeOwner(database([user.id]), identity),
      (error) =>
        error.status === 403 && /confirm your email/.test(error.message),
    );
  }
});

test("a later account needs a trusted invitation and cannot self-promote using metadata", async () => {
  const db = database();
  await assert.rejects(
    authorizeOwner(db, {
      ...user,
      user_metadata: { role: "admin" },
      app_metadata: { role: "admin" },
    }),
    (error) => error.status === 403 && /invitation/.test(error.message),
  );
  assert.equal(db.allowed.size, 0);
  const invited = database([], [user.email.toLowerCase()]);
  assert.equal(await authorizeOwner(invited, user), user.id);
  assert.ok(invited.allowed.has(user.id));
});
