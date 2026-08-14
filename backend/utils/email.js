const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmailFormat(email) {
  return EMAIL_RE.test(normalizeEmail(email));
}

function appOrigin(req) {
  const fromEnv = String(process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const origin = String(req.get('origin') || '')
    .trim()
    .replace(/\/$/, '');
  if (origin) return origin;
  return 'http://localhost:5173';
}

function confirmationRedirectTo(req) {
  return `${appOrigin(req)}/login`;
}

module.exports = {
  EMAIL_RE,
  normalizeEmail,
  isValidEmailFormat,
  appOrigin,
  confirmationRedirectTo,
};
