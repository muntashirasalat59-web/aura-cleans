import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, X } from 'lucide-react';

const WHAT_YOU_GET = [
  'A live Executive Dashboard — today\'s sales, monthly revenue, orders, low-stock alerts, and outstanding payments, all in one screen.',
  'Full product & inventory tracking — cost price, selling price, pack sizes, margins, and stock levels for every item.',
  'Party (customer/supplier) management with running balances and GST details.',
  'Purchase recording that automatically updates your stock — no manual re-entry.',
  'Professional GST invoices, downloadable as PDF and shareable directly on WhatsApp.',
  'Expense tracking by category, with monthly and yearly totals.',
  'Sales, purchase, and profit reports for any date range, exportable to Excel (CSV).',
  'A free pricing & margin calculator to test your numbers before you commit to a price.',
  'Staff/employee management with salary tracking.',
  'Your own business branding — logo, signature, and stamp — on every invoice.',
  'A 10-day free trial, no payment required to start, and your data is always kept safe even if your trial ends.',
  'Direct support — message our team anytime and we\'ll reply personally.',
];

const NOT_YET = [
  'Online payment/renewal — continuing after your trial is arranged directly with our team (no card/UPI checkout inside the app yet).',
  'SMS OTP verification on signup — your phone number is format-checked but not OTP-verified at this time.',
  'A dedicated mobile app — works great in your phone\'s browser, but no app-store app yet.',
  'Bulk Excel/CSV import for products or customers — items are added one by one, or automatically via purchases.',
  'Multi-branch support — built for a single business location per account today.',
  'Automatic reorder suggestions — low stock is flagged, but reordering is a manual decision.',
  'Multi-language interface — currently English only.',
];

export default function AuthDetailsModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="auth-details-overlay">
      <button type="button" className="auth-details-backdrop" aria-label="Close" onClick={onClose} />
      <div
        className="auth-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-details-title"
      >
        <div className="auth-details-header">
          <div className="min-w-0">
            <h2 id="auth-details-title" className="auth-details-title">
              AURA CLEAN — Premium Cloud ERP
            </h2>
            <p className="auth-details-subtitle">What you get, and what&apos;s not available yet</p>
          </div>
          <button type="button" className="auth-details-close" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="auth-details-body">
          <p className="auth-details-intro">
            We believe in being upfront. Before you start your free trial, here&apos;s a clear, honest
            picture of what AURA CLEAN can do for your business today — and what it doesn&apos;t do yet.
            No surprises.
          </p>

          <section className="auth-details-section">
            <h3 className="auth-details-heading auth-details-heading-yes">✅ What you get</h3>
            <ul className="auth-details-list">
              {WHAT_YOU_GET.map((item) => (
                <li key={item} className="auth-details-item auth-details-item-yes">
                  <Check className="auth-details-icon" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="auth-details-section">
            <h3 className="auth-details-heading auth-details-heading-not">⚠️ What&apos;s not available yet</h3>
            <ul className="auth-details-list">
              {NOT_YET.map((item) => (
                <li key={item} className="auth-details-item auth-details-item-not">
                  <AlertTriangle className="auth-details-icon" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="auth-details-note">
            We&apos;re actively building — most of the items above are on our near-term roadmap. If any of
            these matter a lot for your business, tell our support team; it genuinely helps us prioritize.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AuthDetailsLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="login-3d-details-link" onClick={() => setOpen(true)}>
        Details
      </button>
      <AuthDetailsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
