import { CollectionPage } from "./CollectionPage";
import { featuredProducts } from "./catalog";
import { LanguageSelector, useLanguage, localizedContent } from "./i18n";
import React, {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { LockSimple } from "@phosphor-icons/react/dist/csr/LockSimple";
import { Gift } from "@phosphor-icons/react/dist/csr/Gift";
import { WhatsappLogo } from "@phosphor-icons/react/dist/csr/WhatsappLogo";
import { SpinnerGap } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import {
  callApi,
  loadCatalog,
  defaultSettings,
  whatsappPromoUrl,
  emailConfirmation,
} from "./api";
import { Modal } from "./Modal";
import { ProductCard } from "./ProductCard";
import { readProductTarget } from "./productLinks";
const Admin = lazy(() =>
  import("./Admin").then((module) => ({ default: module.Admin })),
);
export function App() {
  const { t, language } = useLanguage();
  const [path, setPath] = useState(location.pathname),
    [sourceCatalog, setCatalog] = useState({
      handbags: [],
      gifts: [],
      settings: defaultSettings,
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [confirmation, setConfirmation] = useState(null),
    [productTarget, setProductTarget] = useState(() =>
      readProductTarget(location.href),
    );
  const catalog = useMemo(
    () => ({
      ...sourceCatalog,
      settings: localizedContent(sourceCatalog.settings, language),
      handbags: sourceCatalog.handbags.map((item) =>
        localizedContent(item, language),
      ),
      gifts: sourceCatalog.gifts.map((item) =>
        localizedContent(item, language),
      ),
    }),
    [sourceCatalog, language],
  );
  async function refresh() {
    try {
      setCatalog(await loadCatalog());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    emailConfirmation.then((result) => active && setConfirmation(result));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    refresh();
    const pop = () => {
      setPath(location.pathname);
      setProductTarget(readProductTarget(location.href));
    };
    addEventListener("popstate", pop);
    addEventListener("hashchange", pop);
    return () => {
      removeEventListener("popstate", pop);
      removeEventListener("hashchange", pop);
    };
  }, []);
  const navigate = (e, to) => {
    e.preventDefault();
    const destination = new URL(to, location.origin);
    history.pushState({}, "", to);
    setPath(destination.pathname);
    setProductTarget(readProductTarget(location.href));
    window.scrollTo({ top: 0, behavior: "instant" });
    if (destination.hash === "#collection")
      requestAnimationFrame(() =>
        document
          .getElementById("collection")
          ?.scrollIntoView({ block: "start" }),
      );
  };
  const rewards = path === "/rewards",
    adminPage = path === "/admin",
    collectionPage = path === "/watches" || path === "/handbags";
  const homeProducts = featuredProducts(catalog.handbags);
  if (
    productTarget &&
    !homeProducts.some((product) => product.id === productTarget.id)
  ) {
    const selected = catalog.handbags.find(
      (product) => product.id === productTarget.id,
    );
    if (selected) homeProducts.push(selected);
  }
  useEffect(() => {
    if (adminPage || rewards || loading || !productTarget) return;
    document
      .getElementById(`bag-${productTarget.id}`)
      ?.scrollIntoView({ block: "center" });
  }, [path, loading, catalog.handbags, productTarget]);
  useEffect(() => {
    document.title = `${rewards ? t("Exclusive Gifts & Rewards") : adminPage ? "Goove Studio" : path === "/watches" ? t("Watches") : path === "/handbags" ? t("Handbags") : t("WATCHES & HANDBAGS")} | ${catalog.settings.business_name}`;
  }, [path, catalog.settings.business_name, language]);
  return (
    <>
      <header className="site-header">
        <a
          href="/"
          className="wordmark"
          onClick={(e) => navigate(e, "/")}
          aria-label={t("Goove home")}
        >
          {catalog.settings.business_name}
          <span>{t("WATCHES & HANDBAGS")}</span>
        </a>
        <div className="header-controls">
          <nav aria-label={t("Main navigation")}>
            <a
              href="/"
              aria-current={path === "/" ? "page" : undefined}
              onClick={(e) => navigate(e, "/")}
            >
              {t("Home")}
            </a>
            <a
              href="/watches"
              aria-current={path === "/watches" ? "page" : undefined}
              onClick={(e) => navigate(e, "/watches")}
            >
              {t("Watches")}
            </a>
            <a
              href="/handbags"
              aria-current={path === "/handbags" ? "page" : undefined}
              onClick={(e) => navigate(e, "/handbags")}
            >
              {t("Handbags")}
            </a>
            <a
              href="/rewards"
              aria-current={rewards ? "page" : undefined}
              onClick={(e) => navigate(e, "/rewards")}
            >
              {t("Gifts & Rewards")}
            </a>
          </nav>
          <LanguageSelector />
        </div>
      </header>
      {catalog.settings.promo_banner_text && (
        <aside
          className="promo-flag-bar"
          aria-label={t("Goove gift promotion")}
        >
          <a
            className="promo-flag"
            href="/#collection"
            onClick={(e) => navigate(e, "/#collection")}
          >
            <Gift size={20} aria-hidden="true" />
            <span>{t(catalog.settings.promo_banner_text)}</span>
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        </aside>
      )}
      <main>
        {confirmation && (
          <section className="email-confirmation section-wrap">
            <p
              className={confirmation === "confirmed" ? "notice" : "error"}
              role={confirmation === "confirmed" ? "status" : "alert"}
            >
              {confirmation === "confirmed"
                ? t(
                    "Your email is confirmed. Continue to owner access to manage your account.",
                  )
                : confirmation === "expired"
                  ? t(
                      "This email confirmation link has expired or has already been used. Try signing in if you have already confirmed your email; otherwise request a new confirmation link.",
                    )
                  : t(
                      "We could not confirm your email. Open the latest confirmation email and try again.",
                    )}
            </p>
            <a href="/admin" onClick={(e) => navigate(e, "/admin")}>
              {t("Continue to owner access")}{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </section>
        )}
        {adminPage ? (
          <section className="owner-page">
            <a className="back-link" href="/" onClick={(e) => navigate(e, "/")}>
              <ArrowLeft size={16} />
              {t("Back to the collection")}
            </a>
            <p className="eyebrow">{t("OWNER ACCESS")}</p>
            <h1>{t("Goove Studio")}</h1>
            <Suspense
              fallback={
                <p className="owner-session" role="status">
                  {t("Opening Goove Studio…")}
                </p>
              }
            >
              <Admin onCatalogChange={refresh} />
            </Suspense>
          </section>
        ) : error ? (
          <section className="empty">
            <h1>{t("A moment, please.")}</h1>
            <p role="alert">{t(error)}</p>
            <button onClick={refresh}>{t("TRY AGAIN")}</button>
          </section>
        ) : loading ? (
          <div className="loading">
            <SpinnerGap className="spin" />
            {t("Preparing something beautiful…")}
          </div>
        ) : rewards ? (
          <Rewards catalog={catalog} />
        ) : collectionPage ? (
          <CollectionPage
            catalog={catalog}
            category={path === "/watches" ? "watch" : "handbag"}
            target={productTarget}
          />
        ) : (
          <>
            <section className="hero" aria-labelledby="hero-heading">
              <div className="hero-copy">
                <p className="eyebrow">{t("THE GOOVE COLLECTION")}</p>
                <h1 id="hero-heading">
                  {t(
                    catalog.settings.hero_heading ||
                      defaultSettings.hero_heading,
                  )}
                </h1>
                <p className="hero-subtitle">
                  {t(
                    catalog.settings.hero_description ||
                      defaultSettings.hero_description,
                  )}
                </p>
                <a
                  className="button"
                  href="/rewards"
                  onClick={(e) => navigate(e, "/rewards")}
                >
                  {t(
                    catalog.settings.hero_cta_text ||
                      defaultSettings.hero_cta_text,
                  )}{" "}
                  <ArrowRight size={22} weight="light" />
                </a>
              </div>
              <div className="hero-photo-frame">
                <img
                  className="hero-image"
                  src={catalog.settings.hero_image_url}
                  alt={t("Goove collection campaign")}
                  fetchPriority="high"
                />
              </div>
            </section>
            <section
              className="collection section-wrap"
              id="collection"
              aria-labelledby="collection-heading"
            >
              <div className="section-heading">
                <p className="eyebrow">{t("THE COLLECTION")}</p>
                <h2 id="collection-heading">
                  {t("Featured watches & handbags.")}
                </h2>
                <p>
                  {t(
                    "Women’s watches lead our collection, complemented by select men’s watches and distinctive handbags.",
                  )}
                </p>
              </div>
              <div className="collection-links">
                <a
                  className="text-link"
                  href="/watches"
                  onClick={(e) => navigate(e, "/watches")}
                >
                  {t("Explore watches")} <ArrowRight size={18} />
                </a>
                <a
                  className="text-link"
                  href="/handbags"
                  onClick={(e) => navigate(e, "/handbags")}
                >
                  {t("Explore handbags")} <ArrowRight size={18} />
                </a>
              </div>
              <div className="bag-grid">
                {homeProducts.map((bag) => (
                  <ProductCard
                    key={bag.id}
                    bag={bag}
                    phone={catalog.settings.whatsapp_number}
                    target={productTarget}
                  />
                ))}
              </div>
              {!homeProducts.length && (
                <p className="empty">
                  {t("Our next collection is on its way.")}
                </p>
              )}
            </section>
            <section className="closing">
              <p className="eyebrow">{t("A LITTLE SOMETHING, JUST FOR YOU")}</p>
              <h2>
                {t("A beautiful choice deserves")}
                <br />
                {t("a thoughtful thank-you.")}
              </h2>
              <a
                className="text-link"
                href="/rewards"
                onClick={(e) => navigate(e, "/rewards")}
              >
                {t("Discover your exclusive rewards")}
                <ArrowRight size={20} />
              </a>
            </section>
          </>
        )}
      </main>
      {!adminPage && (
        <footer>
          <div>
            <span className="footer-brand">
              {catalog.settings.business_name}
            </span>
            <p>{t("Beautiful watches and handbags. Thoughtful rewards.")}</p>
          </div>
          {(catalog.settings.public_phone ||
            catalog.settings.public_email ||
            catalog.settings.social_links?.length > 0) && (
            <div className="footer-contact">
              <strong>{t("Contact Goove")}</strong>
              {catalog.settings.public_phone && (
                <a
                  href={`tel:${catalog.settings.public_phone.replace(/[^+0-9]/g, "")}`}
                >
                  {catalog.settings.public_phone}
                </a>
              )}
              {catalog.settings.public_email && (
                <a href={`mailto:${catalog.settings.public_email}`}>
                  {catalog.settings.public_email}
                </a>
              )}
              {catalog.settings.social_links?.map((link, i) => (
                <a
                  key={`${link.url}-${i}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
          <div className="footer-note">
            {t("Order available watches and handbags on WhatsApp.")}
            <br />
            {t("Choose an item marked available to order.")}
          </div>
          <a
            className="quiet"
            href="/admin"
            onClick={(e) => navigate(e, "/admin")}
          >
            {t("Owner access")}
          </a>
        </footer>
      )}
    </>
  );
}
function GiftGallery({ gift }) {
  const { t } = useLanguage();
  const photos = (
    gift.gallery_images?.length ? gift.gallery_images : [gift.image_url]
  ).filter(Boolean);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [gift.id, photos.length]);
  if (!photos.length) return null;
  return (
    <div className="gift-visual">
      <img
        className="gift-photo"
        src={photos[index]}
        alt={gift.name + " photo " + (index + 1) + " of " + photos.length}
        loading="lazy"
        width="1024"
        height="960"
      />
      {photos.length > 1 && (
        <>
          <button
            className="gallery-arrow previous"
            aria-label={t("Previous photo of {name}", { name: gift.name })}
            onClick={() =>
              setIndex((i) => (i - 1 + photos.length) % photos.length)
            }
          >
            <ArrowLeft size={18} />
          </button>
          <button
            className="gallery-arrow next"
            aria-label={t("Next photo of {name}", { name: gift.name })}
            onClick={() => setIndex((i) => (i + 1) % photos.length)}
          >
            <ArrowRight size={18} />
          </button>
          <div className="gift-gallery-count">
            {index + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}
function Rewards({ catalog }) {
  const { t, language } = useLanguage();
  const { gifts, settings } = catalog;
  const [opened, setOpened] = useState(false),
    [access, setAccess] = useState(""),
    [state, setState] = useState(null),
    [choice, setChoice] = useState(null),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const panel = useRef();
  const accessInput = useRef();
  const stageHeading = useRef();
  const reservationAttempt = useRef(null);
  const stage = state?.claim ? 2 : state ? 1 : 0;
  const availableCount =
    state?.codes?.filter((code) => code.status === "available").length || 0;
  const phonePattern = "[+0-9\\(\\) .\\-]{7,30}";
  function scrollToPanel() {
    panel.current?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
  useEffect(() => {
    if (!opened) return;
    scrollToPanel();
  }, [opened]);
  useEffect(() => {
    if (!opened) return;
    (stage === 0 ? accessInput : stageHeading).current?.focus({
      preventScroll: true,
    });
  }, [opened, stage]);
  const unlock = () => {
    if (opened) scrollToPanel();
    else setOpened(true);
  };
  async function verify(e) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await callApi("verify", { access_code: access.trim() });
      if (result.claim) {
        setState(null);
        throw Error(
          t(
            "This access code has already been used. Ask Goove for a new access code.",
          ),
        );
      }
      setState(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function sendPromo(e) {
    e.preventDefault();
    const rewardId = choice?.id || state?.claim?.reward_code_id;
    if (!rewardId || busy) return;
    const form = e.currentTarget;
    form.elements.customer_name.setCustomValidity(
      name.trim().length < 2
        ? t("Enter a name with at least two characters.")
        : "",
    );
    const digits = phone.replace(/\D/g, "").length;
    form.elements.customer_phone.setCustomValidity(
      digits < 7 || digits > 15
        ? t(
            "Enter a phone number with 7 to 15 digits, including your country code.",
          )
        : "",
    );
    if (!form.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      if (
        !state?.claim &&
        (reservationAttempt.current?.rewardId !== rewardId ||
          reservationAttempt.current?.access !== access.trim())
      ) {
        reservationAttempt.current = {
          rewardId,
          access: access.trim(),
          id: crypto.randomUUID(),
        };
      }
      const result = state?.claim
        ? state
        : await callApi("reserve", {
            access_code: access.trim(),
            reward_code_id: rewardId,
            purchase_reference: reservationAttempt.current.id,
          });
      // Keep the immutable reservation recoverable even if WhatsApp cannot open.
      setState(result);
      setChoice(null);
      setAccess("");
      reservationAttempt.current = null;
      const link = whatsappPromoUrl(
        settings.whatsapp_number,
        result.claim.code,
        name.trim(),
        phone.trim(),
        result.claim.selected_at,
      );
      if (!link)
        throw Error("Please contact our team to submit this promo code.");
      window.location.assign(link);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function changeAccess() {
    reservationAttempt.current = null;
    setState(null);
    setChoice(null);
    setAccess("");
    setName("");
    setPhone("");
    setError("");
  }
  return (
    <>
      <section className="rewards-intro section-wrap">
        <a className="back-link" href="/">
          <ArrowLeft size={16} />
          {t("Back to the collection")}
        </a>
        <p className="eyebrow">{t("OUR WAY OF SAYING THANK YOU")}</p>
        <h1>{t("Exclusive Gifts & Rewards")}</h1>
        <p className="welcome">
          {t(
            "Thank you for choosing Goove watches and handbags! Enter the one-time access code from our team to view the available promo codes.",
          )}
        </p>
        <button className="rewards-start" onClick={unlock}>
          {t("ENTER ACCESS CODE")}
          <ArrowRight size={20} />
        </button>
      </section>
      <section className="section-wrap gifts-section">
        <div className="gift-grid">
          {gifts.map((g) => (
            <article className="gift-card" key={g.id}>
              {g.gallery_images?.length || g.image_url ? (
                <GiftGallery gift={g} />
              ) : (
                <div className="discount-art">
                  <span className="eyebrow">{t("YOUR NEXT CHAPTER")}</span>
                  <span className="percent">
                    {g.discount_percent}
                    <small>%</small>
                  </span>
                  <span className="discount-caption">
                    {t("A little more to love.")}
                  </span>
                </div>
              )}
              <div className="gift-copy">
                <h3>{g.name}</h3>
                <p>{g.description}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="terms">
          {t(
            "Each purchase access code unlocks one promo selection. Promo codes are available while supplies last.",
          )}
        </p>
      </section>
      <section
        className="reward-section"
        ref={panel}
        aria-labelledby="reward-heading"
      >
        <p className="eyebrow">{t("RESERVED FOR OUR CUSTOMERS")}</p>
        <h2 id="reward-heading">{t("Choose your promo.")}</h2>
        <p>
          {t(
            "Use your one-time access code to see all codes for active promotions.",
          )}
        </p>
        {!opened ? (
          <button onClick={unlock}>
            {t("VIEW AVAILABLE PROMO CODES")}
            <ArrowRight size={20} />
          </button>
        ) : (
          <div className="reward-flow">
            <ol className="steps" aria-label={t("Reward progress")}>
              {["Access code", "Choose promo", "WhatsApp"].map(
                (label, index) => (
                  <li
                    key={t(label)}
                    className={
                      index === stage ? "current" : index < stage ? "done" : ""
                    }
                    aria-current={index === stage ? "step" : undefined}
                  >
                    <span aria-hidden="true">{index + 1}</span>
                    {label}
                  </li>
                ),
              )}
            </ol>
            {!state ? (
              <form onSubmit={verify} aria-busy={busy}>
                <h3>{t("Your exclusive access")}</h3>
                <p>
                  {t(
                    "Enter the access code shared by Goove. It can be used once to unlock one promo code.",
                  )}
                </p>
                <label htmlFor="access">{t("Access code")}</label>
                <input
                  id="access"
                  ref={accessInput}
                  value={access}
                  onChange={(e) => {
                    setAccess(e.target.value.replace(/\s/g, "").toUpperCase());
                    setError("");
                  }}
                  placeholder={t("Enter your access code")}
                  autoComplete="off"
                  spellCheck="false"
                  autoCapitalize="characters"
                  aria-describedby={
                    error ? "access-help reward-error" : "access-help"
                  }
                  aria-invalid={Boolean(error)}
                  disabled={busy}
                  required
                  maxLength={100}
                />
                <p className="fine" id="access-help">
                  {t(
                    "Paste the full GOOVE- code shared by our team. Viewing the list does not use your selection.",
                  )}
                </p>
                <button disabled={busy}>
                  {busy ? t("CHECKING…") : t("VIEW MY PROMO CODES")}{" "}
                  <LockSimple size={18} />
                </button>
              </form>
            ) : state.claim ? (
              <div className="success">
                <span className="success-icon">
                  <Check size={28} />
                </span>
                <p className="eyebrow">{t("YOUR PROMO CODE")}</p>
                <h3 ref={stageHeading} tabIndex={-1}>
                  {state.claim.code}
                </h3>
                <p>
                  {t(
                    "This promo code is reserved for you. If WhatsApp didn’t open earlier, enter your details below to send it now.",
                  )}
                </p>
                <form
                  className="promo-contact-form"
                  onSubmit={sendPromo}
                  aria-busy={busy}
                >
                  <label htmlFor="reserved-name">{t("Name")}</label>
                  <input
                    id="reserved-name"
                    name="customer_name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    required
                    value={name}
                    onChange={(e) => {
                      e.target.setCustomValidity("");
                      setName(e.target.value);
                    }}
                  />
                  <label htmlFor="reserved-phone">{t("Phone number")}</label>
                  <input
                    id="reserved-phone"
                    name="customer_phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    pattern={phonePattern}
                    title={t("Enter a valid phone number")}
                    maxLength={30}
                    required
                    value={phone}
                    onChange={(e) => {
                      e.target.setCustomValidity("");
                      setPhone(e.target.value);
                    }}
                  />
                  <p className="fine">
                    {t(
                      "The system selection date and time will be included in your WhatsApp message.",
                    )}
                  </p>
                  <button disabled={busy}>
                    {t("CONTINUE TO WHATSAPP")}
                    <WhatsappLogo size={18} />
                  </button>
                </form>
              </div>
            ) : (
              <>
                <h3 ref={stageHeading} tabIndex={-1}>
                  {t("Promo codes")}
                </h3>
                <p role="status">
                  {language === "en"
                    ? `${availableCount} ${availableCount === 1 ? "promo is" : "promos are"} available.`
                    : t("{count} promos available.", { count: availableCount })}
                </p>
                <p>
                  {t(
                    "Choose an available promo. After you send it, Goove replaces it with a fresh code for the next customer.",
                  )}
                </p>
                <button
                  className="secondary small"
                  disabled={busy}
                  onClick={() => verify()}
                >
                  {busy ? t("CHECKING…") : t("REFRESH AVAILABLE PROMO CODES")}
                </button>
                <div className="code-grid">
                  {state.codes?.map((c, index) => (
                    <article
                      className={`code-card${c.status === "available" ? "" : " is-reserved"}`}
                      key={c.id}
                    >
                      <Gift size={25} weight="light" />
                      <span>
                        {t("Promo")} {index + 1} ·{" "}
                        {c.status === "available"
                          ? t("Available")
                          : t("Unavailable")}
                      </span>
                      <strong>{c.code}</strong>
                      <button
                        disabled={busy || c.status !== "available"}
                        aria-label={t("Select promo {number}", {
                          number: index + 1,
                        })}
                        onClick={() => {
                          setChoice(c);
                          setName("");
                          setPhone("");
                          setError("");
                        }}
                      >
                        {c.status === "available"
                          ? t("SELECT PROMO")
                          : t("UNAVAILABLE")}
                      </button>
                    </article>
                  ))}
                </div>
                {!state.codes?.length && (
                  <p>
                    {t(
                      "There are no promo codes available now. Please contact our team.",
                    )}
                  </p>
                )}
                <p className="fine">
                  {t(
                    "Your name and phone number are only used to fill the WhatsApp message. They are not saved on this website.",
                  )}
                </p>
              </>
            )}
            {error && (
              <p className="error" role="alert" id="reward-error">
                {t(error)}
              </p>
            )}
            {state && (
              <button
                className="quiet change-access"
                disabled={busy}
                onClick={changeAccess}
              >
                {t("Use a different access code")}
              </button>
            )}
            <p className="privacy-note">
              <LockSimple size={15} />
              {t("Each access code can select one promo code.")}
            </p>
          </div>
        )}
      </section>
      {choice && (
        <Modal
          title={t("Send your promo code")}
          onClose={() => !busy && setChoice(null)}
        >
          <form
            className="promo-contact-form"
            onSubmit={sendPromo}
            aria-busy={busy}
          >
            <p>
              {t(
                "Enter your details for the WhatsApp message. Goove will not save this information on the website.",
              )}
            </p>
            <label htmlFor="promo-name">{t("Name")}</label>
            <input
              id="promo-name"
              name="customer_name"
              autoFocus
              autoComplete="name"
              minLength={2}
              maxLength={100}
              required
              value={name}
              onChange={(e) => {
                e.target.setCustomValidity("");
                setName(e.target.value);
              }}
            />
            <label htmlFor="promo-phone">{t("Phone number")}</label>
            <input
              id="promo-phone"
              name="customer_phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              pattern={phonePattern}
              title={t("Enter a valid phone number")}
              maxLength={30}
              required
              value={phone}
              onChange={(e) => {
                e.target.setCustomValidity("");
                setPhone(e.target.value);
              }}
            />
            <p className="fine">
              {t("Selected promo code:")} <strong>{choice.code}</strong>
            </p>
            <p className="fine">
              {t(
                "Goove will add the system-generated active date and time to your WhatsApp message.",
              )}
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy}>
              {busy ? t("RESERVING PROMO…") : t("CONTINUE TO WHATSAPP")}{" "}
              <WhatsappLogo size={18} />
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setChoice(null)}
            >
              {t("CANCEL")}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
