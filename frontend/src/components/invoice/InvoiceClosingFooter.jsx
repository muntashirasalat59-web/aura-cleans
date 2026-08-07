import { useState } from 'react';
import { INVOICE_FOOTER_NOTE } from '../../config/business';

/** Hardcoded public assets (not Business Settings). Optional stamp.png if present. */
const SIGNATURE_SRC = '/signature.png';
const STAMP_SRC = '/stamp.png';

/** Thank-you note and authorized signatory — shared by preview, print, and PDF layout. */
export default function InvoiceClosingFooter({ compact = false }) {
  const [showStamp, setShowStamp] = useState(true);

  return (
    <footer className={`invoice-closing-footer ${compact ? 'invoice-closing-footer-compact' : ''}`}>
      <div className="invoice-signatory-block">
        <div className={`invoice-signatory-media${showStamp ? ' has-company-stamp' : ''}`}>
          {showStamp && (
            <img
              src={STAMP_SRC}
              alt=""
              className="invoice-company-stamp"
              width={90}
              height={90}
              onError={() => setShowStamp(false)}
            />
          )}
          <img
            src={SIGNATURE_SRC}
            alt="Authorized signature"
            className="invoice-signature-image"
            width={160}
            height={70}
          />
        </div>
        <p className="invoice-stamp-label">Authorized Signatory</p>
      </div>
      <p className="invoice-preview-footer-note">{INVOICE_FOOTER_NOTE}</p>
    </footer>
  );
}
