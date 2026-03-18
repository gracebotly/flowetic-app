/**
 * Shared email validation utilities.
 * Used by: invite flow, signup, sign-in link, login form.
 *
 * Single source of truth — do NOT duplicate these in route files.
 */

/** Strict email format regex — rejects "a@b", "test@.com", etc. */
export const EMAIL_RE =
  /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

/** Common domain typos → corrections */
export const DOMAIN_TYPOS: Record<string, string> = {
  "gmal.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmali.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.con": "gmail.com",
  "gmai.com": "gmail.com",
  "gnail.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "hotmal.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outllook.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
  "iclod.com": "icloud.com",
  "icloud.co": "icloud.com",
  "icloud.con": "icloud.com",
  "protonmal.com": "protonmail.com",
  "protonmail.co": "protonmail.com",
  "protonmail.con": "protonmail.com",
  "protonmial.com": "protonmail.com",
};

export type EmailValidationResult =
  | { valid: true; email: string }
  | { valid: false; code: "INVALID_FORMAT"; message: string }
  | { valid: false; code: "TYPO_DETECTED"; message: string; suggestion: string };

/**
 * Validates an email address: format check + typo detection.
 * Returns the cleaned (trimmed, lowercased) email on success,
 * or an error with optional typo suggestion.
 */
export function validateEmail(raw: string): EmailValidationResult {
  const email = raw.trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return {
      valid: false,
      code: "INVALID_FORMAT",
      message: "Please enter a valid email address (e.g. name@company.com).",
    };
  }

  const domain = email.split("@")[1];
  const suggestion = DOMAIN_TYPOS[domain];
  if (suggestion) {
    const corrected = email.replace(`@${domain}`, `@${suggestion}`);
    return {
      valid: false,
      code: "TYPO_DETECTED",
      message: `Did you mean ${corrected}?`,
      suggestion: corrected,
    };
  }

  return { valid: true, email };
}
