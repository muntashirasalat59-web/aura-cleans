import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Plus } from 'lucide-react';
import { citiesAPI } from '../../api';
import { FormField } from './FormField';

function visibleCities(cities, selectedId) {
  return (cities || []).filter(
    (c) => c.is_active !== false || String(c.id) === String(selectedId)
  );
}

/**
 * Invoice City/Branch picker: list + last option "+ Add new city"
 * with a small inline name field. Does not appear on the PDF.
 */
export default function CityBranchField({
  cities = [],
  value,
  onChange,
  onCityCreated,
  required = true,
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const options = visibleCities(cities, value);
  const selected = options.find((c) => String(c.id) === String(value));

  useEffect(() => {
    if (!adding) return undefined;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [adding]);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function startAdd() {
    setOpen(false);
    setAdding(true);
    setError('');
    setName('');
  }

  function cancelAdd() {
    setAdding(false);
    setName('');
    setError('');
  }

  function pickCity(id) {
    onChange(String(id));
    setOpen(false);
    setAdding(false);
    setError('');
  }

  async function handleAdd(e) {
    e.preventDefault();
    e.stopPropagation();
    const city_name = name.replace(/\s+/g, ' ').trim();
    if (!city_name) {
      setError('Enter a city name');
      return;
    }
    const existing = (cities || []).find(
      (c) => String(c.city_name || '').trim().toLowerCase() === city_name.toLowerCase()
    );
    if (existing) {
      pickCity(existing.id);
      return;
    }
    try {
      setSaving(true);
      setError('');
      const created = await citiesAPI.create({ city_name });
      onCityCreated?.(created);
      pickCity(created.id);
      setName('');
    } catch (err) {
      setError(err.message || 'Could not add city');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormField
      label="City/Branch"
      required={required}
      hint="Internal tag only — not printed on the PDF."
    >
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          className="input input-premium flex w-full items-center justify-between text-left"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            setOpen((v) => !v);
            if (adding) cancelAdd();
          }}
        >
          <span className={selected ? '' : 'text-slate-400'}>
            {selected ? selected.city_name : 'Select city'}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>

        {open && (
          <ul
            className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
            role="listbox"
          >
            {options.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500">No cities yet</li>
            )}
            {options.map((city) => (
              <li key={city.id} role="option" aria-selected={String(city.id) === String(value)}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 dark:hover:bg-indigo-950/50 ${
                    String(city.id) === String(value)
                      ? 'bg-indigo-50 font-medium dark:bg-indigo-950/40'
                      : ''
                  }`}
                  onClick={() => pickCity(city.id)}
                >
                  {city.city_name}
                  {city.is_active === false ? ' (inactive)' : ''}
                </button>
              </li>
            ))}
            <li className="border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                onClick={startAdd}
              >
                + Add new city
              </button>
            </li>
          </ul>
        )}
      </div>

      {adding && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            className="input input-premium flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Surat"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleAdd(e);
              }
              if (e.key === 'Escape') cancelAdd();
            }}
          />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
            <button type="button" className="btn btn-secondary" onClick={cancelAdd} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Native fallback so form validation still sees a city_id */}
      <select
        className="sr-only"
        tabIndex={-1}
        required={required && !adding}
        value={value || ''}
        onChange={() => {}}
        aria-hidden="true"
      >
        <option value="">{/* empty */}</option>
        {options.map((city) => (
          <option key={city.id} value={city.id}>
            {city.city_name}
          </option>
        ))}
      </select>
    </FormField>
  );
}
