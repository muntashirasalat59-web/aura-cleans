import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { settingsAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import { useBusinessSettings } from '../context/BusinessSettingsContext';
import { notifyDataSync } from '../lib/dataSync';

const emptyForm = () => ({
  company_name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  gstin: '',
  phone: '',
  email: '',
});

export default function BusinessSettings() {
  const { settings, loading: settingsLoading, refresh } = useBusinessSettings();
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!settings) return;
    setForm({
      company_name: settings.company_name || '',
      address_line1: settings.address_line1 || '',
      address_line2: settings.address_line2 || '',
      city: settings.city || '',
      state: settings.state || '',
      gstin: settings.gstin || '',
      phone: settings.phone || '',
      email: settings.email || '',
    });
  }, [settings]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage('');
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');
      // Only company letterhead fields — do not overwrite bank_* columns with blanks.
      await settingsAPI.updateBusiness(form);
      await refresh(true);
      notifyDataSync('business_settings');
      setMessage('Business details saved. New invoices and PDFs will use these values.');
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (settingsLoading && !settings?.company_name && !form.company_name) {
    return <LoadingState />;
  }

  return (
    <div>
      <PageHeader
        title="Business Settings"
        description="Company letterhead and GSTIN shown on invoices."
      />

      {!settings?.configured && (
        <div className="status-banner status-banner-warning mb-6 dark:border dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Business details are not set up yet. Fill the form below — invoices will stop showing the
          setup placeholder once you save.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <FormShell
          icon={Building2}
          title="Company details"
          subtitle="Appears at the top of tax invoices and PDF exports."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Company name" required className="sm:col-span-2">
              <input
                className="input input-premium"
                value={form.company_name}
                onChange={(e) => updateField('company_name', e.target.value)}
                placeholder="e.g. AURA CLEAN"
                required
              />
            </FormField>
            <FormField label="Address line 1" className="sm:col-span-2">
              <input
                className="input input-premium"
                value={form.address_line1}
                onChange={(e) => updateField('address_line1', e.target.value)}
                placeholder="Street, building, area"
              />
            </FormField>
            <FormField label="Address line 2" className="sm:col-span-2">
              <input
                className="input input-premium"
                value={form.address_line2}
                onChange={(e) => updateField('address_line2', e.target.value)}
                placeholder="Landmark (optional)"
              />
            </FormField>
            <FormField label="City">
              <input
                className="input input-premium"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
              />
            </FormField>
            <FormField label="State">
              <input
                className="input input-premium"
                value={form.state}
                onChange={(e) => updateField('state', e.target.value)}
              />
            </FormField>
            <FormField label="GSTIN">
              <input
                className="input input-premium font-mono uppercase"
                value={form.gstin}
                onChange={(e) => updateField('gstin', e.target.value.toUpperCase())}
                placeholder="15-character GSTIN"
                maxLength={15}
              />
            </FormField>
            <FormField label="Phone">
              <input
                className="input input-premium"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+91 …"
              />
            </FormField>
            <FormField label="Email" className="sm:col-span-2">
              <input
                type="email"
                className="input input-premium"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="accounts@example.com"
              />
            </FormField>
          </div>
        </FormShell>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm font-medium text-[var(--status-success-text)] dark:text-emerald-400">
            {message}{' '}
            <Link to="/sales" className="underline font-medium">
              Open Sales
            </Link>
          </p>
        )}

        <FormActions
          showCancel={false}
          submitLabel={saving ? 'Saving…' : 'Save changes'}
          submitDisabled={saving}
        />
      </form>
    </div>
  );
}
