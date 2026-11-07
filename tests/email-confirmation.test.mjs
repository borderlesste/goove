import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMAIL_CONFIRMATION_URL,
  readEmailConfirmation,
  confirmEmailReturn,
} from "../src/emailConfirmation.js";

test("confirmation identifies signup returns without trusting URL success flags", () => {
  assert.equal(EMAIL_CONFIRMATION_URL, "https://goove.vercel.app/");
  for (const suffix of ["", "#bag-mini", "?verified=true", "#type=recovery"]) {
    assert.equal(readEmailConfirmation(EMAIL_CONFIRMATION_URL + suffix), null);
  }
  assert.equal(
    readEmailConfirmation(EMAIL_CONFIRMATION_URL + "#type=signup"),
    "error",
  );
  assert.equal(
    readEmailConfirmation(
      EMAIL_CONFIRMATION_URL + "#error=access_denied&error_code=otp_expired",
    ),
    "expired",
  );
  assert.equal(
    readEmailConfirmation(
      EMAIL_CONFIRMATION_URL +
        "#error=access_denied&error_description=untrusted",
    ),
    "error",
  );
  assert.equal(
    readEmailConfirmation(
      EMAIL_CONFIRMATION_URL +
        "#type=signup&access_token=test&refresh_token=test",
    ),
    "pending",
  );
});

const user = {
  id: "owner-id",
  email: "owner@example.test",
  email_confirmed_at: "2026-01-01T00:00:00Z",
};
const auth = (identity = user) => ({
  async getSession() {
    return { data: { session: { user } }, error: null };
  },
  async getUser() {
    return { data: { user: identity }, error: null };
  },
});

test("confirmation requires a live matching, confirmed, non-anonymous identity", async () => {
  assert.equal(await confirmEmailReturn(auth(), "pending"), "confirmed");
  for (const identity of [
    null,
    { ...user, email_confirmed_at: null },
    { ...user, is_anonymous: true },
    { ...user, id: "other-id" },
  ]) {
    assert.equal(await confirmEmailReturn(auth(identity), "pending"), "error");
  }
  assert.equal(await confirmEmailReturn(null, "pending"), "error");
  assert.equal(
    await confirmEmailReturn(
      {
        async getSession() {
          throw Error("offline");
        },
      },
      "pending",
    ),
    "error",
  );
  assert.equal(
    await confirmEmailReturn(
      {
        async getSession() {
          return { error: Error("invalid token") };
        },
      },
      "pending",
    ),
    "error",
  );
  // An expired URL must not report success from an existing session.
  assert.equal(await confirmEmailReturn(auth(), "expired"), "expired");
  assert.equal(await confirmEmailReturn(auth(), null), null);
});
