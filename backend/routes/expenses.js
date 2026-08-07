const express = require('express');
const router = express.Router();
const { assertNoError } = require('../database/supabase');
const { logActivity } = require('../utils/activityLog');

const EXPENSE_CATEGORIES = [
  'Rent',
  'Salary',
  'Electricity',
  'Transport',
  'Maintenance',
  'Marketing',
  'Other',
];

const PAYMENT_METHODS = ['Cash', 'Bank', 'UPI'];

function validateExpenseBody(body, { partial = false } = {}) {
  const { title, category, amount, expense_date, payment_method, notes } = body;

  if (!partial) {
    if (!title?.trim()) return 'Title is required';
    if (!category) return 'Category is required';
    if (amount === undefined || amount === null || amount === '') return 'Amount is required';
    if (!expense_date) return 'Date is required';
    if (!payment_method) return 'Payment method is required';
  }

  if (category !== undefined && !EXPENSE_CATEGORIES.includes(category)) {
    return `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`;
  }

  if (payment_method !== undefined && !PAYMENT_METHODS.includes(payment_method)) {
    return `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`;
  }

  if (amount !== undefined && amount !== null && amount !== '' && Number(amount) < 0) {
    return 'Amount cannot be negative';
  }

  return null;
}

async function saveExpensePayment(db, expenseId, body, totalAmount) {
  const total = Number(totalAmount) || 0;
  const amount_paid =
    body.amount_paid !== undefined && body.amount_paid !== null && body.amount_paid !== ''
      ? Number(body.amount_paid)
      : total;
  const payment_status = amount_paid >= total ? 'paid' : amount_paid > 0 ? 'partial' : 'unpaid';
  const payment_due_date =
    payment_status === 'paid' ? null : body.payment_due_date || null;

  const attempts = [
    { amount_paid, payment_status, payment_due_date },
    { amount_paid, payment_due_date },
    { payment_due_date },
  ];

  let lastError = null;
  for (const patch of attempts) {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined)
    );
    if (!Object.keys(clean).length) continue;
    const { error } = await db.from('expenses').update(clean).eq('id', expenseId);
    if (!error) return;
    lastError = error;
    if (!/column|schema cache|could not find|does not exist/i.test(error.message || '')) {
      break;
    }
  }
  if (lastError) {
    console.warn('[expenses] payment columns missing — run the expenses payment-tracking migration');
  }
}

router.get('/', async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    assertNoError(error);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('expenses')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    assertNoError(error);
    if (!data) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const validationError = validateExpenseBody(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { title, category, amount, expense_date, payment_method, notes } = req.body;
    const db = req.db;

    const { data, error } = await db
      .from('expenses')
      .insert({
        title: title.trim(),
        category,
        amount: Number(amount),
        expense_date,
        payment_method,
        notes: notes?.trim() || '',
      })
      .select()
      .single();

    assertNoError(error);

    await saveExpensePayment(db, data.id, req.body, data.amount);

    const { data: withPayment, error: refetchError } = await db
      .from('expenses')
      .select('*')
      .eq('id', data.id)
      .single();
    assertNoError(refetchError);

    await logActivity(req, {
      actionType: 'create',
      entityType: 'expense',
      entityId: withPayment.id,
      entityName: withPayment.title,
      details: { category: withPayment.category, amount: withPayment.amount },
    });
    res.status(201).json(withPayment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/mark-paid', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const db = req.db;

    const { data: existing, error: fetchError } = await db
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .maybeSingle();
    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const total = Number(existing.amount) || 0;
    const attempts = [
      { amount_paid: total, payment_status: 'paid', payment_due_date: null },
      { amount_paid: total, payment_due_date: null },
      { payment_due_date: null },
    ];

    let lastError = null;
    let applied = null;
    for (const patch of attempts) {
      const { error } = await db.from('expenses').update(patch).eq('id', expenseId);
      if (!error) {
        applied = patch;
        break;
      }
      lastError = error;
      if (!/column|schema cache|could not find|does not exist/i.test(error.message || '')) {
        break;
      }
    }
    if (!applied) {
      assertNoError(lastError);
      return res.status(500).json({ error: 'Failed to mark expense as paid' });
    }

    const { data: updated, error: refetchError } = await db
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .single();
    assertNoError(refetchError);

    await logActivity(req, {
      actionType: 'mark_paid',
      entityType: 'expense',
      entityId: expenseId,
      entityName: updated.title,
      details: { amount: updated.amount },
    });

    res.json({ ...updated, message: 'Expense marked as paid' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to mark expense as paid' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const validationError = validateExpenseBody(req.body, { partial: true });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { id } = req.params;
    const db = req.db;
    const { data: existing, error: fetchError } = await db
      .from('expenses')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const { title, category, amount, expense_date, payment_method, notes } = req.body;

    const { data, error } = await db
      .from('expenses')
      .update({
        title: title !== undefined ? title.trim() : existing.title,
        category: category ?? existing.category,
        amount: amount !== undefined ? Number(amount) : existing.amount,
        expense_date: expense_date ?? existing.expense_date,
        payment_method: payment_method ?? existing.payment_method,
        notes: notes !== undefined ? (notes?.trim() || '') : existing.notes,
      })
      .eq('id', id)
      .select()
      .single();

    assertNoError(error);

    await logActivity(req, {
      actionType: 'update',
      entityType: 'expense',
      entityId: data.id,
      entityName: data.title,
      details: { category: data.category, amount: data.amount },
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = req.db;
    const { data: existing, error: fetchError } = await db
      .from('expenses')
      .select('id, title, amount, category')
      .eq('id', req.params.id)
      .maybeSingle();
    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const { data, error } = await db.from('expenses').delete().eq('id', req.params.id).select('id');

    assertNoError(error);
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    await logActivity(req, {
      actionType: 'delete',
      entityType: 'expense',
      entityId: existing.id,
      entityName: existing.title,
      details: { amount: existing.amount, category: existing.category },
    });
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;