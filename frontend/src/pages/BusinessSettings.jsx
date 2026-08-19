import { useEffect, useRef, useState } from 'react';
import { Building2, Image as ImageIcon, PenTool, Stamp, Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { settingsAPI, citiesAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import { useBusinessSettings } from '../context/BusinessSettingsContext';
import { notifyDataSync } from '../lib/dataSync';
import { useDataSync } from '../hooks/useDataSync';

const emptyForm = () => ({
  company_name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  gstin: '',
  phone: '',
  email: '',
  monthly_sales_target: '',
});

const MAX_BYTES = 2 * 1024 * 1024; // 2MB

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function BrandImageUpload({ label, icon: Icon, type, currentUrl, onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLocalError('Please choose an image file');
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError('Image must be under 2MB');
      return;
    }

    try {
      setUploading(true);
      setLocalError('');
      const base64 = await fileToBase64(file);
      const result = await settingsAPI.uploadImage(type, base64);
      onUploaded(result.url);
    } catch (err) {
      setLocalError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-[var(--aura-text)]">{label}</span>
      <div className="flex items-center gap-3">
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[var(--aura-radius-input)] border border-[var(--aura-border)] bg-[var(--aura-elevated)]"
          style={{ boxShadow: 'var(--aura-shadow-soft)' }}
        >
          {currentUrl ? (
            <img src={currentUrl} alt={label} className="h-full w-full object-contain p-1" />
          ) : (
            <Icon size={22} className="text-[var(--aura-muted)]" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="btn btn-secondary btn-sm w-fit"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" /> Uploading…
              </span>
            ) : currentUrl ? (
              'Replace'
            ) : (
              'Upload'
            )}
          </button>
          <span className="text-xs text-[var(--aura-muted)]">PNG, JPEG, or SVG, up to 2MB</span>
          {localError && <span className="text-xs text-[var(--aura-danger)]">{localError}</span>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}

function CitiesManager() {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const loadCities = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const rows = await citiesAPI.getAll();
      setCities(rows || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load cities');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadCities();
  }, []);

  useDataSync('business_cities', () => loadCities(true));

  async function handleAdd(e) {
    e.preventDefault();
    const city_name = name.trim();
    if (!city_name) return;
    try {
      setSaving(true);
      setError('');
      await citiesAPI.create({ city_name });
      setName('');
      notifyDataSync('business_cities');
      await loadCities(true);
    } catch (err) {
      setError(err.message || 'Could not add city');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(city) {
    try {
      setBusyId(city.id);
      setError('');
      await citiesAPI.update(city.id, { is_active: city.is_active === false });
      notifyDataSync('business_cities');
      await loadCities(true);
    } catch (err) {
      setError(err.message || 'Could not update city');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(city) {
    if (!confirm(`Remove ${city.city_name}? Invoices already tagged keep their city name until you reassign them.`)) {
      return;
    }
    try {
      setBusyId(city.id);
      setError('');
      const result = await citiesAPI.delete(city.id);
      notifyDataSync('business_cities');
      await loadCities(true);
      if (result?.deactivated) {
        setError('This city has invoices, so it was deactivated instead of deleted.');
      }
    } catch (err) {
      setError(err.message || 'Could not remove city');
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = cities.filter((c) => c.is_active !== false).length;

  return (
    <FormShell
      icon={MapPin}
      title="Manage Cities/Branches"
      subtitle="Tag invoices by city. This list does not change the invoice PDF — only reports and filters use it."
    >
      {loading ? (
        <p className="text-sm text-[var(--aura-muted)]">Loading cities…</p>
      ) : (
        <ul className="mb-4 divide-y divide-[var(--aura-border)] rounded-[var(--aura-radius-input)] border border-[var(--aura-border)]">
          {cities.map((city) => (
            <li key={city.id} className="flex items-center gap-3 px-3 py-2.5">
              <span
                className={`flex-1 text-sm font-medium ${
                  city.is_active === false
                    ? 'text-slate-400 line-through'
                    : 'text-[var(--aura-text)]'
                }`}
              >
                {city.city_name}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busyId === city.id || (city.is_active !== false && activeCount <= 1)}
                onClick={() => handleToggle(city)}
              >
                {city.is_active === false ? 'Activate' : 'Deactivate'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm text-red-500"
                disabled={busyId === city.id || cities.length <= 1}
                onClick={() => handleDelete(city)}
                title="Remove city"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <FormField label="Add city" className="flex-1">
          <input
            className="input input-premium"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Surat"
          />
        </FormField>
        <button type="submit" className="btn btn-primary shrink-0" disabled={saving || !name.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add city
        </button>
      </form>
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </FormShell>
  );
}

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
      monthly_sales_target:
        settings.monthly_sales_target === 0 || settings.monthly_sales_target
          ? String(settings.monthly_sales_target)
          : '',
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
      await settingsAPI.updateBusiness({
        ...form,
        monthly_sales_target: parseFloat(form.monthly_sales_target) || 0,
      });
      await refresh(true);
      notifyDataSync('business_settings');
      setMessage('Business details saved. New invoices and PDFs will use these values.');
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUploaded(field, url) {
    try {
      setError('');
      await settingsAPI.updateBusiness({ [field]: url });
      await refresh(true);
      notifyDataSync('business_settings');
      setMessage('Image updated.');
    } catch (err) {
      setError(err.message || 'Failed to save image');
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
            <FormField
              label="Legal company name"
              required
              className="sm:col-span-2"
              hint="Shown as the main heading on tax invoices (not the AURA brand name)."
            >
              <input
                className="input input-premium"
                value={form.company_name}
                onChange={(e) => updateField('company_name', e.target.value)}
                placeholder="e.g. LAIBA LUBRICANT PRIVATE LIMITED"
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
            <FormField label="State" hint="Shown on its own line on tax invoices.">
              <input
                className="input input-premium"
                value={form.state}
                onChange={(e) => updateField('state', e.target.value)}
                placeholder="e.g. Gujarat"
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
            <FormField
              label="Monthly sales target (₹)"
              className="sm:col-span-2"
              hint="Used on the Executive Dashboard progress ring"
            >
              <input
                type="number"
                min="0"
                step="0.01"
                className="input input-premium"
                value={form.monthly_sales_target}
                onChange={(e) => updateField('monthly_sales_target', e.target.value)}
                placeholder="e.g. 500000"
              />
            </FormField>
          </div>
        </FormShell>

        <FormShell
          icon={ImageIcon}
          title="Branding"
          subtitle="Logo, signature and stamp used on invoice PDFs."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <BrandImageUpload
              label="Logo"
              icon={ImageIcon}
              type="logo"
              currentUrl={settings?.logo_url}
              onUploaded={(url) => handleImageUploaded('logo_url', url)}
            />
            <BrandImageUpload
              label="Signature"
              icon={PenTool}
              type="signature"
              currentUrl={settings?.signature_url}
              onUploaded={(url) => handleImageUploaded('signature_url', url)}
            />
            <BrandImageUpload
              label="Stamp"
              icon={Stamp}
              type="stamp"
              currentUrl={settings?.stamp_url}
              onUploaded={(url) => handleImageUploaded('stamp_url', url)}
            />
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

      <div className="mt-6 max-w-3xl">
        <CitiesManager />
      </div>
    </div>
  );
}
