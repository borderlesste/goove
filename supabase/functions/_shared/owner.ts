import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2.117.3";
import { HttpError } from "./http.ts";

const value = ({ data, error }: any) => {
  if (error) throw Error(error.message);
  return data;
};

// Identity is fetched live by the caller; privileges come only from server data.
export async function authorizeOwner(db: SupabaseClient, user: User) {
  if (!user.email_confirmed_at || !user.email || user.is_anonymous) {
    throw new HttpError(
      403,
      "Please confirm your email before accessing the owner studio.",
    );
  }
  let allowed = value(
    await db
      .from("goove_owners")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  );
  if (!allowed) {
    const invite = value(
      await db
        .from("goove_owner_invitations")
        .select("email")
        .eq("email", user.email.toLowerCase())
        .maybeSingle(),
    );
    if (invite) {
      value(await db.from("goove_owners").upsert({ user_id: user.id }));
      allowed = { user_id: user.id };
    }
  }
  if (!allowed) {
    throw new HttpError(
      403,
      "This account needs an owner invitation. Please contact the administrator.",
    );
  }
  return user.id;
}
