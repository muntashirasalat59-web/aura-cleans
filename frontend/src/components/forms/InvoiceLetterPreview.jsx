import { BUSINESS, businessGstLabel } from '../../config/business';

import GstTaxSummary from '../invoice/GstTaxSummary';

import InvoiceLineItemsTable from '../invoice/InvoiceLineItemsTable';



export default function InvoiceLetterPreview({

  invoiceNumber = 'INV-DRAFT',

  invoiceDate,

  party,

  items = [],

  gstPercent = 18,

  subtotal = 0,

  gstAmount = 0,

  total = 0,

  compact = false,

}) {

  return (

    <div className={`invoice-letter ${compact ? 'invoice-letter-compact' : ''}`}>

      <div className="invoice-letter-head">

        <div>

          <p className="invoice-brand">{BUSINESS.name}</p>

          <p className="invoice-brand-sub">{BUSINESS.tagline}</p>

          <p className="invoice-meta-line">{BUSINESS.address}</p>

          <p className="invoice-meta-line">{businessGstLabel()}</p>

          {BUSINESS.phone && <p className="invoice-meta-line">{BUSINESS.phone}</p>}

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



      <p className="invoice-footer-note">Thank you for your business.</p>

    </div>

  );

}


