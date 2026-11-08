export function productCategory(product) {
  return product.category === "watch" ? "watch" : "handbag";
}
export function collectionProducts(products, collection, audience) {
  return products.filter(
    (product) =>
      productCategory(product) === collection &&
      (!audience || (product.audience || "women") === audience),
  );
}
export function featuredProducts(products) {
  return products.filter((product) => product.featured === true);
}
