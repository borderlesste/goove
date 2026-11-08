import React, { createContext, useContext, useEffect, useState } from "react";
import { translations } from "./translations";

export const languages = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "ht", label: "Kreyòl ayisyen" },
  { code: "es", label: "Español" },
];
export function translate(language, text, values = {}) {
  const index = ["fr", "ht", "es"].indexOf(language);
  const copy = translations[text]?.[index] ?? text;
  return copy.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}
const LanguageContext = createContext({
  language: "en",
  t: (text, values) => translate("en", text, values),
});
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem("goove-language");
      return languages.some((item) => item.code === saved) ? saved : "en";
    } catch {
      return "en";
    }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem("goove-language", language);
    } catch {
      /* The selector still works when storage is unavailable. */
    }
  }, [language]);
  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: (text, values) => translate(language, text, values),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const label = { en: "Language", fr: "Langue", ht: "Lang", es: "Idioma" }[
    language
  ];
  return (
    <label className="language-selector">
      <span>{label}</span>
      <select
        aria-label={label}
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code} lang={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function localizedContent(record, language) {
  const copy = record.translations?.[language];
  if (!copy) return record;
  const result = { ...record };
  for (const key of [
    "name",
    "description",
    "specifications",
    "hero_heading",
    "hero_description",
    "hero_cta_text",
    "promo_banner_text",
  ]) {
    if (typeof copy[key] === "string" && copy[key].trim())
      result[key] = copy[key].trim();
  }
  return result;
}
