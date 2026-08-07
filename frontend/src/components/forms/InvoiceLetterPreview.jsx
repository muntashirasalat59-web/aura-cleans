import { Link } from 'react-router-dom';
import AuraBrandLogo from '../AuraBrandLogo';
import GstTaxSummary from '../invoice/GstTaxSummary';
import InvoiceLineItemsTable from '../invoice/InvoiceLineItemsTable';
import InvoicePaymentPreview from '../invoice/InvoicePaymentPreview';
import InvoiceClosingFooter from '../invoice/InvoiceClosingFooter';
import { useBusinessSettings } from '../../context/BusinessSettingsContext';
import { businessGstLabel, formatBusinessAddress } from '../../config/business';

export default function InvoiceLetterPreview({
  invoiceNumber = 'INV-DRAFT',
  invoiceDate,
  party,
  items = [],
  gstPercent = 18,
  subtotal = 0,
  gstAmount = 0,
  total = 0,
  payment,
  compact = false,
  forPrint = false,
}) {
  const { settings, loading } = useBusinessSettings();
  const configured = Boolean(settings?.configured);
  const address = settings?.address_display || formatBusinessAddress(settings);
  const gstLabel = businessGstLabel(settings);

  return (
    <div
      className={`invoice-letter ${forPrint ? 'print-invoice-area' : ''} ${
        compact ? 'invoice-letter-compact' : ''
      }`}
    >
      <div className="invoice-letter-head">
        <div className="invoice-letter-company">
          <div className="invoice-logo-slot">
            <AuraBrandLogo variant="invoice" />
          </div>
          <div className="invoice-company-meta">
            {loading && !configured ? (
              <p className="invoice-meta-line text-slate-400">Loading business details…</p>
            ) : configured ? (
              <>
                {settings.company_name && (
                  <p className="invoice-brand-sub font-semibold text-slate-800 dark:text-slate-100">
                    {settings.company_name}
                  </p>
                )}
                {address && <p className="invoice-meta-line">{address}</p>}
                {gstLabel && <p className="invoice-meta-line">{gstLabel}</p>}
                {settings.phone?.trim() && (
                  <p className="invoice-meta-line">Phone: {settings.phone.trim()}</p>
                )}
                {settings.email?.trim() && (
                  <p className="invoice-meta-line">{settings.email.trim()}</p>
                )}
              </>
            ) : (
              <p className="invoice-meta-line">
                <Link
                  to="/settings/business"
                  className="text-brand-700 dark:text-brand-300 underline underline-offset-2"
                >
                  Set up your business details in Settings
                </Link>
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="invoice-doc-type">TAX INVOICE</p>
          <p className="invoice-meta-line">
            <span className="text-slate-500">No.</span> {invoiceNumber}
          </p>
          <p className="invoice-meta-line">
            <span className="text-slate-500">Date</span> {invoiceDate || '—'}
          </p>
        </div>
      </div>

      <div className="invoice-bill-to">
        <p className="invoice-section-label">Bill to</p>
        {party ? (
          <>
            <p className="invoice-party-name">{party.name}</p>
            {party.contact && <p className="invoice-meta-line">{party.contact}</p>}
            {party.address && <p className="invoice-meta-line">{party.address}</p>}
            {party.gst_number && <p className="invoice-meta-line">GST: {party.gst_number}</p>}
          </>
        ) : (
          <p className="text-slate-400 italic text-sm">Select a party to preview</p>
        )}
      </div>

      <InvoiceLineItemsTable
        items={items}
        gstPercent={gstPercent}
        compact={compact}
        fitContainer
        emptyMessage="Add products to see line items"
      />

      <div className="invoice-totals">
        <div className="invoice-summary-box">
          <GstTaxSummary
            gstPercent={gstPercent}
            gstAmount={gstAmount}
            subtotal={subtotal}
            total={total}
          />
        </div>
      </div>

      <InvoicePaymentPreview payment={payment} business={settings} compact={compact} />
      <InvoiceClosingFooter compact={compact} />
    </div>
  );
}
