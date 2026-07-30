import { splitGst, formatInr } from '../../utils/gstBreakdown';

export default function GstTaxSummary({ gstPercent, gstAmount, subtotal, total, className = '' }) {
  const { cgstRate, sgstRate, cgstAmount, sgstAmount } = splitGst(gstPercent, gstAmount);

  return (
    <div className={className}>
      <div className="invoice-summary-row">
        <span>Subtotal</span>
        <span className="tabular-nums">{formatInr(subtotal)}</span>
      </div>
      <div className="invoice-summary-row">
        <span>CGST ({cgstRate}%)</span>
        <span className="tabular-nums">{formatInr(cgstAmount)}</span>
      </div>
      <div className="invoice-summary-row">
        <span>SGST ({sgstRate}%)</span>
        <span className="tabular-nums">{formatInr(sgstAmount)}</span>
      </div>
      <div className="invoice-summary-row text-xs text-slate-500 border-0 pt-0 pb-2">
        <span>Total GST ({gstPercent}%)</span>
        <span className="tabular-nums">{formatInr(gstAmount)}</span>
      </div>
      <div className="invoice-summary-row invoice-summary-total">
        <span>Total payable</span>
        <span className="tabular-nums text-emerald-700">{formatInr(total)}</span>
      </div>
    </div>
  );
}
