const GST_STATE_BY_CODE = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

const STATE_NAMES = Object.values(GST_STATE_BY_CODE).sort((a, b) => b.length - a.length);

function stateFromGstin(gstin) {
  const raw = String(gstin || '').trim().toUpperCase();
  if (raw.length < 2) return '';
  return GST_STATE_BY_CODE[raw.slice(0, 2)] || '';
}

function stateFromAddress(address) {
  const raw = String(address || '');
  if (!raw.trim()) return '';
  const found = STATE_NAMES.find((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(raw);
  });
  return found || '';
}

function derivePlaceOfSupply(party = {}) {
  return stateFromGstin(party.gst_number) || stateFromAddress(party.address) || '';
}

function shippingIsSameAsBilling(shippingAddress, billingAddress) {
  const ship = String(shippingAddress || '').trim();
  if (!ship) return true;
  return ship.toLowerCase() === String(billingAddress || '').trim().toLowerCase();
}

function invoicePlaceOfSupply(sale) {
  return (
    String(sale?.place_of_supply || '').trim() ||
    derivePlaceOfSupply({ gst_number: sale?.gst_number, address: sale?.address }) ||
    '—'
  );
}

module.exports = {
  derivePlaceOfSupply,
  shippingIsSameAsBilling,
  invoicePlaceOfSupply,
};
