/** Shared form validation helpers — no Yup/Zod; keep in sync with FormField errors. */

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function requiredText(value, message = 'This field is required') {
  if (value == null || String(value).trim() === '') return message;
  return null;
}

/** Standard email format. Rejects "abc@", missing @, and missing domain. */
export function emailFormat(value, { required = true } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return required ? 'Enter a valid email address' : null;
  if (!EMAIL_RE.test(raw)) return 'Enter a valid email address';
  return null;
}

const CANONICAL_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'rediffmail.com',
];

const EMAIL_DOMAIN_TYPOS = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmaiil.com': 'gmail.com',
  'gmaol.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'ggmail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.cpm': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmail.come': 'gmail.com',
  'gogglemail.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'redifmail.com': 'rediffmail.com',
  'rediffmal.com': 'rediffmail.com',
};

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j += 1) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * Suggest a corrected domain for common provider typos (gmial.com → gmail.com).
 * Does not check whether the mailbox exists — only spelling of known domains.
 */
export function suggestEmailDomain(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at < 1) return null;
  const local = raw.slice(0, at).trim();
  const domain = raw.slice(at + 1).trim();
  if (!local || !domain.includes('.')) return null;
  if (CANONICAL_EMAIL_DOMAINS.includes(domain)) return null;

  let suggested = EMAIL_DOMAIN_TYPOS[domain] || null;
  if (!suggested) {
    let bestDist = Infinity;
    for (const canon of CANONICAL_EMAIL_DOMAINS) {
      const dist = levenshtein(domain, canon);
      const max = canon.length <= 9 ? 1 : 2;
      if (dist > 0 && dist <= max && dist < bestDist) {
        suggested = canon;
        bestDist = dist;
      }
    }
  }
  if (!suggested || suggested === domain) return null;
  return { domain: suggested, email: `${local}@${suggested}` };
}

/** Positive money: min 0.01 */
export function positiveMoney(value, { field = 'Amount', min = 0.01 } = {}) {
  if (value === '' || value == null) return `${field} is required`;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${field} must be a number`;
  if (n < min) return `${field} must be at least ${min}`;
  return null;
}

/** Non-negative integer (stock, etc.) — empty treated as 0 unless required */
export function nonNegativeInteger(value, { field = 'Quantity', required = false } = {}) {
  if (value === '' || value == null) {
    return required ? `${field} is required` : null;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return `${field} must be a whole number`;
  if (n < 0) return `${field} cannot be negative`;
  return null;
}

/** Positive integer ≥ 1 */
export function positiveInteger(value, { field = 'Quantity' } = {}) {
  if (value === '' || value == null) return `${field} is required`;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return `${field} must be a whole number`;
  if (n < 1) return `${field} must be at least 1`;
  return null;
}

/** Indian mobile: exactly 10 digits */
export function indianPhone10(value, { required = false } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return required ? 'This field is required' : null;
  if (!/^\d{10}$/.test(raw)) return 'Enter a valid 10-digit mobile number';
  return null;
}

/**
 * GSTIN: 2 state + 10 PAN + entity + Z + check (15 chars).
 * Empty allowed unless required.
 */
export function gstinFormat(value, { required = false } = {}) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return required ? 'This field is required' : null;
  if (raw.length !== 15) return 'GSTIN must be exactly 15 characters';
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(raw)) {
    return 'Enter a valid GSTIN (e.g. 27AAAAA0000A1Z5)';
  }
  return null;
}

/** Strip non-digits; optionally cap length */
export function digitsOnly(value, maxLen) {
  const d = String(value ?? '').replace(/\D/g, '');
  return maxLen != null ? d.slice(0, maxLen) : d;
}

/** Allow digits + one decimal point for money fields */
export function sanitizeDecimalInput(value) {
  let s = String(value ?? '').replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  return s;
}

/** GSTIN typing: A–Z / 0–9 only, max 15, uppercased */
export function sanitizeGstinInput(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 15);
}

/**
 * Shared Add/Edit party validation (single form in Parties.jsx).
 * @param {object} form
 * @param {{ parties?: Array, editingId?: number|null }} opts
 * @returns {{ errors: Record<string,string>, warnings: Record<string,string> }}
 */
export function validatePartyForm(form, { parties = [], editingId = null } = {}) {
  const errors = {};
  const warnings = {};

  const nameErr = requiredText(form.name, 'This field is required');
  if (nameErr) errors.name = nameErr;

  if (!form.type?.trim()) {
    errors.type = 'This field is required';
  }

  // Contact: required, exactly 10 digits
  const phoneErr = indianPhone10(form.contact, { required: true });
  if (phoneErr) errors.contact = phoneErr;

  const gstRaw = String(form.gst_number ?? '').trim();
  if (gstRaw) {
    const gstErr = gstinFormat(gstRaw);
    if (gstErr) {
      errors.gst_number = gstErr;
    } else {
      const normalized = gstRaw.toUpperCase();
      const duplicate = (parties || []).find(
        (p) =>
          p.id !== editingId &&
          String(p.gst_number || '')
            .trim()
            .toUpperCase() === normalized
      );
      if (duplicate) {
        warnings.gst_number = `GSTIN already used by ${duplicate.name || 'another party'}`;
      }
    }
  }

  return { errors, warnings };
}
