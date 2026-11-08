export function productFields(item: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  if (item.category !== undefined) {
    if (
      typeof item.category !== "string" ||
      !["handbag", "watch"].includes(item.category)
    )
      throw Error("Choose handbags or watches.");
    result.category = item.category;
  }
  if (item.audience !== undefined) {
    if (
      typeof item.audience !== "string" ||
      !["women", "men"].includes(item.audience)
    )
      throw Error("Choose women or men.");
    result.audience = item.audience;
  }
  if (item.featured !== undefined) {
    if (typeof item.featured !== "boolean")
      throw Error("Featured must be true or false.");
    result.featured = item.featured;
  }
  return result;
}
