import { hasPaymentDetails, formatDisplayDate } from '../../utils/invoicePayment';

/** Shows invoice payment fields, falling back to Business Settings bank/UPI. */
export default function InvoicePaymentPreview({ payment, business, compact = false }) {
  const bankName = payment?.bank_name?.trim() || business?.bank_name?.trim() || '';
  const account =
    payment?.account_number?.trim() || business?.bank_account_number?.trim() || '';
  const upi = payment?.upi?.trim() || business?.upi_id?.trim() || '';
  const hasBusinessBank = Boolean(bankName || account || upi);

  if (!hasPaymentDetails(payment) && !hasBusinessBank) return null;

  const rows = [
    bankName && { label: 'Bank', value: bankName },
    account && { label: 'Account', value: account, mono: true },
    upi && { label: 'UPI', value: upi, mono: true },
    payment?.due_date?.trim() && {
      label: 'Due date',
      value: formatDisplayDate(payment.due_date),
    },
  ].filter(Boolean);

  if (!rows.length && !payment?.payment_terms?.trim()) return null;

  return (
    <section className={`invoice-payment-preview ${compact ? 'invoice-payment-preview-compact' : ''}`}>
      <p className="invoice-section-label">Payment details</p>
      <div className="invoice-preview-block space-y-2">
        {rows.map((row) => (
          <p key={row.label} className="text-xs text-slate-600 dark:text-slate-300">
            <span className="text-slate-400 dark:text-slate-500">{row.label} </span>
            <span className={row.mono ? 'font-mono' : ''}>{row.value}</span>
          </p>
        ))}
        {payment?.payment_terms?.trim() && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-2 border-t border-slate-100 dark:border-slate-700">
            {payment.payment_terms.trim()}
          </p>
        )}
      </div>
    </section>
  );
}
