import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuraBrandLogo from '../AuraBrandLogo';
import GstTaxSummary from '../invoice/GstTaxSummary';
import InvoiceLineItemsTable from '../invoice/InvoiceLineItemsTable';
import InvoicePaymentPreview from '../invoice/InvoicePaymentPreview';
import InvoiceClosingFooter from '../invoice/InvoiceClosingFooter';
import { useBusinessSettings } from '../../context/BusinessSettingsContext';
import {
  brandAssetSrc,
  formatBusinessAddress,
  formatBusinessStreetAddress,
  formatDisplayDate,
} from '../../config/business';
import { paymentBreakdown } from '../../utils/invoicePayment';
import {
  derivePlaceOfSupply,
  resolveInvoicePlaceOfSupply,
  shippingIsSameAsBilling,
  stateFromGstin,
} from '../../utils/placeOfSupply';

function InvoiceSettingsLogo({ url, version }) {
  const [failed, setFailed] = useState(false);
  const src = brandAssetSrc(url, version);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    if (url && failed) return null;
    return <AuraBrandLogo variant="invoice" className="h-full w-full max-w-full" />;
  }

  return (
    <img
      key={src}
      src={src}
      alt="Business logo"
      className="invoice-brand-logo brand-logo--invoice"
      onError={() => setFailed(true)}
      decoding="async"
    />
  );
}

export default function InvoiceLetterPreview({
  invoiceNumber = 'INV-DRAFT',
  invoiceDate,
  party,
  placeOfSupply = '',
  shippingAddress = '',
  shipSameAsBilling = true,
  items = [],
  gstPercent = 18,
  subtotal = 0,
  gstAmount = 0,
  total = 0,
  payment,
  compact = false,
  forPrint = false,
}) {
  const { settings, loading, refresh } = useBusinessSettings();
  const configured = Boolean(settings?.configured);

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  const address = formatBusinessStreetAddress(settings) || settings?.address_display || formatBusinessAddress(settings);
  const phone = settings?.phone?.trim() || '';
  const gstin = settings?.gstin?.trim() || '';
  const issuerState =
    String(settings?.state || '').trim() ||
    stateFromGstin(gstin) ||
    derivePlaceOfSupply({ gst_number: gstin, address: formatBusinessAddress(settings) });
  const sameShipping =
    shipSameAsBilling || shippingIsSameAsBilling(shippingAddress, party?.address);
  const settlement = paymentBreakdown(payment, total);
  const resolvedPlace =
    resolveInvoicePlaceOfSupply({
      placeOfSupply,
      party,
      shippingAddress: sameShipping ? party?.address : shippingAddress,
      business: settings,
    }) || '—';
  const displayDate = formatDisplayDate(invoiceDate);

  return (
    <div
      className={`invoice-letter ${forPrint ? 'print-invoice-area' : ''} ${
        compact ? 'invoice-letter-compact' : ''
      }`}
    >
      <div className="invoice-letter-head">
        <div className="invoice-letter-company">
          <div className="invoice-logo-slot">
            <InvoiceSettingsLogo url={settings?.logo_url} version={settings?.updated_at} />
          </div>
          <div className="invoice-company-meta">
            {loading && !configured ? (
              <p className="invoice-meta-line text-slate-400">Loading business details…</p>
            ) : configured ? (
              <>
                {settings.company_name && (
                  <p className="invoice-legal-name">{settings.company_name}</p>
                )}
                {address && <p className="invoice-meta-line">{address}</p>}
                {phone && <p className="invoice-meta-line">Phone: {phone}</p>}
                {gstin && <p className="invoice-meta-line">GSTIN: {gstin}</p>}
                {issuerState && <p className="invoice-meta-line">State: {issuerState}</p>}
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
        <div className="invoice-tax-heading">
          <p className="invoice-doc-type">TAX INVOICE</p>
          <div className="invoice-tax-meta">
            <p>
              <span>Invoice No.:</span> {invoiceNumber}
            </p>
            <p>
              <span>Date:</span> {displayDate}
            </p>
            <p>
              <span>Place of Supply:</span> {resolvedPlace}
            </p>
          </div>
        </div>
      </div>

      <div className="invoice-parties">
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
        <div className="invoice-bill-to">
          <p className="invoice-section-label">Ship to</p>
          {sameShipping ? (
            <p className="invoice-meta-line">Same as billing</p>
          ) : (
            <p className="invoice-meta-line whitespace-pre-wrap">{shippingAddress}</p>
          )}
        </div>
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
            settlement={settlement}
          />
        </div>
      </div>

      <InvoicePaymentPreview payment={payment} business={settings} compact={compact} />
      <InvoiceClosingFooter compact={compact} />
    </div>
  );
}
