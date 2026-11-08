import React, { useId } from "react";
import { languages } from "./i18n";
export function TranslationFields({ value = {}, onChange, fields }) {
  const id = useId();
  return (
    <details className="translation-fields">
      <summary>Language translations (optional)</summary>
      <p className="fine">
        Leave a field blank to use the original text. These translations appear
        on the shop and Rewards pages.
      </p>
      {languages.map(({ code, label }) => (
        <fieldset key={code}>
          <legend>{label}</legend>
          {fields.map(({ key, label: fieldLabel, max }) => (
            <label key={key} htmlFor={`${id}-${code}-${key}`}>
              {fieldLabel} — {label}
              <textarea
                id={`${id}-${code}-${key}`}
                aria-label={`${fieldLabel} — ${label}`}
                lang={code}
                maxLength={max}
                rows={2}
                value={value[code]?.[key] || ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    [code]: { ...value[code], [key]: e.target.value },
                  })
                }
              />
            </label>
          ))}
        </fieldset>
      ))}
    </details>
  );
}
