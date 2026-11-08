import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
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
  const [path, setPath] = useState(location.pathname),
    [catalog, setCatalog] = useState({
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
    history.pushState({}, "", to);
    setPath(to);
    setProductTarget(readProductTarget(location.href));
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const rewards = path === "/rewards",
    adminPage = path === "/admin";
  useEffect(() => {
    if (path !== "/" || loading || !productTarget) return;
    document
      .getElementById(`bag-${productTarget.id}`)
      ?.scrollIntoView({ block: "center" });
  }, [path, loading, catalog.handbags, productTarget]);
  useEffect(() => {
    document.title = `${rewards ? "Exclusive Gifts & Rewards" : adminPage ? "Goove Studio" : "Handbag Collection"} | ${catalog.settings.business_name}`;
  }, [path, catalog.settings.business_name]);
  return (
    <>
      <header className="site-header">
        <a
          href="/"
          className="wordmark"
          onClick={(e) => navigate(e, "/")}
          aria-label="Goove home"
        >
          {catalog.settings.business_name}
          <span>HANDBAG COLLECTION</span>
        </a>
        <nav aria-label="Main navigation">
          <a
            href="/"
            aria-current={!rewards && !adminPage ? "page" : undefined}
            onClick={(e) => navigate(e, "/")}
          >
            Collection
          </a>
          <a
            href="/rewards"
            aria-current={rewards ? "page" : undefined}
            onClick={(e) => navigate(e, "/rewards")}
          >
            Gifts & Rewards
          </a>
        </nav>
      </header>
      {catalog.settings.promo_banner_text && (
        <aside className="promo-flag-bar" aria-label="Goove gift promotion">
          <a
            className="promo-flag"
            href="/rewards"
            onClick={(e) => navigate(e, "/rewards")}
          >
            <Gift size={20} aria-hidden="true" />
            <span>{catalog.settings.promo_banner_text}</span>
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
                ? "Your email is confirmed. Continue to owner access to manage your account."
                : confirmation === "expired"
                  ? "This email confirmation link has expired or has already been used. Try signing in if you have already confirmed your email; otherwise request a new confirmation link."
                  : "We could not confirm your email. Open the latest confirmation email and try again."}
            </p>
            <a href="/admin" onClick={(e) => navigate(e, "/admin")}>
              Continue to owner access{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </section>
        )}
        {adminPage ? (
          <section className="owner-page">
            <a className="back-link" href="/" onClick={(e) => navigate(e, "/")}>
              <ArrowLeft size={16} /> Back to the collection
            </a>
            <p className="eyebrow">OWNER ACCESS</p>
            <h1>Goove Studio</h1>
            <Suspense
              fallback={
                <p className="owner-session" role="status">
                  Opening Goove Studio…
                </p>
              }
            >
              <Admin onCatalogChange={refresh} />
            </Suspense>
          </section>
        ) : error ? (
          <section className="empty">
            <h1>A moment, please.</h1>
            <p role="alert">{error}</p>
            <button onClick={refresh}>TRY AGAIN</button>
          </section>
        ) : loading ? (
          <div className="loading">
            <SpinnerGap className="spin" /> Preparing something beautiful…
          </div>
        ) : rewards ? (
          <Rewards catalog={catalog} />
        ) : (
          <>
            <section className="hero" aria-labelledby="hero-heading">
              <div className="hero-copy">
                <p className="eyebrow">THE GOOVE COLLECTION</p>
                <h1 id="hero-heading">
                  {catalog.settings.hero_heading ||
                    defaultSettings.hero_heading}
                </h1>
                <p className="hero-subtitle">
                  {catalog.settings.hero_description ||
                    defaultSettings.hero_description}
                </p>
                <a className="button" href="#collection">
                  {catalog.settings.hero_cta_text ||
                    defaultSettings.hero_cta_text}{" "}
                  <ArrowRight size={22} weight="light" />
                </a>
              </div>
              <img
                className="hero-image"
                src={catalog.settings.hero_image_url}
                alt="Handbag featured by Goove"
                fetchPriority="high"
              />
            </section>
            <section
              className="collection section-wrap"
              id="collection"
              aria-labelledby="collection-heading"
            >
              <div className="section-heading">
                <p className="eyebrow">THE COLLECTION</p>
                <h2 id="collection-heading">Handbags for every chapter.</h2>
                <p>
                  Timeless style, distinctive character, and a little more to
                  look forward to.
                </p>
              </div>
              <div className="bag-grid">
                {catalog.handbags.map((bag) => (
                  <ProductCard
                    key={bag.id}
                    bag={bag}
                    phone={catalog.settings.whatsapp_number}
                    target={productTarget}
                  />
                ))}
              </div>
              {!catalog.handbags.length && (
                <p className="empty">Our next collection is on its way.</p>
              )}
            </section>
            <section className="closing">
              <p className="eyebrow">A LITTLE SOMETHING, JUST FOR YOU</p>
              <h2>
                A beautiful choice deserves
                <br />a thoughtful thank-you.
              </h2>
              <a
                className="text-link"
                href="/rewards"
                onClick={(e) => navigate(e, "/rewards")}
              >
                Discover your exclusive rewards <ArrowRight size={20} />
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
            <p>Beautiful bags. Thoughtful rewards.</p>
          </div>
          {(catalog.settings.public_phone ||
            catalog.settings.public_email ||
            catalog.settings.social_links?.length > 0) && (
            <div className="footer-contact">
              <strong>Contact Goove</strong>
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
            In stock bags can be ordered on WhatsApp.
            <br />
            Choose a bag marked available to order.
          </div>
          <a
            className="quiet"
            href="/admin"
            onClick={(e) => navigate(e, "/admin")}
          >
            Owner access
          </a>
        </footer>
      )}
    </>
  );
}
function GiftGallery({ gift }) {
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
            aria-label={"Previous " + gift.name + " photo"}
            onClick={() =>
              setIndex((i) => (i - 1 + photos.length) % photos.length)
            }
          >
            <ArrowLeft size={18} />
          </button>
          <button
            className="gallery-arrow next"
            aria-label={"Next " + gift.name + " photo"}
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
      setState(await callApi("verify", { access_code: access.trim() }));
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
        ? "Enter a name with at least two characters."
        : "",
    );
    const digits = phone.replace(/\D/g, "").length;
    form.elements.customer_phone.setCustomValidity(
      digits < 7 || digits > 15
        ? "Enter a phone number with 7 to 15 digits, including your country code."
        : "",
    );
    if (!form.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      const result = await callApi("reserve", {
        access_code: access.trim(),
        reward_code_id: rewardId,
      });
      // Keep the immutable reservation recoverable even if WhatsApp cannot open.
      setState(result);
      setChoice(null);
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
          <ArrowLeft size={16} /> Back to the collection
        </a>
        <p className="eyebrow">OUR WAY OF SAYING THANK YOU</p>
        <h1>Exclusive Gifts & Rewards</h1>
        <p className="welcome">
          Thank you for choosing our handbag collection! Enter the one-time
          access code from our team to view the available promo codes.
        </p>
        <button className="rewards-start" onClick={unlock}>
          ENTER ACCESS CODE <ArrowRight size={20} />
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
                  <span className="eyebrow">YOUR NEXT CHAPTER</span>
                  <span className="percent">
                    {g.discount_percent}
                    <small>%</small>
                  </span>
                  <span className="discount-caption">
                    A little more to love.
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
          Each purchase access code unlocks one promo selection. Promo codes are
          available while supplies last.
        </p>
      </section>
      <section
        className="reward-section"
        ref={panel}
        aria-labelledby="reward-heading"
      >
        <p className="eyebrow">RESERVED FOR OUR CUSTOMERS</p>
        <h2 id="reward-heading">Choose your promo.</h2>
        <p>
          Use your one-time access code to see all codes for active promotions.
        </p>
        {!opened ? (
          <button onClick={unlock}>
            VIEW AVAILABLE PROMO CODES <ArrowRight size={20} />
          </button>
        ) : (
          <div className="reward-flow">
            <ol className="steps" aria-label="Reward progress">
              {["Access code", "Choose promo", "WhatsApp"].map(
                (label, index) => (
                  <li
                    key={label}
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
                <h3>Your exclusive access</h3>
                <p>
                  Enter the access code shared by Goove. It can be used once to
                  unlock one promo code.
                </p>
                <label htmlFor="access">Access code</label>
                <input
                  id="access"
                  ref={accessInput}
                  value={access}
                  onChange={(e) => {
                    setAccess(e.target.value.replace(/\s/g, "").toUpperCase());
                    setError("");
                  }}
                  placeholder="Enter your access code"
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
                  Paste the full GOOVE- code shared by our team. Viewing the
                  list does not use your selection.
                </p>
                <button disabled={busy}>
                  {busy ? "CHECKING…" : "VIEW MY PROMO CODES"}{" "}
                  <LockSimple size={18} />
                </button>
              </form>
            ) : state.claim ? (
              <div className="success">
                <span className="success-icon">
                  <Check size={28} />
                </span>
                <p className="eyebrow">YOUR PROMO CODE</p>
                <h3 ref={stageHeading} tabIndex={-1}>
                  {state.claim.code}
                </h3>
                <p>
                  This promo code is reserved for you. If WhatsApp didn’t open
                  earlier, enter your details below to send it now.
                </p>
                <form
                  className="promo-contact-form"
                  onSubmit={sendPromo}
                  aria-busy={busy}
                >
                  <label htmlFor="reserved-name">Name</label>
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
                  <label htmlFor="reserved-phone">Phone number</label>
                  <input
                    id="reserved-phone"
                    name="customer_phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    pattern={phonePattern}
                    title="Enter a valid phone number"
                    maxLength={30}
                    required
                    value={phone}
                    onChange={(e) => {
                      e.target.setCustomValidity("");
                      setPhone(e.target.value);
                    }}
                  />
                  <p className="fine">
                    The system selection date and time will be included in your
                    WhatsApp message.
                  </p>
                  <button disabled={busy}>
                    CONTINUE TO WHATSAPP <WhatsappLogo size={18} />
                  </button>
                </form>
              </div>
            ) : (
              <>
                <h3 ref={stageHeading} tabIndex={-1}>
                  Promo codes
                </h3>
                <p role="status">
                  {availableCount}{" "}
                  {availableCount === 1 ? "promo is" : "promos are"} available.
                </p>
                <p>
                  Choose an available promo. After you send it, Goove replaces
                  it with a fresh code for the next customer.
                </p>
                <button
                  className="secondary small"
                  disabled={busy}
                  onClick={() => verify()}
                >
                  {busy ? "CHECKING…" : "REFRESH AVAILABLE PROMO CODES"}
                </button>
                <div className="code-grid">
                  {state.codes?.map((c, index) => (
                    <article
                      className={`code-card${c.status === "available" ? "" : " is-reserved"}`}
                      key={c.id}
                    >
                      <Gift size={25} weight="light" />
                      <span>
                        Promo {index + 1} ·{" "}
                        {c.status === "available" ? "Available" : "Unavailable"}
                      </span>
                      <strong>{c.code}</strong>
                      <button
                        disabled={busy || c.status !== "available"}
                        aria-label={`Select promo ${index + 1}`}
                        onClick={() => {
                          setChoice(c);
                          setName("");
                          setPhone("");
                          setError("");
                        }}
                      >
                        {c.status === "available"
                          ? "SELECT PROMO"
                          : "UNAVAILABLE"}
                      </button>
                    </article>
                  ))}
                </div>
                {!state.codes?.length && (
                  <p>
                    There are no promo codes available now. Please contact our
                    team.
                  </p>
                )}
                <p className="fine">
                  Your name and phone number are only used to fill the WhatsApp
                  message. They are not saved on this website.
                </p>
              </>
            )}
            {error && (
              <p className="error" role="alert" id="reward-error">
                {error}
              </p>
            )}
            {state && (
              <button
                className="quiet change-access"
                disabled={busy}
                onClick={changeAccess}
              >
                Use a different access code
              </button>
            )}
            <p className="privacy-note">
              <LockSimple size={15} /> Each access code can select one promo
              code.
            </p>
          </div>
        )}
      </section>
      {choice && (
        <Modal
          title="Send your promo code"
          onClose={() => !busy && setChoice(null)}
        >
          <form
            className="promo-contact-form"
            onSubmit={sendPromo}
            aria-busy={busy}
          >
            <p>
              Enter your details for the WhatsApp message. Goove will not save
              this information on the website.
            </p>
            <label htmlFor="promo-name">Name</label>
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
            <label htmlFor="promo-phone">Phone number</label>
            <input
              id="promo-phone"
              name="customer_phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              pattern={phonePattern}
              title="Enter a valid phone number"
              maxLength={30}
              required
              value={phone}
              onChange={(e) => {
                e.target.setCustomValidity("");
                setPhone(e.target.value);
              }}
            />
            <p className="fine">
              Selected promo code: <strong>{choice.code}</strong>
            </p>
            <p className="fine">
              Goove will add the system-generated active date and time to your
              WhatsApp message.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy}>
              {busy ? "RESERVING PROMO…" : "CONTINUE TO WHATSAPP"}{" "}
              <WhatsappLogo size={18} />
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setChoice(null)}
            >
              CANCEL
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
