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
}) {
  const lines = useMemo(() => buildInvoiceLines(items, gstPercent), [items, gstPercent]);

  return (
    <div className={compact ? 'text-xs' : ''}>
      <table className={className}>
        <thead>
          <tr>
            <th className="w-8 text-center">#</th>
            <th>Item Name</th>
            <th className="whitespace-nowrap">HSN/SAC</th>
            <th className="text-right">Qty</th>
            <th className="text-right whitespace-nowrap">Price/Unit (₹)</th>
            <th className="text-right whitespace-nowrap">GST</th>
            <th className="text-right whitespace-nowrap">Amount (excl. GST)</th>
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
                <td className="text-center tabular-nums text-slate-500">{line.serial}</td>
                <td className="font-medium text-slate-900">{line.name}</td>
                <td className="font-mono text-xs text-slate-600">{line.hsnSac}</td>
                <td className="text-right tabular-nums">{line.quantity}</td>
                <td className="text-right tabular-nums">{formatInrAmount(line.rate)}</td>
                <td className="text-right tabular-nums text-slate-700 whitespace-nowrap">
                  {formatLineGstDisplay(line)}
                </td>
                <td className="text-right tabular-nums font-semibold text-slate-900">
                  {formatInrAmount(line.taxable)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {lines.length > 0 && (
        <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
          Line amounts exclude GST. GST column shows tax per line at the invoice rate; invoice total adds
          CGST/SGST below.
        </p>
      )}
    </div>
  );
}
