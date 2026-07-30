import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { FormField } from './FormField';
import PartyQuickAddModal from './PartyQuickAddModal';
import { partyTypeLabel } from '../../utils/partyTypes';

function mergeParties(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const p of list || []) {
      if (p?.id != null) map.set(String(p.id), p);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );
}

function filterParties(parties, { defaultTypes, showAll, query, selectedId }) {
  const q = query.trim().toLowerCase();
  return (parties || []).filter((p) => {
    if (p.is_active === false && String(p.id) !== String(selectedId)) return false;
    const idMatch = String(p.id) === String(selectedId);
    if (!showAll && !defaultTypes.includes(p.type) && !idMatch) return false;
    if (!q) return true;
    return (
      p.name?.toLowerCase().includes(q) ||
      p.contact?.toLowerCase().includes(q) ||
      p.gst_number?.toLowerCase().includes(q) ||
      partyTypeLabel(p.type).toLowerCase().includes(q)
    );
  });
}

export default function PartySelectField({
  label,
  required = false,
  className = '',
  value,
  onChange,
  parties,
  onPartyCreated,
  defaultTypes,
  showAllLabel = 'Show all party types',
  quickAddLabel = '+ New party',
  quickAddTitle = 'Add party',
  quickAddDefaultType = 'retailer',
  quickAddAllowedTypes,
  placeholder = 'Search party…',
}) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [pinnedParties, setPinnedParties] = useState([]);
  const wrapRef = useRef(null);
  const selectingRef = useRef(false);

  const displayParties = useMemo(
    () => mergeParties(parties, pinnedParties),
    [parties, pinnedParties]
  );

  const selected = displayParties.find((p) => String(p.id) === String(value));

  const filtered = useMemo(
    () => filterParties(displayParties, { defaultTypes, showAll, query, selectedId: value }),
    [displayParties, defaultTypes, showAll, query, value]
  );

  useEffect(() => {
    if (!parties?.length) return;
    setPinnedParties((prev) => {
      const remaining = prev.filter(
        (p) => !parties.some((row) => String(row.id) === String(p.id))
      );
      return remaining.length === prev.length ? prev : remaining;
    });
  }, [parties]);

  useEffect(() => {
    if (selectingRef.current) return;
    if (selected && !open) {
      setQuery(selected.name);
    } else if (!value && !open) {
      setQuery('');
    }
  }, [selected, value, open]);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        if (selected) setQuery(selected.name);
        else if (!value) setQuery('');
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [selected, value]);

  function selectParty(party) {
    if (!party?.id) return;
    selectingRef.current = true;
    onChange(String(party.id));
    setQuery(party.name || '');
    setOpen(false);
    queueMicrotask(() => {
      selectingRef.current = false;
    });
  }

  function clearSelection() {
    onChange('');
    setQuery('');
    setOpen(true);
  }

  async function handlePartySaved(party) {
    if (!party?.id) {
      throw new Error('Customer saved, but the server response was incomplete. Check the Parties page.');
    }

    setPinnedParties((prev) => mergeParties(prev, [party]));

    let toSelect = party;
    if (onPartyCreated) {
      const result = await onPartyCreated(party);
      if (result?.id != null) {
        toSelect = result;
        setPinnedParties((prev) => mergeParties(prev, [result]));
      }
    }

    selectParty(toSelect);
    return toSelect;
  }

  return (
    <>
      <FormField label={label} required={required} className={className}>
        <div ref={wrapRef} className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                className="input input-premium pl-9 pr-9"
                placeholder={placeholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  if (value) onChange('');
                }}
                onFocus={() => setOpen(true)}
                autoComplete="off"
              />
              {(value || query) && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon h-7 w-7"
                  onClick={clearSelection}
                  aria-label="Clear"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {open && (
                <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1">
                  {filtered.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-slate-500">No parties match your search.</li>
                  ) : (
                    filtered.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={`w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors ${
                            String(p.id) === String(value) ? 'bg-indigo-50/80' : ''
                          }`}
                          onClick={() => selectParty(p)}
                        >
                          <span className="font-medium text-slate-900">{p.name}</span>
                          <span className="text-xs text-slate-500 ml-2">
                            {partyTypeLabel(p.type)}
                            {p.contact ? ` · ${p.contact}` : ''}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            <button
              type="button"
              className="btn btn-secondary shrink-0 whitespace-nowrap"
              onClick={() => setQuickAddOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {quickAddLabel.replace(/^\+\s*/, '')}
            </button>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            {showAllLabel}
          </label>

          {/* Party selection validated in parent form submit */}
        </div>
      </FormField>

      <PartyQuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        title={quickAddTitle}
        defaultType={quickAddDefaultType}
        allowedTypes={quickAddAllowedTypes}
        onSaved={handlePartySaved}
      />
    </>
  );
}
