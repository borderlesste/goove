import React from "react";
import { useLanguage } from "./i18n";
import { ProductCard } from "./ProductCard";
import { collectionProducts } from "./catalog";
export function CollectionPage({ catalog, category, target }) {
  const { t } = useLanguage();
  const watch = category === "watch";
  const products = collectionProducts(catalog.handbags, category);
  const section = (audience, title) => {
    const items = audience
      ? collectionProducts(products, category, audience)
      : products;
    return (
      <section className="collection section-wrap" aria-label={t(title)}>
        <div className="section-heading">
          <h2>{t(title)}</h2>
        </div>
        {items.length ? (
          <div className="bag-grid">
            {items.map((product) => (
              <ProductCard
                key={product.id}
                bag={product}
                phone={catalog.settings.whatsapp_number}
                target={target}
              />
            ))}
          </div>
        ) : (
          <p className="empty">
            {t(
              "New styles are on their way. Contact Goove for current availability.",
            )}
          </p>
        )}
      </section>
    );
  };
  return (
    <>
      <section className="collection-intro section-wrap">
        <p className="eyebrow">{t("THE GOOVE COLLECTION")}</p>
        <h1>
          {t(
            watch
              ? "Watches for your signature style."
              : "Handbags for every chapter.",
          )}
        </h1>
        <p>
          {t(
            watch
              ? "Discover women’s watches at the heart of our collection, alongside select men’s styles."
              : "Explore our handbag collection, chosen to complement your style and your favorite watch.",
          )}
        </p>
      </section>
      {watch ? (
        <>
          {section("women", "Women’s watches")}
          {section("men", "Select men’s watches")}
        </>
      ) : (
        section(null, "Handbags")
      )}
      <section className="collection-crosslink section-wrap">
        <a href={watch ? "/handbags" : "/watches"}>
          {t(watch ? "Explore handbags" : "Explore watches")}
        </a>
        <a href="/rewards">{t("Discover your exclusive rewards")}</a>
      </section>
    </>
  );
}
