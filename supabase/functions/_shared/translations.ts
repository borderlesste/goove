export function validateTranslations(
  value: unknown,
  fields: Record<string, number>,
) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Translations must be an object.");
  const result: Record<string, Record<string, string>> = {};
  for (const [language, content] of Object.entries(value)) {
    if (
      !["en", "fr", "ht", "es"].includes(language) ||
      !content ||
      typeof content !== "object" ||
      Array.isArray(content)
    )
      throw Error("Invalid translation language or content.");
    const copy: Record<string, string> = {};
    for (const [key, text] of Object.entries(content)) {
      if (
        !Object.hasOwn(fields, key) ||
        typeof text !== "string" ||
        text.length > fields[key]
      )
        throw Error("Invalid translation field or length.");
      if (text.trim()) copy[key] = text.trim();
    }
    if (Object.keys(copy).length) result[language] = copy;
  }
  return result;
}
