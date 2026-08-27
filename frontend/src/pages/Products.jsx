import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Package, AlertTriangle, X, IndianRupee, Barcode } from 'lucide-react';
import { productsAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import ExportMenu from '../components/ExportMenu';
import EmptyState from '../components/EmptyState';
import ListSearchInput, { matchesListSearch } from '../components/ListSearchInput';
import { PRODUCT_EXPORT_COLUMNS, mapProductExportRow } from '../config/exportColumns';
import FormShell from '../components/forms/FormShell';
import { FormField, inputClassName } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import SegmentedControl from '../components/forms/SegmentedControl';
import { useDataSync } from '../hooks/useDataSync';
import { notifyDataSync, removeById } from '../lib/dataSync';
import { formatPackSize } from '../utils/productDisplay';
import {
  PACK_SIZE_OPTIONS,
  FRAGRANCE_OPTIONS,
  parsePackSize,
  productToPackSize,
  resolveFragranceValue,
} from '../utils/productCatalog';
import { LOW_STOCK_THRESHOLD } from '../config/stock';
import {
  requiredText,
  positiveMoney,
  nonNegativeInteger,
  sanitizeDecimalInput,
  digitsOnly,
} from '../utils/formValidation';

const emptyForm = {
  name: '',
  category: '',
  supplier: '',
  cost_price: '',
  price: '',
  retail_price: '',
  pack_size: '500 ML',
  fragrance: 'Unscented',
  custom_fragrance: '',
  hsn_sac: '',
  sku: '',
  barcode: '',
  description: '',
  stock_quantity: '',
};

function generateSkuPreview(name) {
  const prefix = (name || 'PRD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase();
  const suffix = Date.now().toString(36).slice(-6).toUpperCase();
  return `${prefix || 'PRD'}-${suffix}`;
}

function profitMargin(selling, cost) {
  return Number(selling || 0) - Number(cost || 0);
}

/** Potential profit for on-hand stock. Non-positive margin or stock → 0. */
function potentialProfit(selling, cost, stock) {
  const margin = profitMargin(selling, cost);
  const qty = Number(stock) || 0;
  if (margin <= 0 || qty <= 0) return 0;
  return margin * qty;
}

function formatInr(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [formWarnings, setFormWarnings] = useState({});
  const [generatingBarcode, setGeneratingBarcode] = useState(false);

  const stockFilterActive = searchParams.get('stock') === 'low';
  const stockThreshold = Number(searchParams.get('threshold')) || LOW_STOCK_THRESHOLD;

  const displayedProducts = useMemo(() => {
    let list = products;
    if (stockFilterActive) {
      list = list
        .filter((p) => Number(p.stock_quantity) <= stockThreshold)
        .sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity));
    }
    return list.filter((p) =>
      matchesListSearch(listSearch, p.name, p.category, p.hsn_sac, p.sku, p.barcode)
    );
  }, [products, stockFilterActive, stockThreshold, listSearch]);

  const totalPotentialProfit = useMemo(() => {
    return products.reduce((sum, product) => {
      if (product.is_active === false) return sum;
      return sum + potentialProfit(product.price, product.cost_price, product.stock_quantity);
    }, 0);
  }, [products]);

  useEffect(() => {
    loadProducts();
  }, [statusFilter]);

  useDataSync('products', () => loadProducts(true));

  async function loadProducts(silent = false) {
    try {
      if (!silent) setLoading(true);
      const opts = {};
      if (statusFilter === 'active') opts.status = 'active';
      else if (statusFilter === 'inactive') opts.status = 'inactive';
      const data = await productsAPI.getAll(opts);
      setProducts(data);
    } catch (err) {
      if (!silent) alert('Error: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function clearStockFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete('stock');
    next.delete('threshold');
    setSearchParams(next, { replace: true });
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormWarnings({});
    setShowForm(true);
  }

  function openEditForm(product) {
    setEditingId(product.id);
    const stored = product.fragrance || 'Unscented';
    const isPreset = FRAGRANCE_OPTIONS.includes(stored);
    setForm({
      name: product.name || '',
      category: product.category || '',
      supplier: product.supplier || '',
      cost_price: product.cost_price ?? '',
      price: product.price ?? '',
      retail_price: product.retail_price ?? '',
      pack_size: productToPackSize(product),
      fragrance: isPreset ? stored : 'Other',
      custom_fragrance: isPreset ? '' : stored,
      hsn_sac: product.hsn_sac || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      description: product.description || '',
      stock_quantity: product.stock_quantity ?? '',
    });
    setFormErrors({});
    setFormWarnings({});
    setShowForm(true);
  }

  function updateForm(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
    const keys = Object.keys(patch);
    if (keys.length) {
      setFormErrors((prev) => {
        const next = { ...prev };
        keys.forEach((key) => {
          delete next[key];
        });
        return next;
      });
      setFormWarnings((prev) => {
        const next = { ...prev };
        keys.forEach((key) => {
          delete next[key];
        });
        return next;
      });
    }
  }

  function validateProductForm() {
    const errors = {};
    const warnings = {};

    const nameErr = requiredText(form.name, 'This field is required');
    if (nameErr) errors.name = nameErr;

    const categoryErr = requiredText(form.category, 'This field is required');
    if (categoryErr) errors.category = categoryErr;

    if (form.fragrance === 'Other' && !form.custom_fragrance.trim()) {
      errors.custom_fragrance = 'Enter a custom fragrance name.';
    }

    const costErr = positiveMoney(form.cost_price, { field: 'Cost price', min: 0.01 });
    if (costErr) errors.cost_price = costErr;

    const priceErr = positiveMoney(form.price, { field: 'Wholesale price', min: 0.01 });
    if (priceErr) errors.price = priceErr;

    const retailErr = positiveMoney(form.retail_price, { field: 'Retail price', min: 0.01 });
    if (retailErr) errors.retail_price = retailErr;

    if (!costErr && !priceErr && Number(form.price) < Number(form.cost_price)) {
      warnings.price = 'Wholesale price is lower than cost';
    }

    if (!priceErr && !retailErr && Number(form.retail_price) < Number(form.price)) {
      warnings.retail_price = 'Retail price is lower than wholesale';
    }

    const stockErr = nonNegativeInteger(form.stock_quantity, { field: 'Stock quantity' });
    if (stockErr) errors.stock_quantity = stockErr;

    setFormErrors(errors);
    setFormWarnings(warnings);
    return Object.keys(errors).length === 0;
  }

  const marginAmount = profitMargin(form.price, form.cost_price);
  const marginPct =
    Number(form.cost_price) > 0
      ? ((Number(form.price || 0) - Number(form.cost_price)) / Number(form.cost_price)) * 100
      : null;

  const sellingBelowCostWarning =
    form.price !== '' &&
    form.cost_price !== '' &&
    Number.isFinite(Number(form.price)) &&
    Number.isFinite(Number(form.cost_price)) &&
    Number(form.price) < Number(form.cost_price)
      ? 'Wholesale price is lower than cost'
      : formWarnings.price || null;

  const retailBelowWholesaleWarning =
    form.retail_price !== '' &&
    form.price !== '' &&
    Number.isFinite(Number(form.retail_price)) &&
    Number.isFinite(Number(form.price)) &&
    Number(form.retail_price) < Number(form.price)
      ? 'Retail price is lower than wholesale'
      : formWarnings.retail_price || null;

  function handleGenerateSku() {
    setForm((prev) => ({ ...prev, sku: generateSkuPreview(prev.name) }));
  }

  async function handleGenerateBarcode() {
    setGeneratingBarcode(true);
    try {
      const { barcode } = await productsAPI.generateBarcode();
      setForm((prev) => ({ ...prev, barcode }));
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setGeneratingBarcode(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateProductForm()) return;

    const fragranceToSave =
      form.fragrance === 'Other'
        ? resolveFragranceValue('Other', form.custom_fragrance)
        : form.fragrance;

    try {
      const { unit_size, unit_type } = parsePackSize(form.pack_size);
      const data = {
        name: form.name.trim(),
        category: form.category.trim(),
        supplier: form.supplier,
        cost_price: parseFloat(form.cost_price) || 0,
        price: parseFloat(form.price) || 0,
        retail_price: parseFloat(form.retail_price) || 0,
        unit_type,
        unit_size,
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
        description: form.description,
        fragrance: fragranceToSave,
        hsn_sac: form.hsn_sac.trim(),
        stock_quantity: parseInt(form.stock_quantity, 10) || 0,
      };

      if (editingId) {
        await productsAPI.update(editingId, data);
      } else {
        await productsAPI.create(data);
      }

      setShowForm(false);
      setFormErrors({});
      setFormWarnings({});
      notifyDataSync('products');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleDeactivate(id) {
    if (!confirm('Deactivate this product? It will be hidden from new invoices/purchases but past records stay intact.')) return;
    try {
      await productsAPI.deactivate(id);
      if (statusFilter === 'active') {
        setProducts((prev) => removeById(prev, id));
      } else {
        setProducts((prev) =>
          prev.map((product) => (product.id === id ? { ...product, is_active: false } : product))
        );
      }
      notifyDataSync('products');
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleReactivate(id) {
    try {
      await productsAPI.reactivate(id);
      if (statusFilter === 'inactive') {
        setProducts((prev) => removeById(prev, id));
      } else {
        setProducts((prev) =>
          prev.map((product) => (product.id === id ? { ...product, is_active: true } : product))
        );
      }
      notifyDataSync('products');
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(id) {
    if (
      !confirm(
        'Permanently delete this product? This is blocked if it appears on any sales invoice. Purchase-only history for this product will be removed.'
      )
    ) {
      return;
    }
    try {
      const result = await productsAPI.delete(id);
      setProducts((prev) => removeById(prev, id));
      notifyDataSync('products');
      notifyDataSync('purchases');
      alert(result.message || 'Product deleted successfully.');
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading && products.length === 0) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Products"
        description="Detailed catalog with cost, wholesale, and retail prices."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <ExportMenu
              filePrefix="products"
              successLabel="Products"
              columns={PRODUCT_EXPORT_COLUMNS}
              getRows={() => displayedProducts.map(mapProductExportRow)}
            />
            <button onClick={openAddForm} className="btn btn-primary w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Add product
            </button>
          </div>
        }
      />

      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <SegmentedControl
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
        {stockFilterActive && (
          <div className="status-banner status-banner-warning inline-flex items-center gap-2 py-2 dark:border dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--status-warning-text)] dark:text-amber-300" />
            <span>
              Showing stock ≤ {stockThreshold} ({displayedProducts.length})
            </span>
            <button
              type="button"
              onClick={clearStockFilter}
              className="ml-1 rounded-lg p-1 hover:bg-amber-200/60 dark:hover:bg-amber-900/50"
              aria-label="Clear stock filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="form-panel">
          <FormShell
            icon={Package}
            title={editingId ? 'Edit product' : 'New product'}
            subtitle="Catalog and pricing details for accurate stock and profit tracking."
          >
            <form
              onSubmit={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault();
              }}
            >
              <section className="form-section">
                <p className="form-section-label">Basic details</p>
                <div className="form-section-grid">
                  <FormField label="Product name" required error={formErrors.name} className="md:col-span-2">
                    <input
                      className={inputClassName(formErrors.name)}
                      value={form.name}
                      onChange={(e) => updateForm({ name: e.target.value })}
                      placeholder="e.g. Aura Hand Wash"
                    />
                  </FormField>
                  <FormField label="Pack size">
                    <select
                      className={inputClassName()}
                      value={form.pack_size}
                      onChange={(e) => updateForm({ pack_size: e.target.value })}
                    >
                      {PACK_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Fragrance">
                    <select
                      className={inputClassName()}
                      value={form.fragrance}
                      onChange={(e) => {
                        const next = e.target.value;
                        updateForm({
                          fragrance: next,
                          custom_fragrance: next === 'Other' ? form.custom_fragrance : '',
                        });
                      }}
                    >
                      {FRAGRANCE_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {form.fragrance === 'Other' && (
                    <FormField
                      label="Custom fragrance name"
                      required
                      error={formErrors.custom_fragrance}
                      className="md:col-span-2"
                    >
                      <input
                        className={inputClassName(formErrors.custom_fragrance)}
                        value={form.custom_fragrance}
                        onChange={(e) => updateForm({ custom_fragrance: e.target.value })}
                        placeholder="e.g. Mango, Coconut"
                      />
                    </FormField>
                  )}
                  <FormField label="HSN/SAC code" hint="Used on GST invoices">
                    <input
                      className={inputClassName(false, 'font-mono')}
                      value={form.hsn_sac}
                      onChange={(e) => updateForm({ hsn_sac: e.target.value })}
                      placeholder="e.g. 3401"
                      maxLength={20}
                    />
                  </FormField>
                  <FormField label="Category" required error={formErrors.category}>
                    <input
                      className={inputClassName(formErrors.category)}
                      value={form.category}
                      onChange={(e) => updateForm({ category: e.target.value })}
                      placeholder="Grocery, Personal care…"
                    />
                  </FormField>
                </div>
              </section>

              <section className="form-section">
                <p className="form-section-label">Inventory & codes</p>
                <div className="form-section-grid">
                  <FormField label="Supplier / purchased from">
                    <input
                      className={inputClassName()}
                      value={form.supplier}
                      onChange={(e) => updateForm({ supplier: e.target.value })}
                      placeholder="Vendor name"
                    />
                  </FormField>
                  <FormField label="Stock quantity" error={formErrors.stock_quantity}>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className={inputClassName(formErrors.stock_quantity)}
                      value={form.stock_quantity}
                      onChange={(e) =>
                        updateForm({ stock_quantity: digitsOnly(e.target.value) })
                      }
                      placeholder="0"
                    />
                  </FormField>
                  <FormField label="SKU / product code">
                    <div className="flex gap-2">
                      <input
                        className={inputClassName()}
                        value={form.sku}
                        onChange={(e) => updateForm({ sku: e.target.value })}
                        placeholder="Auto on save if empty"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateSku}
                        className="btn btn-secondary shrink-0"
                      >
                        Auto
                      </button>
                    </div>
                  </FormField>
                  <FormField label="Barcode" hint="Scan or type — used to find this product by scanner">
                    <div className="flex gap-2">
                      <input
                        className={inputClassName(false, 'font-mono')}
                        value={form.barcode}
                        onChange={(e) => updateForm({ barcode: e.target.value })}
                        placeholder="Scan or generate"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateBarcode}
                        disabled={generatingBarcode}
                        className="btn btn-secondary shrink-0"
                      >
                        <Barcode className="h-3.5 w-3.5" />
                        {generatingBarcode ? '…' : 'Generate'}
                      </button>
                    </div>
                  </FormField>
                  <FormField label="Description" className="md:col-span-2">
                    <textarea
                      className={inputClassName(false, 'min-h-[96px] resize-y')}
                      rows={3}
                      value={form.description}
                      onChange={(e) => updateForm({ description: e.target.value })}
                      placeholder="Packaging, brand notes…"
                    />
                  </FormField>
                </div>
              </section>

              <section className="form-section">
                <p className="form-section-label">Pricing</p>
                <div className="form-section-grid">
                  <FormField label="Cost price (₹)" required error={formErrors.cost_price}>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inputClassName(formErrors.cost_price)}
                      value={form.cost_price}
                      onChange={(e) =>
                        updateForm({ cost_price: sanitizeDecimalInput(e.target.value) })
                      }
                      placeholder="0.00"
                    />
                  </FormField>
                  <FormField
                    label="Wholesale price (₹)"
                    required
                    error={formErrors.price}
                    warning={sellingBelowCostWarning}
                    hint="B2B / dealer rate"
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inputClassName(formErrors.price)}
                      value={form.price}
                      onChange={(e) =>
                        updateForm({ price: sanitizeDecimalInput(e.target.value) })
                      }
                      placeholder="0.00"
                    />
                  </FormField>
                  <FormField
                    label="Retail price (₹)"
                    required
                    error={formErrors.retail_price}
                    warning={retailBelowWholesaleWarning}
                    hint="Consumer / MRP rate"
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inputClassName(formErrors.retail_price)}
                      value={form.retail_price}
                      onChange={(e) =>
                        updateForm({ retail_price: sanitizeDecimalInput(e.target.value) })
                      }
                      placeholder="0.00"
                    />
                  </FormField>
                </div>
                <div className="form-summary-card">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="form-summary-label">Margin per unit</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Selling − cost uses wholesale (auto-calculated)
                      </p>
                    </div>
                    <div>
                      <p
                        className={`form-summary-value ${
                          marginAmount < 0
                            ? 'text-red-600 dark:text-red-400'
                            : marginAmount > 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : ''
                        }`}
                      >
                        {marginAmount < 0 ? '−' : ''}₹
                        {Math.abs(marginAmount).toLocaleString('en-IN', {
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="form-summary-meta">
                        {marginPct == null
                          ? 'Enter cost to see markup %'
                          : `${marginPct >= 0 ? '+' : ''}${marginPct.toFixed(1)}% on cost`}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <FormActions
                submitLabel={editingId ? 'Update product' : 'Save product'}
                onCancel={() => {
                  setShowForm(false);
                  setFormErrors({});
                  setFormWarnings({});
                }}
              />
            </form>
          </FormShell>
        </div>
      )}

      <div className="mb-6 group rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card p-6 shadow-soft transition-all duration-lift ease-lift hover:-translate-y-0.5 hover:shadow-medium">
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[length:var(--aura-type-caption)] font-semibold uppercase tracking-wider text-aura-muted">
              Total Potential Profit (All Stock)
            </p>
            <p className="mt-2 truncate text-[length:var(--aura-type-h3)] font-bold tracking-tight tabular-nums text-aura-text">
              {formatInr(totalPotentialProfit)}
            </p>
            <p className="mt-2 text-[length:var(--aura-type-body)] text-aura-text-secondary">
              Sum of margin × stock across active products
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-primary)_16%,transparent)] text-aura-primary shadow-soft transition-transform duration-lift ease-lift group-hover:scale-[1.02]">
            <IndianRupee className="h-5 w-5" strokeWidth={2} />
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-wrap-header flex-wrap">
          <div className="min-w-0">
            <h3 className="card-section-title mb-0">Product catalog</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {displayedProducts.length} item{displayedProducts.length === 1 ? '' : 's'}
              {listSearch.trim() ? ' matching search' : ''}
            </p>
          </div>
          <ListSearchInput
            value={listSearch}
            onChange={setListSearch}
            placeholder="Search products..."
            aria-label="Search products by name, category, HSN, or barcode"
          />
        </div>
        {displayedProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title={
              listSearch.trim()
                ? 'No matching products'
                : stockFilterActive
                  ? 'No low-stock products'
                  : 'No products yet'
            }
            description={
              listSearch.trim()
                ? 'Try another name, category, HSN/SAC code, or barcode.'
                : stockFilterActive
                  ? `Nothing at or below ${stockThreshold} units with the current filters.`
                  : 'Add your first product to track cost, wholesale, retail, and stock.'
            }
            actionLabel={
              listSearch.trim() || stockFilterActive ? undefined : 'Add product'
            }
            onAction={listSearch.trim() || stockFilterActive ? undefined : openAddForm}
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Supplier</th>
                  <th className="col-num">Cost</th>
                  <th className="col-num">Wholesale</th>
                  <th className="col-num">Retail</th>
                  <th>Pack size</th>
                  <th>HSN/SAC</th>
                  <th>Barcode</th>
                  <th>Fragrance</th>
                  <th className="col-num">Margin</th>
                  <th className="col-num">Potential Profit</th>
                  <th className="col-num">Stock</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedProducts.map((product) => {
                  const margin = profitMargin(product.price, product.cost_price);
                  const profit = potentialProfit(
                    product.price,
                    product.cost_price,
                    product.stock_quantity
                  );
                  const isActive = product.is_active !== false;
                  return (
                    <tr key={product.id} className={!isActive ? 'opacity-80' : undefined}>
                      <td>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="list-primary">{product.name}</p>
                          {formatPackSize(product) && (
                            <span className="badge badge-size">{formatPackSize(product)}</span>
                          )}
                        </div>
                        <p className="list-secondary">
                          {product.category || 'Uncategorized'}
                          {product.sku ? ` · ${product.sku}` : ''}
                        </p>
                      </td>
                      <td>
                        {isActive ? (
                          <span className="badge badge-green">Active</span>
                        ) : (
                          <span className="badge badge-red">Inactive</span>
                        )}
                      </td>
                      <td className="max-w-[140px] truncate" title={product.supplier}>
                        {product.supplier || '—'}
                      </td>
                      <td className="col-num">
                        ₹{Number(product.cost_price || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="col-num font-medium">
                        ₹{Number(product.price || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="col-num font-medium">
                        ₹{Number(product.retail_price || 0).toLocaleString('en-IN')}
                      </td>
                      <td>
                        {formatPackSize(product) ? (
                          <span className="badge badge-size">{formatPackSize(product)}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {product.hsn_sac || '—'}
                      </td>
                      <td className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {product.barcode || '—'}
                      </td>
                      <td className="text-slate-700 dark:text-slate-300">
                        {product.fragrance || 'Unscented'}
                      </td>
                      <td className="col-num">
                        <span
                          className={`font-semibold ${
                            margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'
                          }`}
                        >
                          {formatInr(margin)}
                        </span>
                      </td>
                      <td className="col-num">
                        <span
                          className={`font-semibold tabular-nums ${
                            profit > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {formatInr(profit)}
                        </span>
                      </td>
                      <td className="col-num">
                        {product.stock_quantity <= LOW_STOCK_THRESHOLD ? (
                          <span className="badge badge-orange">{product.stock_quantity}</span>
                        ) : (
                          <span className="font-medium">{product.stock_quantity}</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="list-actions">
                          <button type="button" onClick={() => openEditForm(product)} className="link-action">
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          {isActive ? (
                            <button
                              type="button"
                              onClick={() => handleDeactivate(product.id)}
                              className="link-action-muted"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReactivate(product.id)}
                              className="link-action-muted"
                            >
                              Reactivate
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(product.id)}
                            className="link-action-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}