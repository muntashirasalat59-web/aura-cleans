const express = require('express');
const router = express.Router();
const { supabase, assertNoError } = require('../database/supabase');

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

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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

    const { data, error } = await supabase
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
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const validationError = validateExpenseBody(req.body, { partial: true });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { id } = req.params;
    const { data: existing, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    assertNoError(fetchError);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const { title, category, amount, expense_date, payment_method, notes } = req.body;

    const { data, error } = await supabase
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
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('expenses').delete().eq('id', req.params.id).select('id');

    assertNoError(error);
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
