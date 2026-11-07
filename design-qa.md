# Goove visual QA

Selected direction: option 1, warm editorial handbag gallery with an ivory palette, serif display type, wide lifestyle hero, and simple two-column mobile gallery.

## Reference and implementation captures

- Selected reference mock: `C:\Users\clifo\.codex\generated_images\01a1401a-950e-7772-bcd1-b15134a71e1d\exec-2e24a785-c3e1-45fb-8ad3-3efd3144d709.png` (1051 × 1496 px).
- Desktop implementation capture: `work/qa/home-after.png`.
- Mobile implementation capture: `work/qa/mobile-home.png` (375 px wide full-page capture).
- Side-by-side reference comparison: `work/qa/comparison-home-after.png`.

## Comparison notes

The implementation follows the chosen reference’s editorial headline, split hero, centered collection introduction, and image-led handbag cards. The requested green and gray palette now uses forest-green calls to action and cool gray-green surfaces. The Goove identity and rewards path replace the mock's generic brand and placeholder copy. On mobile, the hero stacks vertically and the six-item collection becomes a two-column grid. The hero headline was reduced at the 600 px breakpoint to leave comfortable horizontal space on narrow screens.

## Earlier interaction and service checks

- Collection and Gifts & Rewards navigation were present and the rewards page rendered its gift cards, terms, and access-code form.
- The 390 × 844 mobile viewport held the hero headline within the 375 px content width without horizontal overflow.
- The updated mobile homepage showed the promo message, green and gray palette, and six bag cards.
- All six “Buy This Bag” links pointed to Goove's WhatsApp number with the selected bag name and its item-specific page link prefilled.
- The Edge Function catalog returned all six bags after the ordered photo-gallery table was added. Existing bags currently have one seeded image apiece; owner editing now requires 3–12 photos and previews the uploaded gallery.
- Opening the reward flow shows a one-time access-code field, then the available promo-code list. Selecting a code opens a Name and Phone form; the promo is displayed as fixed text and cannot be edited. Submitting reserves that promo and opens WhatsApp with the entered details and promo code prefilled. Contact details are not sent to Supabase or saved by the website.
- Invalid access codes were rejected with a user-facing error; the owner API rejected a request without an authenticated session.
- Catalog loading returned six handbags and four reward types from the dedicated Goove Supabase project.
- Database checks verified access-code rotation, one-time verification, single-promo reservation, and owner claim-status updates in a rolled-back transaction; selected reward inventory remains protected by database locks.
- The owner access flow is restricted to the invited account. Confirmation links return to the current site origin.
- Owner account signup was submitted for the invited email, and the user confirmed the email. Admin sign-in is available at `/admin`.
- The promotion remains disabled until its owner completes the required legal review and enables it in Settings. The website does not process handbag purchases.

## Rewards and Owner access — November 7, 2026

- A visible action at the top of `/rewards` opens the access form and focuses its input. Pasted access codes are normalized; switching codes clears the previous on-screen selection and contact details.
- The existing three-step styling now indicates access, promo selection, and WhatsApp. Promo cards have distinct labels, explicit availability, and a count of available options. Unavailable cards stay visible and disabled.
- Selection and resend share one reservation handler. Native form validation rejects whitespace-only names, invalid phone characters, and phone values without 7–15 digits before making a reservation request. Customer contact details remain excluded from API requests.
- Owner access opens the existing `/admin` page. Session restoration waits for the owner API, password visibility can be toggled, and an in-flight sign-in disables credentials and account-mode switching. Signup explains the invitation and confirmation requirements.
- Local browser inspection at 320, 390, and 1440 px confirmed no horizontal overflow or page errors. Narrow screens show promo cards in one column with readable action labels. Reduced-motion preferences are honored when opening the reward flow.
- Vite build, formatting, and all 29 checks passed: 11 Node/PostgreSQL checks and 18 Chromium browser tests across desktop and mobile dimensions. Dependency audit reported zero known vulnerabilities.
- Authentication and reservation mutations were tested with simulated accounts and mocked services. No real owner credentials were used and no customer reservations were created for this verification.
