import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Banknote, CalendarRange } from 'lucide-react';
import ExportMenu from '../components/ExportMenu';
import { expensesAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import SummaryStatCard from '../components/ui/SummaryStatCard';
import { useDataSync } from '../hooks/useDataSync';
import { notifyDataSync, removeById } from '../lib/dataSync';

const CATEGORIES = [
  'Rent',
  'Salary',
  'Labour / Wages',
  'Electricity',
  'Water',
  'Transport',
  'Petrol / Fuel',
  'Food',
  'Chai / Tea',
  'Packaging',
  'Courier / Shipping',
  'Mobile & Internet',
  'Office Supplies',
  'Maintenance',
  'Repairs',
  'Marketing',
  'Cleaning Supplies',
  'Other',
];

const PAYMENT_METHODS = ['Cash', 'Bank', 'UPI'];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

function yearStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0];
}

const emptyForm = () => ({
  title: '',
  category: 'Other',
  amount: '',
  expense_date: todayISO(),
  payment_method: 'Cash',
  notes: '',
});

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadExpenses();
  }, []);

  useDataSync('expenses', () => loadExpenses(true));

  async function loadExpenses(silent = false) {
    try {
      if (!silent) setLoading(true);
      const data = await expensesAPI.getAll();
      setExpenses(data);
    } catch (err) {
      if (!silent) alert('Error: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const { monthTotal, yearTotal } = useMemo(() => {
    const monthStart = monthStartISO();
    const yearStart = yearStartISO();
    let month = 0;
    let year = 0;
    for (const row of expenses) {
      const amt = Number(row.amount) || 0;
      if (row.expense_date >= yearStart) year += amt;
      if (row.expense_date >= monthStart) month += amt;
    }
    return { monthTotal: month, yearTotal: year };
  }, [expenses]);

  const categoryTotals = useMemo(() => {
    const monthStart = monthStartISO();
    const totals = new Map();
    for (const row of expenses) {
      if (row.expense_date < monthStart) continue;
      const key = row.category || 'Other';
      totals.set(key, (totals.get(key) || 0) + (Number(row.amount) || 0));
    }
    return Array.from(totals.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const visibleExpenses = useMemo(
    () =>
      categoryFilter === 'all'
        ? expenses
        : expenses.filter((row) => row.category === categoryFilter),
    [expenses, categoryFilter]
  );
  const visibleTotal = visibleExpenses.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEditForm(expense) {
    setEditingId(expense.id);
    setForm({
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      expense_date: expense.expense_date,
      payment_method: expense.payment_method,
      notes: expense.notes || '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        expense_date: form.expense_date,
        payment_method: form.payment_method,
        notes: form.notes.trim(),
      };

      if (editingId) {
        await expensesAPI.update(editingId, payload);
      } else {
        await expensesAPI.create(payload);
      }

      setShowForm(false);
      notifyDataSync('expenses');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this expense?')) return;
    try {
      await expensesAPI.delete(id);
      setExpenses((prev) => removeById(prev, id));
      notifyDataSync('expenses');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  if (loading && expenses.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Track rent, salaries, food, chai, petrol, and other operating costs."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <ExportMenu
              filePrefix="expenses"
              successLabel="Expenses"
              columns={[
                { key: 'expense_date', header: 'Date' },
                { key: 'category', header: 'Category' },
                { key: 'title', header: 'Title' },
                { key: 'amount', header: 'Amount' },
                { key: 'payment_method', header: 'Payment' },
                { key: 'notes', header: 'Notes' },
              ]}
              getRows={() =>
                visibleExpenses.map((row) => ({
                  expense_date: row.expense_date,
                  category: row.category,
                  title: row.title,
                  amount: Number(row.amount) || 0,
                  payment_method: row.payment_method,
                  notes: row.notes || '',
                }))
              }
            />
            <button onClick={openAddForm} className="btn btn-primary w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Add expense
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SummaryStatCard
          title="Total expenses this month"
          value={`₹${monthTotal.toLocaleString('en-IN')}`}
          icon={CalendarRange}
          tone="indigo"
        />
        <SummaryStatCard
          title="Total expenses this year"
          value={`₹${yearTotal.toLocaleString('en-IN')}`}
          icon={Banknote}
          tone="violet"
        />
      </div>

      {categoryTotals.length > 0 && (
        <div className="surface-panel p-5 sm:p-6">
          <h2 className="mb-3 text-lg font-semibold text-[var(--app-heading)] dark:text-white">
            This month by category
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {categoryTotals.map(({ category, total }) => (
              <button
                type="button"
                key={category}
                onClick={() => setCategoryFilter(categoryFilter === category ? 'all' : category)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  categoryFilter === category
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">{category}</p>
                <p className="font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                  ₹{total.toLocaleString('en-IN')}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="form-panel">
          <FormShell
            icon={Banknote}
            title={editingId ? 'Edit expense' : 'New expense'}
            subtitle="Record operating costs with category, amount, and payment method."
          >
            <form onSubmit={handleSubmit} className="form-grid">
              <FormField label="Expense title" required className="md:col-span-2">
                <input
                  className="input input-premium"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Chai for staff, Petrol for delivery"
                  required
                />
              </FormField>
              <FormField label="Category" required>
                <select
                  className="input input-premium"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Amount (₹)" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-premium"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Date" required>
                <input
                  type="date"
                  className="input input-premium"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Payment method" required>
                <select
                  className="input input-premium"
                  value={form.payment_method}
                  onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Notes (optional)" className="md:col-span-2 lg:col-span-3">
                <textarea
                  className="input input-premium min-h-[88px] resize-y"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Reference, invoice no., remarks…"
                />
              </FormField>
              <div className="md:col-span-2 lg:col-span-3">
                <FormActions
                  submitLabel={editingId ? 'Update expense' : 'Save expense'}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            </form>
          </FormShell>
        </div>
      )}

      <div className="table-wrap">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-300">Category</span>
            <select
              className="input input-premium"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {visibleExpenses.length} expense(s) · ₹{visibleTotal.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Title</th>
                <th>Amount</th>
                <th>Payment</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleExpenses.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500">
                    {expenses.length === 0
                      ? 'No expenses yet. Add rent, food, chai, petrol, or other costs to track spending.'
                      : 'No expenses in this category.'}
                  </td>
                </tr>
              ) : (
                visibleExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="tabular-nums text-slate-700 whitespace-nowrap">
                      {new Date(expense.expense_date + 'T12:00:00').toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <span className="badge badge-blue">{expense.category}</span>
                    </td>
                    <td className="font-medium text-slate-900 max-w-[200px] sm:max-w-none truncate">
                      {expense.title}
                    </td>
                    <td className="font-semibold tabular-nums text-rose-700">
                      ₹{Number(expense.amount).toLocaleString('en-IN')}
                    </td>
                    <td>{expense.payment_method}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => openEditForm(expense)} className="link-action">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(expense.id)} className="link-action-danger">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
