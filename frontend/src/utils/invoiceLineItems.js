import { lineSubtotal } from './invoiceGst';
import { formatProductNameWithSize } from './productDisplay';

/** Build one invoice line with GST breakdown (amounts excl. GST on taxable column). */
export function enrichInvoiceLine(item, index, gstPercent) {
  const taxable = lineSubtotal(item.quantity, item.rate);
  const rate = Number(gstPercent) || 0;
  const lineGst = (taxable * rate) / 100;
  const rawName = item.name || item.product_name || '—';
  const name =
    item.unit_type != null || item.unit_size != null
      ? formatProductNameWithSize({ name: rawName, unit_size: item.unit_size, unit_type: item.unit_type }, 'inline')
      : rawName;

  return {
    serial: index + 1,
    name,
    hsnSac: (item.hsn_sac || item.hsnSac || '').trim() || '—',
    quantity: Number(item.quantity) || 0,
    rate: Number(item.rate) || 0,
    taxable,
    lineGst,
    gstPercent: rate,
    lineTotalInclGst: taxable + lineGst,
  };
}

export function buildInvoiceLines(items, gstPercent) {
  return (items || [])
    .filter((item) => item && (item.product_id || item.name || item.product_name))
    .map((item, index) => enrichInvoiceLine(item, index, gstPercent));
}

export function formatInrAmount(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatLineGstDisplay(line) {
  return `${formatInrAmount(line.lineGst)} (${Number(line.gstPercent).toFixed(1)}%)`;
}
