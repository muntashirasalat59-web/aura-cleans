import { formatPackSize } from '../utils/productDisplay';
import { formatRelativeTime } from '../utils/relativeTime';

export const PRODUCT_EXPORT_COLUMNS = [
  { key: 'name', header: 'Name' },
  { key: 'category', header: 'Category' },
  { key: 'status', header: 'Status' },
  { key: 'supplier', header: 'Supplier' },
  { key: 'cost_price', header: 'Cost' },
  { key: 'price', header: 'Selling' },
  { key: 'pack_size', header: 'Pack size' },
  { key: 'hsn_sac', header: 'HSN/SAC' },
  { key: 'fragrance', header: 'Fragrance' },
  { key: 'margin', header: 'Margin' },
  { key: 'stock_quantity', header: 'Stock' },
  { key: 'sku', header: 'SKU' },
];

export function mapProductExportRow(product) {
  const cost = Number(product.cost_price || 0);
  const price = Number(product.price || 0);
  return {
    name: product.name || '',
    category: product.category || '',
    status: product.is_active === false ? 'Inactive' : 'Active',
    supplier: product.supplier || '',
    cost_price: cost,
    price,
    pack_size: formatPackSize(product) || '',
    hsn_sac: product.hsn_sac || '',
    fragrance: product.fragrance || 'Unscented',
    margin: Math.round((price - cost) * 100) / 100,
    stock_quantity: Number(product.stock_quantity || 0),
    sku: product.sku || '',
  };
}

export const PARTY_EXPORT_COLUMNS = [
  { key: 'name', header: 'Name' },
  { key: 'type', header: 'Type' },
  { key: 'status', header: 'Status' },
  { key: 'contact', header: 'Contact' },
  { key: 'gst_number', header: 'GST No.' },
  { key: 'balance', header: 'Balance' },
  { key: 'address', header: 'Address' },
];

export function mapPartyExportRow(party) {
  return {
    name: party.name || '',
    type: party.type || '',
    status: party.is_active === false ? 'Inactive' : 'Active',
    contact: party.contact || '',
    gst_number: party.gst_number || '',
    balance: Number(party.balance || 0),
    address: party.address || '',
  };
}

export const PURCHASE_EXPORT_COLUMNS = [
  { key: 'purchase_date', header: 'Date' },
  { key: 'party_name', header: 'Supplier' },
  { key: 'subtotal', header: 'Subtotal' },
  { key: 'gst_amount', header: 'GST' },
  { key: 'total_amount', header: 'Total' },
  { key: 'payment_status', header: 'Payment status' },
  { key: 'payment_due_date', header: 'Due date' },
  { key: 'balance_due', header: 'Balance due' },
  { key: 'notes', header: 'Notes' },
];

export function mapPurchaseExportRow(purchase, { paymentStatus, balanceDue } = {}) {
  const status =
    purchase.payment_status ||
    (typeof paymentStatus === 'function' ? paymentStatus(purchase) : '') ||
    '';
  const due =
    purchase.balance_due != null
      ? Number(purchase.balance_due)
      : typeof balanceDue === 'function'
        ? balanceDue(purchase)
        : 0;
  return {
    purchase_date: purchase.purchase_date || '',
    party_name: purchase.party_name || '',
    subtotal: Number(purchase.subtotal ?? purchase.total_amount ?? 0),
    gst_amount: Number(purchase.gst_amount ?? 0),
    total_amount: Number(purchase.total_amount || 0),
    payment_status: status,
    payment_due_date: purchase.payment_due_date || '',
    balance_due: due,
    notes: purchase.notes || '',
  };
}

export const SALE_EXPORT_COLUMNS = [
  { key: 'invoice_number', header: 'Invoice number' },
  { key: 'invoice_date', header: 'Date' },
  { key: 'party_name', header: 'Party' },
  { key: 'city', header: 'City' },
  { key: 'total_quantity', header: 'Qty' },
  { key: 'subtotal', header: 'Subtotal' },
  { key: 'gst_amount', header: 'GST' },
  { key: 'total_amount', header: 'Total billed' },
  { key: 'amount_paid', header: 'Amount received' },
  { key: 'payment_status', header: 'Payment status' },
  { key: 'payment_due_date', header: 'Due date' },
  { key: 'balance_due', header: 'Balance due' },
];

export function mapSaleExportRow(sale, { paymentStatus, balanceDue } = {}) {
  const status =
    sale.payment_status ||
    (typeof paymentStatus === 'function' ? paymentStatus(sale) : '') ||
    '';
  const due =
    sale.balance_due != null
      ? Number(sale.balance_due)
      : typeof balanceDue === 'function'
        ? balanceDue(sale)
        : 0;
  return {
    invoice_number: sale.invoice_number || '',
    invoice_date: sale.invoice_date || '',
    party_name: sale.party_name || '',
    city: sale.city_name || '',
    total_quantity: Number(sale.total_quantity ?? 0),
    subtotal: Number(sale.subtotal || 0),
    gst_amount: Number(sale.gst_amount || 0),
    total_amount: Number(sale.total_amount || 0),
    amount_paid: Number(sale.amount_paid ?? 0),
    payment_status: status,
    payment_due_date: sale.payment_due_date || '',
    balance_due: due,
  };
}

const ACTION_LABELS = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
  mark_paid: 'marked as paid',
};

export const ACTIVITY_EXPORT_COLUMNS = [
  { key: 'when', header: 'When' },
  { key: 'user_name', header: 'User' },
  { key: 'action', header: 'Action' },
  { key: 'entity_type', header: 'Type' },
  { key: 'entity_name', header: 'Record' },
  { key: 'details', header: 'Details' },
];

export function mapActivityExportRow(row) {
  const time = formatRelativeTime(row.created_at);
  return {
    when: typeof time === 'object' ? time.exact : String(time),
    user_name: row.user_name || '',
    action: ACTION_LABELS[row.action_type] || row.action_type || '',
    entity_type: row.entity_type || '',
    entity_name: row.entity_name || '',
    details: row.details ? JSON.stringify(row.details) : '',
  };
}
