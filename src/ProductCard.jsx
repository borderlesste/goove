import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { WhatsappLogo } from "@phosphor-icons/react/dist/csr/WhatsappLogo";
import { MagnifyingGlassPlus } from "@phosphor-icons/react/dist/csr/MagnifyingGlassPlus";
import { Modal } from "./Modal";
import { whatsappBagUrl } from "./api";

const money = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value),
  );

function ProductPhoto({ src, name, ...props }) {
  const [failed, setFailed] = useState(false);
  return failed || !src ? (
    <span className="product-photo-unavailable">Photo unavailable</span>
  ) : (
    <img src={src} alt={name} onError={() => setFailed(true)} {...props} />
  );
}

export function ProductCard({ bag, phone }) {
  const photos = (
    bag.gallery_images?.length ? bag.gallery_images : [bag.image_url]
  ).filter(Boolean);
  const [index, setIndex] = useState(0);
  const [quickView, setQuickView] = useState(false);
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
  const productLink = `https://goove.vercel.app/#bag-${encodeURIComponent(bag.id)}`;
  const imageLink = image
    ? new URL(image, "https://goove.vercel.app/").href
    : "";
  const purchaseLink = whatsappBagUrl(phone, bag.name, productLink, imageLink);
  const price = Number(bag.price) > 0 ? money(bag.price) : "Price on request";

  const purchase = (
    <div className="product-purchase">
      {bag.in_stock !== false && purchaseLink ? (
        <a
          className="button buy-button"
          href={purchaseLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsappLogo size={19} aria-hidden="true" /> BUY THIS BAG
        </a>
      ) : (
        <span className="product-unavailable">
          {bag.in_stock === false ? "OUT OF STOCK" : "INQUIRIES UNAVAILABLE"}
        </span>
      )}
      <p className="buy-hint">
        {bag.in_stock === false
          ? "Ask us about future availability."
          : "Personal assistance on WhatsApp"}
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
            aria-label={`Show photo ${i + 1} of ${bag.name}`}
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
          >
            <img src={src} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    );

  return (
    <article className="bag" id={`bag-${bag.id}`} aria-label={bag.name}>
      <div className="product-visual">
        <button
          className="product-image-button"
          aria-label={`Quick view ${bag.name}`}
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
          <span className="quick-view-label">
            <MagnifyingGlassPlus size={17} aria-hidden="true" /> QUICK VIEW
          </span>
        </button>
      </div>
      <div className="product-copy">
        <div className="product-photo-options">{thumbnails("collection")}</div>
        <h3>{bag.name}</h3>
        <p
          ref={descriptionRef}
          id={descriptionId}
          className={`product-description${expanded ? " expanded" : ""}`}
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
              {expanded ? "Read less" : "Read more"}{" "}
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
          onClose={() => setQuickView(false)}
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
              </div>
              {thumbnails("quick view")}
            </div>
            <div className="product-details">
              <p className="eyebrow">THE GOOVE COLLECTION</p>
              <p className="product-detail-price">{price}</p>
              <p className="product-full-description">{description}</p>
              <h3>Specifications</h3>
              <dl className="product-specifications">
                <div>
                  <dt>Style</dt>
                  <dd>{bag.name}</dd>
                </div>
                <div>
                  <dt>Availability</dt>
                  <dd>
                    {bag.in_stock === false
                      ? "Out of stock"
                      : "Available to order"}
                  </dd>
                </div>
              </dl>
              {bag.specifications ? (
                <p className="product-specification-notes">
                  {bag.specifications}
                </p>
              ) : null}
              {purchase}
              <a className="product-permalink" href={productLink}>
                Link to this bag <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </Modal>
      )}
    </article>
  );
}
