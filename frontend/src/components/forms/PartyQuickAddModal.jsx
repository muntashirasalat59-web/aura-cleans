import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';
import { partiesAPI } from '../../api';
import { FormField } from './FormField';
import { PARTY_TYPE_OPTIONS } from '../../utils/partyTypes';

const emptyQuickForm = (defaultType) => ({
  name: '',
  type: defaultType,
  contact: '',
  gst_number: '',
});

export default function PartyQuickAddModal({
  open,
  onClose,
  title = 'Add party',
  subtitle = 'Saved to Parties and selected for this form.',
  defaultType = 'retailer',
  allowedTypes = ['retailer', 'wholesaler'],
  onSaved,
}) {
  const [form, setForm] = useState(emptyQuickForm(defaultType));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(emptyQuickForm(defaultType));
      setError('');
    }
  }, [open, defaultType]);

  if (!open) return null;

  const typeOptions = PARTY_TYPE_OPTIONS.filter((o) => allowedTypes.includes(o.value));

  async function handleSave() {
    setError('');

    if (!form.name.trim()) {
      setError('Party name is required.');
      return;
    }

    try {
      setSaving(true);

      let party;
      try {
        party = await partiesAPI.create({
          name: form.name.trim(),
          type: form.type,
          contact: form.contact.trim(),
          gst_number: form.gst_number.trim(),
          address: '',
          balance: 0,
        });
      } catch (err) {
        throw new Error(
          err.message
            ? `Could not save customer: ${err.message}`
            : 'Could not save customer. Check that the backend is running and try again.'
        );
      }

      if (!party?.id) {
        throw new Error(
          'Customer may have been saved, but the server did not return details. Open the Parties page to confirm.'
        );
      }

      try {
        await Promise.resolve(onSaved?.(party));
      } catch (err) {
        throw new Error(
          err.message
            ? err.message
            : 'Customer saved, but could not be selected on this form. Pick them from the dropdown.'
        );
      }

      setForm(emptyQuickForm(defaultType));
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    setForm(emptyQuickForm(defaultType));
    setError('');
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="Close"
        onClick={handleClose}
      />
      <div
        className="relative w-full max-w-md premium-glass-card p-6 shadow-2xl border border-indigo-200/50 animate-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={handleClose}
            aria-label="Close"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <FormField label="Name" required>
            <input
              className="input input-premium"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Party / company name"
              autoFocus
              disabled={saving}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </FormField>
          <FormField label="Type" required>
            <select
              className="input input-premium"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              disabled={saving}
            >
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Contact">
            <input
              className="input input-premium"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="Phone / email"
              disabled={saving}
            />
          </FormField>
          <FormField label="GST number">
            <input
              className="input input-premium font-mono text-sm"
              value={form.gst_number}
              onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
              placeholder="Optional"
              disabled={saving}
            />
          </FormField>

          <div className="form-actions">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? 'Saving…' : 'Save & select'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary btn-lg"
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
