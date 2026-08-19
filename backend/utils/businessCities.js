const { assertNoError } = require('../database/supabase');

const MISSING_TABLE = /column|schema cache|could not find|does not exist|relation/i;

function missingCitiesTable(error) {
  return Boolean(error && MISSING_TABLE.test(error.message || ''));
}

async function listBusinessCities(db, businessId) {
  const { data, error } = await db
    .from('business_cities')
    .select('*')
    .eq('business_id', String(businessId))
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

function pickDefaultCity(cities) {
  return (cities || []).find((c) => c.is_active !== false) || cities?.[0] || null;
}

async function ensureDefaultCity(db, businessId) {
  const bid = String(businessId || '').trim();
  if (!bid) return [];

  let rows;
  try {
    rows = await listBusinessCities(db, bid);
  } catch (error) {
    if (missingCitiesTable(error)) return [];
    throw error;
  }
  if (rows.length) return rows;

  let cityName = 'Ahmedabad';
  try {
    const { data: settings } = await db
      .from('business_settings')
      .select('city')
      .eq('business_id', bid)
      .maybeSingle();
    if (settings?.city && String(settings.city).trim()) {
      cityName = String(settings.city).trim();
    }
  } catch {
    /* letterhead city is optional */
  }

  const { data, error } = await db
    .from('business_cities')
    .insert({ business_id: bid, city_name: cityName, is_active: true })
    .select()
    .single();

  if (error) {
    if (missingCitiesTable(error)) return [];
    if (/duplicate/i.test(error.message || '')) {
      return listBusinessCities(db, bid);
    }
    assertNoError(error);
  }
  return data ? [data] : [];
}

module.exports = {
  listBusinessCities,
  ensureDefaultCity,
  pickDefaultCity,
  missingCitiesTable,
};
