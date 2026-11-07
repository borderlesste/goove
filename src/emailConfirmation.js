export const EMAIL_CONFIRMATION_URL = "https://goove.vercel.app/";

export function readEmailConfirmation(url) {
  const params = new URLSearchParams(new URL(url).hash.slice(1));
  if (params.has("error") || params.has("error_code")) {
    return params.get("error_code") === "otp_expired" ? "expired" : "error";
  }
  if (params.get("type") !== "signup") return null;
  return params.get("access_token") && params.get("refresh_token")
    ? "pending"
    : "error";
}

export async function confirmEmailReturn(auth, callback) {
  if (callback !== "pending") return callback;
  if (!auth) return "error";
  try {
    // Await the SDK's URL processing before checking the live Auth identity.
    const session = await auth.getSession();
    if (session.error || !session.data.session) return "error";
    const { data, error } = await auth.getUser();
    return !error &&
      data.user?.id === session.data.session.user.id &&
      data.user.email &&
      data.user.email_confirmed_at &&
      !data.user.is_anonymous
      ? "confirmed"
      : "error";
  } catch {
    return "error";
  }
}
