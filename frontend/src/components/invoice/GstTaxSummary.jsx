import { splitGst, formatInr } from '../../utils/gstBreakdown';
import PaymentSettlementSummary from './PaymentSettlementSummary';

export default function GstTaxSummary({
  gstPercent,
  gstAmount,
  subtotal,
  total,
  className = '',
  settlement = null,
  showGst = true,
}) {
  const { cgstRate, sgstRate, cgstAmount, sgstAmount } = splitGst(gstPercent, gstAmount);
  const showSettlement = Boolean(settlement?.isPartial);

  return (
    <div className={className}>
      <div className="invoice-summary-row">
        <span>Subtotal</span>
        <span className="tabular-nums">{formatInr(subtotal)}</span>
      </div>
      {showGst ? (
        <>
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
        </>
      ) : null}
      {showSettlement ? (
        <PaymentSettlementSummary
          className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-600"
          totalBilled={settlement.totalBilled}
          amountReceived={settlement.amountReceived}
          balanceDue={settlement.balanceDue}
        />
      ) : (
        <div className="invoice-summary-row invoice-summary-total">
          <span>Total payable</span>
          <span className="tabular-nums text-emerald-700">{formatInr(total)}</span>
        </div>
      )}
    </div>
  );
}
