const PHONE_AUTH_DOMAIN = 'phone.auraclean.internal';

function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizeIndianMobile(value) {
  let raw = digitsOnly(value);
  if (raw.startsWith('91') && raw.length === 12) raw = raw.slice(2);
  return raw;
}

function isValidIndianMobile(value) {
  const raw = normalizeIndianMobile(value);
  if (!/^[6-9]\d{9}$/.test(raw)) return false;
  if (/^(\d)\1{9}$/.test(raw)) return false;
  return true;
}

function indianMobileError(value) {
  const raw = normalizeIndianMobile(value);
  if (!raw) return 'Enter a 10-digit mobile number';
  if (raw.length !== 10) return 'Mobile number must be exactly 10 digits';
  if (!/^[6-9]/.test(raw)) return 'Indian mobile numbers start with 6, 7, 8, or 9';
  if (/^(\d)\1{9}$/.test(raw)) return 'Enter a real mobile number — repeated digits are not valid';
  if (!/^[6-9]\d{9}$/.test(raw)) return 'Enter a valid Indian mobile number';
  return null;
}

function phoneToAuthEmail(phone) {
  return `${normalizeIndianMobile(phone)}@${PHONE_AUTH_DOMAIN}`;
}

function isPhoneAuthEmail(email) {
  return String(email || '').toLowerCase().endsWith(`@${PHONE_AUTH_DOMAIN}`);
}

module.exports = {
  PHONE_AUTH_DOMAIN,
  digitsOnly,
  normalizeIndianMobile,
  isValidIndianMobile,
  indianMobileError,
  phoneToAuthEmail,
  isPhoneAuthEmail,
};
