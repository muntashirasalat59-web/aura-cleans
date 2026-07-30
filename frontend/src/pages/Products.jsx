import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { productsAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import SegmentedControl from '../components/forms/SegmentedControl';
import { formatPackSize } from '../utils/productDisplay';
import {
  PACK_SIZE_OPTIONS,
  FRAGRANCE_OPTIONS,
  parsePackSize,
  productToPackSize,
  resolveFragranceValue,
} from '../utils/productCatalog';

const emptyForm = {
  name: '',
  category: '',
  supplier: '',
  cost_price: '',
  price: '',
  pack_size: '500 ML',
  fragrance: 'Unscented',
  custom_fragrance: '',
  hsn_sac: '',
  sku: '',
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

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadProducts();
  }, [statusFilter]);

  async function loadProducts() {
    try {
      const opts = {};
      if (statusFilter === 'active') opts.status = 'active';
      else if (statusFilter === 'inactive') opts.status = 'inactive';
      const data = await productsAPI.getAll(opts);
      setProducts(data);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
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
      pack_size: productToPackSize(product),
      fragrance: isPreset ? stored : 'Other',
      custom_fragrance: isPreset ? '' : stored,
      hsn_sac: product.hsn_sac || '',
      sku: product.sku || '',
      description: product.description || '',
      stock_quantity: product.stock_quantity ?? '',
    });
    setShowForm(true);
  }

  function handleGenerateSku() {
    setForm((prev) => ({ ...prev, sku: generateSkuPreview(prev.name) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    let fragranceToSave = form.fragrance;
    if (form.fragrance === 'Other') {
      const custom = resolveFragranceValue('Other', form.custom_fragrance);
      if (!custom) {
        alert('Please enter a custom fragrance name.');
        return;
      }
      fragranceToSave = custom;
    }

    try {
      const { unit_size, unit_type } = parsePackSize(form.pack_size);
      const data = {
        name: form.name,
        category: form.category,
        supplier: form.supplier,
        cost_price: parseFloat(form.cost_price) || 0,
        price: parseFloat(form.price) || 0,
        unit_type,
        unit_size,
        sku: form.sku.trim(),
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
      loadProducts();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleDeactivate(id) {
    if (!confirm('Deactivate this product? It will be hidden from new invoices/purchases but past records stay intact.')) return;
    try {
      await productsAPI.deactivate(id);
      loadProducts();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleReactivate(id) {
    try {
      await productsAPI.reactivate(id);
      loadProducts();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Permanently delete this product? This only works if it was never used in any sale or purchase.')) return;
    try {
      await productsAPI.delete(id);
      loadProducts();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Products"
        description="Detailed catalog with cost, selling price, units, and supplier info."
        action={
          <button onClick={openAddForm} className="btn btn-primary w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add product
          </button>
        }
      />

      <div className="mb-8">
        <SegmentedControl
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </div>

      {showForm && (
        <div className="form-panel">
          <FormShell
            icon={Package}
            title={editingId ? 'Edit product' : 'New product'}
            subtitle="Purchase and pricing details for accurate profit tracking."
          >
            <form onSubmit={handleSubmit} className="form-grid">
              <FormField label="Product name" required className="lg:col-span-2">
                <input
                  className="input input-premium"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Category" required>
                <input
                  className="input input-premium"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Grocery, Beverages…"
                  required
                />
              </FormField>
              <FormField label="Supplier / purchased from">
                <input
                  className="input input-premium"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  placeholder="Vendor name"
                />
              </FormField>
              <FormField label="Cost price (₹)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input input-premium"
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                />
              </FormField>
              <FormField label="Selling price (₹)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input input-premium"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </FormField>
              <FormField label="Pack size">
                <select
                  className="input input-premium"
                  value={form.pack_size}
                  onChange={(e) => setForm({ ...form, pack_size: e.target.value })}
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
                  className="input input-premium"
                  value={form.fragrance}
                  onChange={(e) => {
                    const next = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      fragrance: next,
                      custom_fragrance: next === 'Other' ? prev.custom_fragrance : '',
                    }));
                  }}
                >
                  {FRAGRANCE_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </FormField>
              <div
                className={`md:col-span-2 transition-all duration-300 ease-out ${
                  form.fragrance === 'Other'
                    ? 'max-h-24 opacity-100 translate-y-0'
                    : 'max-h-0 opacity-0 -translate-y-1 overflow-hidden pointer-events-none'
                }`}
                aria-hidden={form.fragrance !== 'Other'}
              >
                <FormField label="Custom fragrance name" required={form.fragrance === 'Other'}>
                  <input
                    className="input input-premium"
                    value={form.custom_fragrance}
                    onChange={(e) => setForm({ ...form, custom_fragrance: e.target.value })}
                    placeholder="e.g. Mango, Coconut"
                    required={form.fragrance === 'Other'}
                  />
                </FormField>
              </div>
              <FormField label="Stock quantity">
                <input
                  type="number"
                  min="0"
                  className="input input-premium"
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                />
              </FormField>
              <FormField label="HSN/SAC code">
                <input
                  className="input input-premium font-mono"
                  value={form.hsn_sac}
                  onChange={(e) => setForm({ ...form, hsn_sac: e.target.value })}
                  placeholder="e.g. 3401"
                  maxLength={20}
                />
              </FormField>
              <FormField label="SKU / product code" className="md:col-span-2">
                <div className="flex gap-2">
                  <input
                    className="input input-premium"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="Auto on save if empty"
                  />
                  <button type="button" onClick={handleGenerateSku} className="btn btn-secondary shrink-0">
                    Auto
                  </button>
                </div>
              </FormField>
              <FormField label="Description" className="md:col-span-2 lg:col-span-3">
                <textarea
                  className="input input-premium min-h-[96px] resize-y"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Packaging, brand notes…"
                />
              </FormField>
              <div className="md:col-span-2 lg:col-span-3">
                <FormActions
                  submitLabel={editingId ? 'Update product' : 'Save product'}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            </form>
          </FormShell>
        </div>
      )}

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th>Supplier</th>
                <th>Cost</th>
                <th>Selling</th>
                <th>Pack size</th>
                <th>HSN/SAC</th>
                <th>Fragrance</th>
                <th>Margin</th>
                <th>Stock</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-500">
                    No products yet. Add your first product to get started.
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const margin = profitMargin(product.price, product.cost_price);
                  const isActive = product.is_active !== false;
                  return (
                    <tr key={product.id} className={!isActive ? 'opacity-75' : undefined}>
                      <td>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900">{product.name}</p>
                          {formatPackSize(product) && (
                            <span className="badge badge-blue text-[10px] font-semibold tracking-wide">
                              {formatPackSize(product)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {product.category}
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
                      <td className="tabular-nums">₹{Number(product.cost_price || 0).toLocaleString('en-IN')}</td>
                      <td className="tabular-nums font-medium">
                        ₹{Number(product.price || 0).toLocaleString('en-IN')}
                      </td>
                      <td>{formatPackSize(product) || '—'}</td>
                      <td className="font-mono text-xs">{product.hsn_sac || '—'}</td>
                      <td className="text-slate-700">{product.fragrance || 'Unscented'}</td>
                      <td>
                        <span
                          className={`tabular-nums font-semibold ${
                            margin >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          ₹{margin.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td>
                        {product.stock_quantity < 10 ? (
                          <span className="badge badge-orange">{product.stock_quantity}</span>
                        ) : (
                          <span className="tabular-nums">{product.stock_quantity}</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-3 flex-wrap">
                          <button type="button" onClick={() => openEditForm(product)} className="link-action">
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          {isActive ? (
                            <button type="button" onClick={() => handleDeactivate(product.id)} className="link-action">
                              Deactivate
                            </button>
                          ) : (
                            <button type="button" onClick={() => handleReactivate(product.id)} className="link-action">
                              Reactivate
                            </button>
                          )}
                          <button type="button" onClick={() => handleDelete(product.id)} className="link-action-danger">
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
