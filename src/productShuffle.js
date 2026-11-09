export const PRODUCT_RETURN_DELAY = 5 * 60 * 1000;
export const PRODUCT_ORDER_KEY = "goove-product-order";

export function shuffleProductIds(ids, previous = [], random = Math.random) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (
    result.length > 1 &&
    result.length === previous.length &&
    result.every((id, i) => id === previous[i])
  ) {
    result.push(result.shift());
  }
  return result;
}
