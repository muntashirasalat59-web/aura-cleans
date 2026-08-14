import { formatInr } from '../../utils/gstBreakdown';

/** Total Billed / Amount Received / Balance Due — standard invoicing terms. */
export default function PaymentSettlementSummary({
  totalBilled = 0,
  amountReceived = 0,
  balanceDue = 0,
  className = '',
  compact = false,
}) {
  return (
    <div className={`payment-settlement ${compact ? 'payment-settlement-compact' : ''} ${className}`.trim()}>
      <div className="invoice-summary-row">
        <span>Total Billed</span>
        <span className="tabular-nums">{formatInr(totalBilled)}</span>
      </div>
      <div className="invoice-summary-row">
        <span>Amount Received</span>
        <span className="tabular-nums">{formatInr(amountReceived)}</span>
      </div>
      <div className="invoice-summary-row invoice-summary-total">
        <span>Balance Due</span>
        <span className="tabular-nums text-amber-700 dark:text-amber-400">{formatInr(balanceDue)}</span>
      </div>
    </div>
  );
}
