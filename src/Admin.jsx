import React, { useEffect, useRef, useState } from "react";
import { callApi, supabase, configured } from "./api";
import { SignOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { DownloadSimple } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Trash } from "@phosphor-icons/react/dist/csr/Trash";
import { UploadSimple } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { SpinnerGap } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { formatPromoActiveAt } from "./dateTime";
import { EMAIL_CONFIRMATION_URL } from "./emailConfirmation";
const money = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value),
  );
export function Admin({ onCatalogChange }) {
  const sessionVersion = useRef(0);
  const emailInput = useRef(null);
  const [data, setData] = useState(null),
    [tab, setTab] = useState("Claims"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [checkingSession, setCheckingSession] = useState(Boolean(supabase)),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [resending, setResending] = useState(false),
    [refreshingAccess, setRefreshingAccess] = useState(false),
    [notice, setNotice] = useState(""),
    [editing, setEditing] = useState(null),
    [generated, setGenerated] = useState(""),
    [refreshedPromo, setRefreshedPromo] = useState(null),
    [signup, setSignup] = useState(false),
    [historyCode, setHistoryCode] = useState(""),
    [historyResult, setHistoryResult] = useState(null);
  async function refresh(version = sessionVersion.current) {
    if (version !== sessionVersion.current) return;
    const d = await callApi("admin_list");
    if (version === sessionVersion.current) setData(d);
  }
  async function act(action, payload = {}) {
    const version = sessionVersion.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const d = await callApi(action, payload);
      if (version !== sessionVersion.current) return;
      await refresh(version);
      if (version !== sessionVersion.current) return;
      onCatalogChange();
      setNotice("Saved successfully.");
      return d;
    } catch (e) {
      if (version === sessionVersion.current) setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function refreshAccess() {
    if (busy || refreshingAccess) return;
    const version = sessionVersion.current;
    setRefreshingAccess(true);
    setGenerated("");
    setError("");
    setNotice("");
    try {
      const result = await callApi("admin_refresh_access");
      if (version !== sessionVersion.current) return;
      setGenerated(result.code);
      if (result.access_codes)
        setData(
          (current) =>
            current && { ...current, access_codes: result.access_codes },
        );
    } catch (e) {
      if (version === sessionVersion.current) setError(e.message);
    } finally {
      setRefreshingAccess(false);
    }
  }
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const version = sessionVersion.current;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        sessionVersion.current += 1;
        setData(null);
        setEditing(null);
        setGenerated("");
        setRefreshedPromo(null);
        setHistoryResult(null);
        setHistoryCode("");
        setPassword("");
        setShowPassword(false);
        setNotice("");
      }
    });
    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!active || version !== sessionVersion.current) return;
        if (error) throw error;
        if (data.session) await refresh(version);
      })
      .catch(
        (e) =>
          active && version === sessionVersion.current && setError(e.message),
      )
      .finally(() => active && setCheckingSession(false));
    return () => {
      active = false;
      sessionVersion.current += 1;
      subscription.unsubscribe();
    };
  }, []);
  async function login(e) {
    e.preventDefault();
    if (busy || resending) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!supabase)
        throw Error(
          "Owner access will be available once the Supabase project is connected.",
        );
      if (signup) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: EMAIL_CONFIRMATION_URL },
        });
        if (error) throw error;
        setNotice(
          "Check your email to confirm your account. The link returns to goove.vercel.app; choose Continue to owner access to sign in. The first registered account receives administrator access automatically; additional owners need an invitation.",
        );
        setSignup(false);
        setPassword("");
        setShowPassword(false);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      await refresh();
      setPassword("");
      setShowPassword(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function resendConfirmation() {
    if (busy || resending || !emailInput.current.reportValidity()) return;
    setResending(true);
    setError("");
    setNotice("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: EMAIL_CONFIRMATION_URL },
      });
      if (error) throw error;
      setNotice(
        "If this account needs confirmation, a new link will arrive by email. Open the latest link to return to goove.vercel.app.",
      );
    } catch {
      setError(
        "We could not send a confirmation link. Please wait a moment and try again.",
      );
    } finally {
      setResending(false);
    }
  }
  async function exportRecords() {
    setBusy(true);
    setError("");
    try {
      const d = await callApi("admin_export");
      const fields = [
        "customer_name",
        "code",
        "benefit",
        "purchase_reference",
        "status",
        "created_at",
        "activated_at",
        "expires_at",
      ];
      const cell = (v) =>
        '"' +
        String(v ?? "")
          .replace(/^[=+@\-\t\r]/, "'$&")
          .replaceAll('"', '""') +
        '"';
      const csv = [fields, ...d.rows.map((r) => fields.map((f) => r[f]))]
        .map((row) => row.map(cell).join(","))
        .join("\r\n");
      const url = URL.createObjectURL(
        new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "goove-reward-records.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function searchPromo(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setHistoryResult(null);
    try {
      const d = await callApi("admin_search_promo_code", {
        code: historyCode.trim(),
      });
      setHistoryResult(d.result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const promotionsWithoutCode = data?.gifts.filter(
    (g) => g.active && !data.reward_codes.some((c) => c.gift_type_id === g.id),
  );
  if (checkingSession)
    return (
      <p className="owner-session" role="status">
        <SpinnerGap className="spin" aria-hidden="true" /> Checking your owner
        session…
      </p>
    );
  if (!data)
    return (
      <div className="admin-login">
        <h2 className="owner-login-title">
          {signup ? "Set up owner access" : "Welcome back"}
        </h2>
        <p>
          {signup
            ? "Create your account and confirm your email."
            : "Sign in to manage your collection and customer rewards."}
        </p>
        <p className="fine" id="owner-help">
          {signup
            ? "The first registered account is the administrator. Additional owners need an invitation from the administrator."
            : "For the administrator and invited owners. Customer reward access codes are entered on Gifts & Rewards."}
        </p>
        <form
          onSubmit={login}
          aria-busy={busy || resending}
          aria-describedby={error ? "owner-help owner-error" : "owner-help"}
        >
          <label htmlFor="owner-email">Email address</label>
          <input
            id="owner-email"
            ref={emailInput}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            disabled={busy || resending}
            autoCapitalize="none"
            spellCheck="false"
          />
          <label htmlFor="owner-password">Password</label>
          <input
            id="owner-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={signup ? 8 : 1}
            autoComplete={signup ? "new-password" : "current-password"}
            disabled={busy || resending}
          />
          <label className="checkbox owner-show-password">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              disabled={busy || resending}
            />{" "}
            Show password
          </label>
          <button disabled={busy || resending || !configured}>
            {busy
              ? signup
                ? "CREATING ACCOUNT…"
                : "SIGNING IN…"
              : signup
                ? "CREATE OWNER ACCOUNT"
                : "SIGN IN"}
          </button>
        </form>
        <button
          className="quiet"
          disabled={busy || resending || !configured}
          onClick={() => {
            setSignup(!signup);
            setError("");
            setNotice("");
            setPassword("");
            setShowPassword(false);
          }}
        >
          {signup
            ? "Already registered? Sign in"
            : "First time? Set up your owner account"}
        </button>
        {!signup && (
          <button
            className="quiet"
            disabled={busy || resending || !configured}
            onClick={resendConfirmation}
          >
            {resending ? "Sending confirmation…" : "Resend confirmation email"}
          </button>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {!configured && (
          <p className="fine">Owner access is awaiting secure setup.</p>
        )}
        {error && (
          <p role="alert" className="error" id="owner-error">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <div className="admin">
      <div className="admin-toolbar">
        <p>Your private collection studio.</p>
        <button className="quiet" onClick={signOut} disabled={busy}>
          <SignOut /> Sign out
        </button>
      </div>
      <div className="admin-tabs" role="tablist">
        {["Claims", "Handbags", "Gifts", "Codes", "Settings"].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => {
              setTab(t);
              setEditing(null);
              setNotice("");
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {tab === "Claims" && (
        <>
          <div className="admin-toolbar">
            <h3>Customer rewards</h3>
            <button
              className="secondary small"
              disabled={busy}
              onClick={exportRecords}
            >
              <DownloadSimple /> Export CSV
            </button>
          </div>
          <div className="admin-rows">
            {data.claims.map((c) => (
              <article key={c.id}>
                <strong>{c.customer_name || "WhatsApp customer"}</strong>
                <p>
                  {c.code} · {c.benefit}
                  <br />
                  <small>
                    {c.purchase_reference || "No purchase reference"} ·{" "}
                    {new Date(c.created_at).toLocaleString("en-US")}
                  </small>
                </p>
                <p className="fine">
                  {c.expires_at
                    ? `Expires ${new Date(c.expires_at).toLocaleString("en-US")}`
                    : "Not activated"}
                </p>
                <label>
                  Status
                  <select
                    aria-label={`Status for ${c.code}`}
                    value={c.status}
                    disabled={busy}
                    onChange={(e) =>
                      act("admin_claim_status", {
                        id: c.id,
                        status: e.target.value,
                      })
                    }
                  >
                    {[
                      "pending_verification",
                      "verified",
                      "fulfilled",
                      "expired",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </article>
            ))}
          </div>
          {!data.claims.length && (
            <p className="empty">Customer registrations will appear here.</p>
          )}
        </>
      )}
      {["Handbags", "Gifts"].includes(tab) && (
        <>
          <div className="admin-toolbar">
            <h3>
              {tab === "Handbags" ? "Your collection" : "Available gifts"}
            </h3>
            <button
              className="secondary small"
              onClick={() =>
                setEditing({
                  name: "",
                  description: "",
                  image_url: "",
                  price: "",
                  gallery_images: [],
                  display_order: 0,
                  in_stock: true,
                  active: true,
                  discount_percent: 0,
                })
              }
            >
              <Plus /> Add {tab === "Handbags" ? "handbag" : "gift"}
            </button>
          </div>
          {editing ? (
            <Editor
              item={editing}
              type={tab}
              busy={busy}
              onCancel={() => setEditing(null)}
              onSave={async (item) => {
                if (
                  await act("admin_save", {
                    table: tab === "Handbags" ? "handbags" : "gift_types",
                    item,
                  })
                )
                  setEditing(null);
              }}
              onError={setError}
            />
          ) : (
            <div className="admin-rows">
              {(tab === "Handbags" ? data.handbags : data.gifts).map((b) => (
                <article className="catalog-row" key={b.id}>
                  {b.image_url && <img src={b.image_url} alt="" />}
                  <div>
                    <strong>{b.name}</strong>
                    <p>{b.description}</p>
                    <small>
                      {tab === "Handbags"
                        ? Number(b.price) > 0
                          ? "Price " + money(b.price)
                          : "Price not set"
                        : `${b.gallery_images?.length || 0} gallery photos`}
                    </small>
                    {tab === "Handbags" && (
                      <>
                        <small
                          className={
                            b.in_stock === false
                              ? "stock-admin"
                              : "stock-available"
                          }
                        >
                          {b.in_stock === false
                            ? "Out of stock · customers cannot order"
                            : "In stock · customers can order"}
                        </small>
                        <button
                          className="stock-toggle"
                          disabled={busy}
                          onClick={() =>
                            act("admin_handbag_stock", {
                              id: b.id,
                              in_stock: b.in_stock === false,
                            })
                          }
                        >
                          {b.in_stock === false
                            ? "MARK IN STOCK"
                            : "MARK OUT OF STOCK"}
                        </button>
                      </>
                    )}
                    {b.active === false && <small>Hidden from customers</small>}
                    {tab === "Gifts" && (
                      <button
                        className="quiet"
                        disabled={busy}
                        onClick={() =>
                          act("admin_save", {
                            table: "gift_types",
                            item: { ...b, active: !b.active },
                          })
                        }
                      >
                        {b.active ? "Hide from customers" : "Make available"}
                      </button>
                    )}
                    <button className="quiet" onClick={() => setEditing(b)}>
                      Edit
                    </button>
                    {tab === "Handbags" && (
                      <button
                        className="quiet"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Remove ${b.name} from the gallery?`))
                            act("admin_delete_handbag", { id: b.id });
                        }}
                      >
                        <Trash /> Remove
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {tab === "Codes" && (
        <>
          <h3>Customer access code</h3>
          <p>
            Refresh to create a new access code. Only the previous unused code
            is disabled; used codes cannot be used again. Promo codes are
            unchanged.
          </p>
          <button disabled={busy || refreshingAccess} onClick={refreshAccess}>
            {refreshingAccess
              ? "REFRESHING ACCESS CODE…"
              : "REFRESH ACCESS CODE"}
          </button>
          {generated && (
            <div className="generated">
              <p>
                Copy this code and share it with a customer. It is shown only
                now.
              </p>
              <code>{generated}</code>
              <button
                className="secondary small"
                onClick={() =>
                  navigator.clipboard
                    .writeText(generated)
                    .then(() => setNotice("Access code copied."))
                    .catch(() => setError("Select and copy the code manually."))
                }
              >
                Copy code
              </button>
            </div>
          )}
          <h3>Promo code inventory</h3>
          <p>
            Each customer use is recorded permanently, then the displayed code
            is replaced automatically. Refreshing codes here only changes unused
            codes.
          </p>
          {promotionsWithoutCode.length ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  gift_type_id = f.get("gift"),
                  d = await act("admin_generate_rewards", { gift_type_id });
                if (d?.code)
                  setRefreshedPromo({ id: gift_type_id, code: d.code });
              }}
            >
              <label>
                Promotion
                <select name="gift" required>
                  {promotionsWithoutCode.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={busy}>GENERATE ONE PROMO CODE</button>
            </form>
          ) : (
            <p className="fine">
              Every active promotion already has a code. Add another promotion
              in Gifts to generate a new code.
            </p>
          )}
          <p className="fine">
            Each customer use rotates the code automatically; the promotion
            stays available.
          </p>
          <button
            disabled={busy}
            onClick={async () => {
              if (
                !confirm(
                  "Refresh all available promo codes? Each promotion will stay on the customer list with a new code. Customer-used codes are preserved in history.",
                )
              )
                return;
              const d = await act("admin_refresh_promo_codes");
              setRefreshedPromo(null);
              if (d)
                setNotice(
                  d.count
                    ? `Refreshed ${d.count} available promo code${d.count === 1 ? "" : "s"}.`
                    : "There were no available promo codes to refresh.",
                );
            }}
          >
            REFRESH PROMO CODES
          </button>
          <div className="admin-rows">
            {data.reward_codes.map((c) => (
              <article key={c.id}>
                <strong>{c.code}</strong>
                <p>
                  {c.gift_types?.name} · {c.status}
                </p>
                {refreshedPromo?.id === c.gift_type_id && (
                  <div className="generated">
                    <p>New promo code. Copy it before sharing.</p>
                    <code>{refreshedPromo.code}</code>
                    <button
                      className="secondary small"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(refreshedPromo.code)
                          .then(() => setNotice("Promo code copied."))
                          .catch(() =>
                            setError("Select and copy the code manually."),
                          )
                      }
                    >
                      Copy code
                    </button>
                  </div>
                )}
                {["available", "disabled"].includes(c.status) && (
                  <button
                    className="quiet"
                    disabled={busy}
                    onClick={() =>
                      act("admin_reward_status", {
                        id: c.id,
                        status:
                          c.status === "available" ? "disabled" : "available",
                      })
                    }
                  >
                    {c.status === "available"
                      ? "Pause availability"
                      : "Make available"}
                  </button>
                )}
              </article>
            ))}
          </div>
          <h3>Access code history</h3>
          <p>
            Paste the promo code—or the customer’s WhatsApp message—to find its
            original promotion and use time.
          </p>
          <form className="history-search" onSubmit={searchPromo}>
            <label htmlFor="history-promo-code">
              Customer promo code or message
            </label>
            <div>
              <input
                id="history-promo-code"
                value={historyCode}
                onChange={(e) => setHistoryCode(e.target.value.toUpperCase())}
                placeholder="GIFT-XXXXXXXX"
                maxLength={1000}
                required
              />
              <button disabled={busy}>
                {busy ? "SEARCHING…" : "SEARCH HISTORY"}
              </button>
            </div>
          </form>
          {historyResult && (
            <article className="history-result">
              <strong>
                {historyResult.code} · {historyResult.gift_name}
              </strong>
              <p>Used {formatPromoActiveAt(historyResult.selected_at)}</p>
              <p>
                {historyResult.discount_percent}% discount ·{" "}
                {historyResult.status.replaceAll("_", " ")}
              </p>
              {historyResult.purchase_reference && (
                <p>Purchase reference: {historyResult.purchase_reference}</p>
              )}
            </article>
          )}
          <div className="admin-rows">
            {data.access_codes.map((c) => (
              <article key={c.id}>
                <strong>
                  {c.purchase_reference || "Customer access code"}
                </strong>
                <p>
                  {c.status} · Expires{" "}
                  {new Date(c.expires_at).toLocaleDateString("en-US")}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
      {tab === "Settings" && (
        <Settings
          settings={data.settings}
          busy={busy}
          save={(settings) => act("admin_settings", { settings })}
        />
      )}
    </div>
  );
}
function Editor({ item, type, busy, onSave, onCancel, onError }) {
  const [draft, setDraft] = useState(() => ({
      ...item,
      gallery_images:
        item.gallery_images || (item.image_url ? [item.image_url] : []),
    })),
    [uploading, setUploading] = useState(false);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  async function upload(input) {
    const files = Array.from(input || []);
    if (!files.length) return;
    if (draft.gallery_images.length + files.length > 10) {
      onError(
        "Each item can have up to 10 gallery photos. Remove a photo before adding another.",
      );
      return;
    }
    if (
      files.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024,
      )
    ) {
      onError("Choose JPG, PNG, or WebP photos under 5 MB each.");
      return;
    }
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const ticket = await callApi("admin_upload", {
          content_type: file.type,
        });
        const { error } = await supabase.storage
          .from("goove-images")
          .uploadToSignedUrl(ticket.path, ticket.token, file, {
            contentType: file.type,
          });
        if (error) throw error;
        uploaded.push(ticket.public_url);
      }
      setDraft((d) => {
        const gallery = [...d.gallery_images, ...uploaded];
        return { ...d, gallery_images: gallery, image_url: gallery[0] || "" };
      });
    } catch (e) {
      onError(e.message);
    } finally {
      setUploading(false);
    }
  }
  function removePhoto(index) {
    setDraft((d) => {
      const gallery = d.gallery_images.filter((_, i) => i !== index);
      return { ...d, gallery_images: gallery, image_url: gallery[0] || "" };
    });
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (
          draft.gallery_images.length < 1 ||
          draft.gallery_images.length > 10
        ) {
          onError("Upload between 1 and 10 photos for each item.");
          return;
        }
        onSave({ ...draft, image_url: draft.gallery_images[0] });
      }}
    >
      <label>
        Name
        <input
          required
          maxLength={100}
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </label>
      <label>
        Description
        <textarea
          required
          maxLength={500}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>
      <>
        {type === "Handbags" && (
          <label>
            Specifications (optional)
            <textarea
              maxLength={1500}
              rows={5}
              value={draft.specifications || ""}
              onChange={(e) => set("specifications", e.target.value)}
              placeholder="Material, dimensions, strap details, and care instructions. Include verified product details only."
            />
          </label>
        )}
        <label>
          <UploadSimple /> Upload gallery photos (choose 1–10)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
            disabled={uploading}
          />
        </label>
        <p className="fine">
          Upload 1 to 10 JPG, PNG, or WebP photos. Each photo must be under 5
          MB. Current count: {draft.gallery_images.length}.
        </p>
        <div className="editor-gallery">
          {draft.gallery_images.map((src, i) => (
            <figure key={src + "-" + i}>
              <img
                className="editor-photo"
                src={src}
                alt={"Gallery photo " + (i + 1)}
              />
              <button
                className="quiet small"
                type="button"
                onClick={() => removePhoto(i)}
              >
                Remove photo {i + 1}
              </button>
            </figure>
          ))}
        </div>
        {type === "Gifts" ? (
          <>
            <label>
              Discount percentage (0 for a physical gift)
              <input
                type="number"
                min="0"
                max="100"
                value={draft.discount_percent}
                onChange={(e) =>
                  set("discount_percent", Number(e.target.value))
                }
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => set("active", e.target.checked)}
              />{" "}
              Available to customers
            </label>
          </>
        ) : (
          <>
            <label>
              Price in USD
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={draft.price ?? ""}
                onChange={(e) =>
                  set(
                    "price",
                    e.target.value == "" ? null : Number(e.target.value),
                  )
                }
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.in_stock !== false}
                onChange={(e) => set("in_stock", e.target.checked)}
              />{" "}
              In stock and available to order
            </label>
            <label>
              Display order
              <input
                type="number"
                value={draft.display_order}
                onChange={(e) => set("display_order", Number(e.target.value))}
              />
            </label>
          </>
        )}
      </>
      <button disabled={busy || uploading}>
        {uploading ? "UPLOADING…" : "SAVE CHANGES"}
      </button>
      <button type="button" className="secondary" onClick={onCancel}>
        CANCEL
      </button>
    </form>
  );
}
function Settings({ settings, busy, save }) {
  const [s, setS] = useState(() => ({
    ...settings,
    public_phone: settings.public_phone || "",
    public_email: settings.public_email || "",
    social_links: Array.isArray(settings.social_links)
      ? settings.social_links
      : [],
  }));
  const [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState("");
  const set = (k, v) => setS((d) => ({ ...d, [k]: v }));
  const updateSocial = (i, k, v) =>
    set(
      "social_links",
      s.social_links.map((link, index) =>
        index === i ? { ...link, [k]: v } : link,
      ),
    );
  async function uploadBanner(file) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setUploadError("Choose a JPG, PNG, or WebP image under 5 MB.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const ticket = await callApi("admin_upload", { content_type: file.type });
      const { error } = await supabase.storage
        .from("goove-images")
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type,
        });
      if (error) throw error;
      set("hero_image_url", ticket.public_url);
    } catch (e) {
      setUploadError(e.message || "Could not upload the banner image.");
    } finally {
      setUploading(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(s);
      }}
    >
      <h3>Home page banner</h3>
      <p>
        Change the image and copy customers see at the top of the home page.
      </p>
      <label>
        Banner headline
        <textarea
          rows="2"
          maxLength={120}
          required
          value={s.hero_heading || ""}
          onChange={(e) => set("hero_heading", e.target.value)}
        />
      </label>
      <label>
        Banner description
        <textarea
          maxLength={400}
          required
          value={s.hero_description || ""}
          onChange={(e) => set("hero_description", e.target.value)}
        />
      </label>
      <label>
        Banner button text
        <input
          maxLength={50}
          required
          value={s.hero_cta_text || ""}
          onChange={(e) => set("hero_cta_text", e.target.value)}
        />
      </label>
      <label>
        Banner image
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            uploadBanner(e.target.files?.[0]);
            e.target.value = "";
          }}
          disabled={uploading}
        />
      </label>
      {s.hero_image_url && (
        <img
          className="banner-preview"
          src={s.hero_image_url}
          alt="Current home page banner"
        />
      )}
      <h3>Floating promo flag</h3>
      <p>This message stays visible as customers scroll the public website.</p>
      <label>
        Promo flag text
        <input
          maxLength={150}
          required
          value={s.promo_banner_text || ""}
          onChange={(e) => set("promo_banner_text", e.target.value)}
        />
      </label>
      {uploadError && (
        <p role="alert" className="error">
          {uploadError}
        </p>
      )}
      <h3>Business details</h3>
      <label>
        Business name
        <input
          required
          maxLength={100}
          value={s.business_name}
          onChange={(e) => set("business_name", e.target.value)}
        />
      </label>
      <label>
        WhatsApp number, with country code
        <input
          required
          pattern="[0-9]{8,15}"
          value={s.whatsapp_number}
          onChange={(e) => set("whatsapp_number", e.target.value)}
        />
      </label>
      <h3>Public contact details</h3>
      <label>
        Visible phone number
        <input
          type="tel"
          maxLength={30}
          placeholder="Optional"
          value={s.public_phone}
          onChange={(e) => set("public_phone", e.target.value)}
        />
      </label>
      <label>
        Public email address
        <input
          type="email"
          maxLength={254}
          placeholder="Optional"
          value={s.public_email}
          onChange={(e) => set("public_email", e.target.value)}
        />
      </label>
      <h3>Social media links</h3>
      <p>These links appear in the public site footer.</p>
      {s.social_links.map((link, i) => (
        <div className="social-link-editor" key={i}>
          <label>
            Platform or name
            <input
              required
              maxLength={40}
              placeholder="Instagram"
              value={link.label}
              onChange={(e) => updateSocial(i, "label", e.target.value)}
            />
          </label>
          <label>
            Profile URL
            <input
              type="url"
              required
              maxLength={500}
              placeholder="https://..."
              value={link.url}
              onChange={(e) => updateSocial(i, "url", e.target.value)}
            />
          </label>
          <button
            type="button"
            className="quiet"
            onClick={() =>
              set(
                "social_links",
                s.social_links.filter((_, index) => index !== i),
              )
            }
          >
            Remove link
          </button>
        </div>
      ))}
      {s.social_links.length < 8 && (
        <button
          type="button"
          className="secondary small"
          onClick={() =>
            set("social_links", [...s.social_links, { label: "", url: "" }])
          }
        >
          ADD SOCIAL LINK
        </button>
      )}
      <h3>Reward promotion</h3>
      <p>
        Customers see promo codes without their associated gifts. The
        code-to-gift mapping is visible only in the admin inventory.
      </p>
      <p className="fine">
        Purchase-linked hidden rewards require legal review before launch. A
        guaranteed benefit alone does not resolve chance-based promotion
        requirements.
      </p>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={s.legal_reviewed}
          onChange={(e) => set("legal_reviewed", e.target.checked)}
        />{" "}
        The promotion has been legally reviewed for our location and terms.
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={s.promotion_enabled}
          onChange={(e) => set("promotion_enabled", e.target.checked)}
        />{" "}
        Open reward registration
      </label>
      <button disabled={busy || uploading}>
        {uploading ? "UPLOADING…" : "SAVE SETTINGS"}
      </button>
    </form>
  );
}
