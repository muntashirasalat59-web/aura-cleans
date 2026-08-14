import { enrichPaymentFields } from '../../utils/invoiceReceivables';
import { formatDisplayDate, formatInrCompact } from '../../utils/invoicePayment';

function settlementTitle(total, received, due) {
  return `Total billed ${formatInrCompact(total)} · Amount received ${formatInrCompact(received)} · Balance due ${formatInrCompact(due)}`;
}

export default function InvoicePaymentStatusBadge({ sale }) {
  const payment = enrichPaymentFields(sale);
  const status = payment.payment_status;
  const due = payment.balance_due;
  const received = payment.amount_paid;
  const total = Number(sale?.total_amount) || 0;
  const title = settlementTitle(total, received, due);

  if (status === 'paid') {
    return (
      <span className="badge badge-green" title={title}>
        Paid
      </span>
    );
  }

  if (status === 'partial') {
    return (
      <span className="inline-flex flex-col items-start gap-1" title={title}>
        <span className="badge badge-gold">Partial ({formatInrCompact(due)} due)</span>
        <span className="list-secondary text-[10px] leading-tight">
          Recd {formatInrCompact(received)} / {formatInrCompact(total)}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1" title={title}>
      <span className="badge badge-orange">Pending</span>
      {sale?.payment_due_date ? (
        <span className="list-secondary text-[10px] leading-tight">
          by {formatDisplayDate(sale.payment_due_date)}
        </span>
      ) : null}
    </span>
  );
}
