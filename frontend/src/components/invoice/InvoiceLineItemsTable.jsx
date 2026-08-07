import { useMemo } from 'react';
import {
  buildInvoiceLines,
  formatInrAmount,
  formatLineGstDisplay,
} from '../../utils/invoiceLineItems';

/**
 * Professional tax invoice line table (#, Item, HSN, Qty, Rate, GST, Amount excl. GST).
 */
export default function InvoiceLineItemsTable({
  items = [],
  gstPercent = 18,
  emptyMessage = 'Add products to see line items',
  className = 'invoice-lines',
  compact = false,
  fitContainer = false,
}) {
  const lines = useMemo(() => buildInvoiceLines(items, gstPercent), [items, gstPercent]);
  const tableClass = [className, fitContainer ? 'invoice-lines-fit' : '', compact ? 'invoice-lines-compact' : '']
    .filter(Boolean)
    .join(' ');
  const wrapClass = fitContainer ? 'invoice-lines-wrap-fit' : 'invoice-form-table-scroll';

  return (
    <div className={compact && !fitContainer ? 'text-xs' : ''}>
      <div className={wrapClass}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className="col-sn text-center">#</th>
              <th className="col-item">Item</th>
              <th className="col-hsn">HSN</th>
              <th className="col-qty text-right">Qty</th>
              <th className="col-rate text-right">Rate</th>
              <th className="col-gst text-right">GST</th>
              <th className="col-amt text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-slate-400 py-8 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              lines.map((line) => (
                <tr key={line.serial}>
                  <td className="col-sn text-center tabular-nums text-slate-500">{line.serial}</td>
                  <td className="col-item font-medium text-slate-900">{line.name}</td>
                  <td className="col-hsn font-mono text-slate-600">{line.hsnSac}</td>
                  <td className="col-qty text-right tabular-nums">{line.quantity}</td>
                  <td className="col-rate text-right tabular-nums">{formatInrAmount(line.rate)}</td>
                  <td className="col-gst text-right tabular-nums text-slate-700">{formatLineGstDisplay(line)}</td>
                  <td className="col-amt text-right tabular-nums font-semibold text-slate-900">
                    {formatInrAmount(line.taxable)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {lines.length > 0 && !fitContainer && (
        <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
          Line amounts exclude GST. GST column shows tax per line at the invoice rate; invoice total adds
          CGST/SGST below.
        </p>
      )}
    </div>
  );
}
