export const PARTY_TYPE_OPTIONS = [
  { value: 'retailer', label: 'Retailer' },
  { value: 'wholesaler', label: 'Wholesaler' },
  { value: 'manufacturer', label: 'Manufacturer' },
];

export function partyTypeLabel(type) {
  return PARTY_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;
}

/** Default filters for invoice vs purchase flows */
export const SALES_PARTY_TYPES = ['retailer', 'wholesaler'];
export const PURCHASE_PARTY_TYPES = ['manufacturer', 'wholesaler'];

export const SALES_QUICK_ADD_TYPES = ['retailer', 'wholesaler'];
export const PURCHASE_QUICK_ADD_TYPES = ['manufacturer', 'wholesaler'];
