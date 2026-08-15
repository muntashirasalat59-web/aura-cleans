const { getDbClient, assertNoError } = require('../database/supabase');

const EMPTY = {
  business_id: null,
  company_name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  gstin: '',
  phone: '',
  email: '',
  bank_name: '',
  bank_account_number: '',
  upi_id: '',
  logo_url: '',
  signature_url: '',
  stamp_url: '',
  monthly_sales_target: 0,
  updated_at: null,
};

const EDITABLE = [
  'company_name',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'gstin',
  'phone',
  'email',
  'bank_name',
  'bank_account_number',
  'upi_id',
  'logo_url',
  'signature_url',
  'stamp_url',
  'monthly_sales_target',
];

function trimStr(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeMoney(value) {
  if (value === '' || value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function isConfigured(row) {
  if (!row) return false;
  return Boolean(
    trimStr(row.company_name) ||
      trimStr(row.gstin) ||
      trimStr(row.address_line1) ||
      trimStr(row.city)
  );
}

function formatAddress(row) {
  if (!row) return '';
  const cityState = [trimStr(row.city), trimStr(row.state)].filter(Boolean).join(', ');
  return [trimStr(row.address_line1), trimStr(row.address_line2), cityState]
    .filter(Boolean)
    .join(', ');
}

function formatStreetAddress(row) {
  if (!row) return '';
  const street = [trimStr(row.address_line1), trimStr(row.address_line2), trimStr(row.city)]
    .filter(Boolean)
    .join(', ');
  return street || formatAddress(row);
}

function normalizeRow(row, businessId) {
  const base = { ...EMPTY, ...(row || {}) };
  for (const key of EDITABLE) {
    if (key === 'monthly_sales_target') {
      base[key] = normalizeMoney(base[key]);
    } else {
      base[key] = trimStr(base[key]);
    }
  }
  base.business_id = businessId || base.business_id || null;
  base.configured = isConfigured(base);
  base.address_display = formatAddress(base);
  return base;
}

function pickPayload(body = {}) {
  const patch = {};
  for (const key of EDITABLE) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      if (key === 'monthly_sales_target') {
        patch[key] = normalizeMoney(body[key]);
      } else {
        patch[key] = trimStr(body[key]);
      }
    }
  }
  return patch;
}

/**
 * accessToken: used to build an RLS-scoped client
 * businessId: req.profile.business_id — required to fetch/save the right row
 */
async function fetchBusinessSettings(accessToken, businessId) {
  if (!businessId) {
    return normalizeRow(null, null);
  }

  const db = getDbClient(accessToken);
  const { data, error } = await db
    .from('business_settings')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) {
    // Table missing until migration is applied
    if (/relation|does not exist|schema cache/i.test(error.message || '')) {
      console.warn('[business_settings]', error.message);
      return normalizeRow(null, businessId);
    }
    assertNoError(error);
  }

  return normalizeRow(data, businessId);
}

async function upsertBusinessSettings(body, accessToken, businessId) {
  if (!businessId) {
    const err = new Error('Your account is not linked to a business');
    err.code = 'NO_BUSINESS';
    throw err;
  }

  const patch = pickPayload(body);
  if (!Object.keys(patch).length) {
    return fetchBusinessSettings(accessToken, businessId);
  }

  const db = getDbClient(accessToken);
  const row = {
    business_id: businessId,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('business_settings')
    .upsert(row, { onConflict: 'business_id' })
    .select('*')
    .single();

  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message || '')) {
      const err = new Error(
        'business_settings table missing. Run backend/database/supabase.migration.business_settings.sql in Supabase SQL Editor.'
      );
      err.code = 'SETTINGS_TABLE_MISSING';
      throw err;
    }
    if (/monthly_sales_target/i.test(error.message || '')) {
      console.warn(
        '[business_settings] monthly_sales_target missing — run supabase.migration.monthly_sales_target.sql'
      );
      const { monthly_sales_target: _drop, ...withoutTarget } = row;
      const retry = await db
        .from('business_settings')
        .upsert(withoutTarget, { onConflict: 'business_id' })
        .select('*')
        .single();
      assertNoError(retry.error);
      return normalizeRow(retry.data, businessId);
    }
    assertNoError(error);
  }

  return normalizeRow(data, businessId);
}

module.exports = {
  EMPTY,
  EDITABLE,
  fetchBusinessSettings,
  upsertBusinessSettings,
  normalizeRow,
  formatAddress,
  formatStreetAddress,
  isConfigured,
};