const storefront = "https://goove.vercel.app/";

export function productLink(id, photoIndex = 0) {
  const url = new URL(storefront);
  url.searchParams.set("bag", id);
  url.searchParams.set("photo", String(photoIndex + 1));
  url.hash = `bag-${encodeURIComponent(id)}`;
  return url.href;
}

export function readProductTarget(href) {
  const url = new URL(href);
  const requested = url.searchParams.get("bag");
  let id = requested;
  if (!id && url.hash.startsWith("#bag-")) {
    try {
      id = decodeURIComponent(url.hash.slice(5));
    } catch {
      return null;
    }
  }
  if (!id || id.length > 100) return null;
  const photo = Number(url.searchParams.get("photo"));
  return {
    id,
    photoIndex:
      Number.isInteger(photo) && photo >= 1 && photo <= 3 ? photo - 1 : 0,
    open: Boolean(requested),
  };
}
