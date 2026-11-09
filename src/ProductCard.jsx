import { useLanguage } from "./i18n";
import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { WhatsappLogo } from "@phosphor-icons/react/dist/csr/WhatsappLogo";
import { Modal } from "./Modal";
import { whatsappBagUrl } from "./api";
import { productLink } from "./productLinks";

const money = (value, language) =>
  new Intl.NumberFormat(language, {
    style: "currency",
    currency: "USD",
  }).format(Number(value));

function ProductPhoto({ src, name, ...props }) {
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);
  return failed || !src ? (
    <span className="product-photo-unavailable">{t("Photo unavailable")}</span>
  ) : (
    <img src={src} alt={name} onError={() => setFailed(true)} {...props} />
  );
}

export function ProductCard({ bag, phone, target }) {
  const { t, language } = useLanguage();
  const isWatch = bag.category === "watch";
  const photos = (
    bag.gallery_images?.length ? bag.gallery_images : [bag.image_url]
  ).filter(Boolean);
  const requestedPhoto =
    target?.id === bag.id
      ? Math.min(target.photoIndex, Math.max(photos.length - 1, 0))
      : 0;
  const [index, setIndex] = useState(requestedPhoto);
  const [quickView, setQuickView] = useState(
    target?.id === bag.id && target.open,
  );
  useEffect(() => {
    if (target?.id !== bag.id) return;
    setIndex(requestedPhoto);
    if (target.open) setQuickView(true);
  }, [target, bag.id, requestedPhoto]);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const descriptionRef = useRef(null);
  const descriptionId = useId();
  const description = bag.description || "";
  useEffect(() => {
    if (expanded) return;
    let active = true;
    const element = descriptionRef.current;
    const measure = () =>
      active && setOverflowing(element.scrollHeight > element.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      active = false;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [description, expanded]);
  const image = photos[index] || bag.image_url;
  const itemLink = productLink(bag.id, index, bag.category);
  const imageLink = image
    ? new URL(image, "https://goove.vercel.app/").href
    : "";
  const purchaseLink = whatsappBagUrl(phone, bag.name, itemLink, imageLink);
  const price =
    Number(bag.price) > 0 ? money(bag.price, language) : t("Price on request");
  function closeQuickView() {
    setQuickView(false);
    const url = new URL(location.href);
    if (url.searchParams.get("bag") === bag.id) {
      url.searchParams.delete("bag");
      url.searchParams.delete("photo");
      history.replaceState(
        history.state,
        "",
        url.pathname + url.search + url.hash,
      );
    }
  }

  const purchase = (
    <div className="product-purchase">
      {bag.in_stock !== false && purchaseLink ? (
        <a
          className="button buy-button"
          href={purchaseLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsappLogo size={19} aria-hidden="true" />
          {t(isWatch ? "BUY THIS WATCH" : "BUY THIS BAG")}
        </a>
      ) : (
        <span className="product-unavailable">
          {bag.in_stock === false
            ? t("OUT OF STOCK")
            : t("INQUIRIES UNAVAILABLE")}
        </span>
      )}
      <p className="buy-hint">
        {bag.in_stock === false
          ? t("Ask us about future availability.")
          : t("Personal assistance on WhatsApp")}
      </p>
    </div>
  );

  const thumbnails = (context) =>
    photos.length > 1 && (
      <div
        className="product-thumbnails"
        role="group"
        aria-label={`${bag.name} ${context} photos`}
      >
        {photos.map((src, i) => (
          <button
            key={src + i}
            type="button"
            aria-label={t("Show photo {number} of {name}", {
              number: i + 1,
              name: bag.name,
            })}
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
          >
            <img src={src} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    );
  const photoArrows = photos.length > 1 && (
    <>
      <button
        className="product-photo-arrow previous"
        aria-label={t("Previous photo of {name}", { name: bag.name })}
        onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
      >
        <ArrowLeft size={14} aria-hidden="true" />
      </button>
      <button
        className="product-photo-arrow next"
        aria-label={t("Next photo of {name}", { name: bag.name })}
        onClick={() => setIndex((i) => (i + 1) % photos.length)}
      >
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </>
  );

  return (
    <article className="bag" id={`bag-${bag.id}`} aria-label={bag.name}>
      <div className="product-visual">
        <button
          className="product-image-button"
          aria-label={t("Quick view {name}", { name: bag.name })}
          onClick={() => setQuickView(true)}
        >
          <ProductPhoto
            key={image}
            src={image}
            name={bag.name}
            loading="lazy"
            width="1024"
            height="1024"
          />
        </button>
        {photoArrows}
      </div>
      <div className="product-copy">
        <h3>
          <a
            href={itemLink}
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              setQuickView(true);
            }}
          >
            {bag.name}
          </a>
        </h3>
        <p
          ref={descriptionRef}
          id={descriptionId}
          className={`product-description${expanded ? " expanded" : overflowing ? " is-truncated" : ""}`}
        >
          {description}
        </p>
        <div className="product-read-more">
          {(overflowing || expanded) && (
            <button
              aria-expanded={expanded}
              aria-controls={descriptionId}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? t("Read less") : t("Read more")}{" "}
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="product-price">{price}</p>
        {purchase}
      </div>
      {quickView && (
        <Modal
          title={bag.name}
          className="product-modal"
          onClose={closeQuickView}
        >
          <div className="product-quick-view">
            <div className="product-detail-gallery">
              <div className="product-detail-photo">
                <ProductPhoto
                  key={image}
                  src={image}
                  name={`${bag.name}, photo ${index + 1} of ${photos.length}`}
                  width="1400"
                  height="1400"
                />
                {photoArrows}
                {photos.length > 1 && (
                  <span className="product-photo-count" aria-live="polite">
                    {index + 1} / {photos.length}
                  </span>
                )}
              </div>
              {thumbnails("quick view")}
            </div>
            <div className="product-details">
              <p className="eyebrow">{t("THE GOOVE COLLECTION")}</p>
              <p className="product-detail-price">{price}</p>
              <p className="product-full-description">{description}</p>
              <h3>{t("Specifications")}</h3>
              <dl className="product-specifications">
                <div>
                  <dt>{t("Style")}</dt>
                  <dd>{bag.name}</dd>
                </div>
                <div>
                  <dt>{t("Availability")}</dt>
                  <dd>
                    {bag.in_stock === false
                      ? t("Out of stock")
                      : t("Available to order")}
                  </dd>
                </div>
              </dl>
              {bag.specifications ? (
                <p className="product-specification-notes">
                  {bag.specifications}
                </p>
              ) : null}
              {purchase}
              <a className="product-permalink" href={itemLink}>
                {t(isWatch ? "Link to this watch" : "Link to this bag")}
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </Modal>
      )}
    </article>
  );
}
