const express = require('express');
const router = express.Router();
const { assertNoError } = require('../database/supabase');
const { fetchBusinessSettings } = require('../utils/businessSettings');
const {
  isMissingTableError: isMissingPreBookingsTable,
  mapPreBookingRow,
  dueSoonRows,
} = require('../utils/preBookings');

/** Keep in sync with frontend/src/config/stock.js → LOW_STOCK_THRESHOLD */
const LOW_STOCK_THRESHOLD = 50;
const REORDER_TARGET = 25;
/** Keep in sync with frontend/src/config/payments.js → DUE_SOON_DAYS */
const DUE_SOON_DAYS = 3;

function isMissingTableError(error) {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return code === 'PGRST205' || code === '42P01' || msg.includes('does not exist') || msg.includes('could not find');
}

async function fetchExpensesSafe(db) {
  const { data, error } = await db.from('expenses').select('amount, expense_date');
  if (error) {
    if (isMissingTableError(error)) {
      console.warn('[dashboard] expenses table missing — using empty expenses');
      return [];
    }
    assertNoError(error);
  }
  return data || [];
}

async function fetchDuePreBookingsSafe(db, businessId) {
  let query = db
    .from('pre_bookings')
    .select(
      '*, parties(name), pre_booking_items(id, product_id, quantity, rate, amount, gst_percent, gst_amount, products(name, unit_size, unit_type))'
    )
    .eq('status', 'upcoming');
  if (businessId) query = query.eq('business_id', businessId);

  let { data, error } = await query;
  if (error && /gst_percent|gst_amount|column/i.test(error.message || '')) {
    let fallback = db
      .from('pre_bookings')
      .select(
        '*, parties(name), pre_booking_items(id, product_id, quantity, rate, amount, products(name, unit_size, unit_type))'
      )
      .eq('status', 'upcoming');
    if (businessId) fallback = fallback.eq('business_id', businessId);
    ({ data, error } = await fallback);
  }
  if (error && /pre_booking_items|parties|products|relationship|schema cache/i.test(error.message || '')) {
    let fallback = db
      .from('pre_bookings')
      .select('*, parties(name)')
      .eq('status', 'upcoming');
    if (businessId) fallback = fallback.eq('business_id', businessId);
    ({ data, error } = await fallback);
  }
  if (error && /parties|relationship|schema cache/i.test(error.message || '')) {
    let fallback = db.from('pre_bookings').select('*').eq('status', 'upcoming');
    if (businessId) fallback = fallback.eq('business_id', businessId);
    ({ data, error } = await fallback);
  }
  if (error) {
    if (isMissingTableError(error) || isMissingPreBookingsTable(error)) {
      console.warn('[dashboard] pre_bookings table missing — skipping reminder banner');
      return [];
    }
    console.warn('[dashboard] pre_bookings:', error.message);
    return [];
  }
  return dueSoonRows((data || []).map(mapPreBookingRow));
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeDateKey(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function getMonthStartDate() {
  const d = new Date();
  return formatDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function getYearStartDate() {
  const d = new Date();
  return formatDate(new Date(d.getFullYear(), 0, 1));
}

function dueUrgency(dueDateIso, today = new Date()) {
  if (!dueDateIso) return 'none';
  const due = new Date(`${String(dueDateIso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(due.getTime())) return 'none';
  const start = new Date(today);
  start.setHours(12, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - start.getTime()) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= DUE_SOON_DAYS) return 'due_soon';
  return 'upcoming';
}

/**
 * @param {Array} saleRows
 * @param {'full'|'due_date'} mode
 *  - full: use amount_paid / payment_status columns
 *  - due_date: columns missing — any invoice with payment_due_date is unpaid credit
 */
function buildPendingReceivables(saleRows, mode = 'full') {
  const pendingInvoices = (saleRows || [])
    .map((row) => {
      const total = Number(row.total_amount) || 0;
      let paid = Number(row.amount_paid) || 0;
      let payment_status = row.payment_status || null;

      if (mode === 'due_date') {
        if (row.payment_due_date) {
          paid = 0;
          payment_status = 'pending';
        } else {
          paid = total;
          payment_status = 'paid';
        }
      } else if (payment_status === 'paid') {
        paid = Math.max(paid, total);
      } else if (payment_status === 'pending') {
        // keep paid as-is (usually 0)
      } else if (!payment_status) {
        const due = Math.max(0, total - paid);
        payment_status = due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';
      }

      const balance_due = Math.max(0, Math.round((total - paid) * 100) / 100);
      if (balance_due <= 0) payment_status = 'paid';
      else if (!payment_status || payment_status === 'paid') {
        payment_status = paid > 0 ? 'partial' : 'pending';
      }

      return {
        id: row.id,
        invoice_number: row.invoice_number,
        party_name: row.parties?.name || '—',
        invoice_date: row.invoice_date,
        payment_due_date: row.payment_due_date || null,
        total_amount: total,
        amount_paid: paid,
        balance_due,
        payment_status,
        urgency: dueUrgency(row.payment_due_date),
      };
    })
    .filter((s) => s.balance_due > 0 && (s.payment_status === 'pending' || s.payment_status === 'partial'))
    .sort((a, b) => {
      const rank = { overdue: 0, due_soon: 1, upcoming: 2, none: 3 };
      const diff = rank[a.urgency] - rank[b.urgency];
      if (diff !== 0) return diff;
      return String(a.payment_due_date || '9999-99-99').localeCompare(
        String(b.payment_due_date || '9999-99-99')
      );
    });

  const pendingPayments = pendingInvoices.reduce((acc, s) => acc + s.balance_due, 0);
  const hasOverdue = pendingInvoices.some((s) => s.urgency === 'overdue');
  const hasDueSoon = pendingInvoices.some((s) => s.urgency === 'due_soon');

  return {
    pendingInvoices,
    pendingPayments: Math.round(pendingPayments * 100) / 100,
    pendingInvoiceCount: pendingInvoices.length,
    pendingTone: hasOverdue ? 'danger' : hasDueSoon ? 'warning' : 'info',
  };
}

async function fetchReceivableSales(db) {
  const full = await db
    .from('sales')
    .select(
      'id, invoice_number, invoice_date, total_amount, amount_paid, payment_status, payment_due_date, parties(name)'
    )
    .eq('is_deleted', false)
    .order('invoice_date', { ascending: false });

  if (!full.error) {
    return { rows: full.data || [], mode: 'full' };
  }

  if (/amount_paid|payment_status/i.test(full.error.message || '')) {
    console.warn(
      '[dashboard] amount_paid/payment_status missing — pending from payment_due_date'
    );
    const legacy = await db
      .from('sales')
      .select('id, invoice_number, invoice_date, total_amount, payment_due_date, parties(name)')
      .eq('is_deleted', false)
      .order('invoice_date', { ascending: false });
    assertNoError(legacy.error);
    return { rows: legacy.data || [], mode: 'due_date' };
  }

  assertNoError(full.error);
  return { rows: [], mode: 'full' };
}

/** Supplier payables — same payment columns as sales (after purchases_payment migration). */
function buildPendingPayables(purchaseRows, mode = 'full') {
  const pendingPurchases = (purchaseRows || [])
    .map((row) => {
      const total = Number(row.total_amount) || 0;
      let paid = Number(row.amount_paid) || 0;
      let payment_status = row.payment_status || null;

      if (mode === 'due_date') {
        if (row.payment_due_date) {
          paid = 0;
          payment_status = 'pending';
        } else {
          paid = total;
          payment_status = 'paid';
        }
      } else if (payment_status === 'paid') {
        paid = Math.max(paid, total);
      } else if (!payment_status) {
        const due = Math.max(0, total - paid);
        payment_status = due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';
      }

      const balance_due = Math.max(0, Math.round((total - paid) * 100) / 100);
      if (balance_due <= 0) payment_status = 'paid';
      else if (!payment_status || payment_status === 'paid') {
        payment_status = paid > 0 ? 'partial' : 'pending';
      }

      return {
        id: row.id,
        purchase_date: row.purchase_date,
        party_name: row.parties?.name || '—',
        payment_due_date: row.payment_due_date || null,
        total_amount: total,
        amount_paid: paid,
        balance_due,
        payment_status,
        urgency: dueUrgency(row.payment_due_date),
      };
    })
    .filter((p) => p.balance_due > 0 && (p.payment_status === 'pending' || p.payment_status === 'partial'))
    .sort((a, b) => {
      const rank = { overdue: 0, due_soon: 1, upcoming: 2, none: 3 };
      const diff = rank[a.urgency] - rank[b.urgency];
      if (diff !== 0) return diff;
      return String(a.payment_due_date || '9999-99-99').localeCompare(
        String(b.payment_due_date || '9999-99-99')
      );
    });

  const pendingPayables = pendingPurchases.reduce((acc, p) => acc + p.balance_due, 0);
  const hasOverdue = pendingPurchases.some((p) => p.urgency === 'overdue');
  const hasDueSoon = pendingPurchases.some((p) => p.urgency === 'due_soon');

  return {
    pendingPurchases,
    pendingPayables: Math.round(pendingPayables * 100) / 100,
    pendingPurchaseCount: pendingPurchases.length,
    pendingPayableTone: hasOverdue ? 'danger' : hasDueSoon ? 'warning' : 'info',
  };
}

async function fetchPayablePurchases(db) {
  const full = await db
    .from('purchases')
    .select(
      'id, purchase_date, total_amount, amount_paid, payment_status, payment_due_date, parties(name)'
    )
    .order('purchase_date', { ascending: false });

  if (!full.error) {
    return { rows: full.data || [], mode: 'full' };
  }

  if (/amount_paid|payment_status|payment_due_date/i.test(full.error.message || '')) {
    console.warn(
      '[dashboard] purchase payment columns missing — run supabase.migration.purchases_payment.sql'
    );
    return { rows: [], mode: 'due_date' };
  }

  assertNoError(full.error);
  return { rows: [], mode: 'full' };
}

function sumAmount(rows, field = 'total_amount') {
  return (rows || []).reduce((acc, row) => acc + Number(row[field] || 0), 0);
}

/** Compare first half vs second half of a daily sales trend (−1 / 0 / +1). */
function salesTrendDirection(dailyTrend) {
  const days = dailyTrend || [];
  if (days.length < 4) return 0;
  const mid = Math.floor(days.length / 2);
  const earlier = days.slice(0, mid).reduce((acc, d) => acc + (Number(d.sales) || 0), 0);
  const later = days.slice(mid).reduce((acc, d) => acc + (Number(d.sales) || 0), 0);
  if (earlier <= 0 && later <= 0) return 0;
  if (later > earlier * 1.15) return 1;
  if (later < earlier * 0.85) return -1;
  return 0;
}

/**
 * Business health 0–100. Soft on early stock-build phase; skips score when too little sales history.
 */
function computeBusinessHealth({
  totalSales,
  totalPurchases,
  netProfit,
  profitMarginPercent,
  pendingPayments,
  lowStockCount,
  invoiceCount,
  monthNetProfit,
  salesTrend7,
}) {
  const sales = Number(totalSales) || 0;
  const purchases = Number(totalPurchases) || 0;
  const pending = Math.max(0, Number(pendingPayments) || 0);
  const invoices = Number(invoiceCount) || 0;
  const lowStock = Number(lowStockCount) || 0;
  const margin = Number(profitMarginPercent) || 0;

  const collectionRate = sales > 0 ? Math.max(0, Math.min(1, 1 - pending / sales)) : 1;
  const collectionRatePercent = Math.round(collectionRate * 1000) / 10;

  if (invoices < 3 || sales <= 0) {
    return {
      insufficientData: true,
      healthScore: null,
      healthStatus: 'insufficient',
      healthLabel: 'Not enough data yet',
      profitMarginPercent: margin,
      netProfit: Number(netProfit) || 0,
      monthNetProfit: Number(monthNetProfit) || 0,
      collectionRatePercent,
      setupPhase: true,
      hint: 'Add a few more invoices to unlock a reliable health score.',
    };
  }

  // Stock-heavy early phase: purchases well above sales, limited invoice history
  const setupPhase = purchases > sales * 1.5 && invoices < 15;

  // Neutral-stable baseline (not 50 + harsh margin/2 which collapsed new businesses to 0)
  let score = 58;

  // Collections — strongest operational signal (±18)
  score += (collectionRate - 0.7) * 60;

  // Low stock — moderate
  if (lowStock >= 5) score -= 14;
  else if (lowStock >= 3) score -= 10;
  else if (lowStock >= 1) score -= 5;
  else score += 4;

  // Margin — light weight; even lighter while building stock
  const marginClamped = Math.max(-60, Math.min(60, margin));
  const marginDivisor = setupPhase ? 10 : 5;
  score += Math.max(-10, Math.min(12, marginClamped / marginDivisor));

  // 7-day sales trend
  const trend = salesTrendDirection(salesTrend7);
  score += trend * 8;

  score = Math.round(Math.max(0, Math.min(100, score)));

  let healthStatus;
  let healthLabel;
  if (score >= 70) {
    healthStatus = 'healthy';
    healthLabel = 'Healthy';
  } else if (score >= 40) {
    healthStatus = 'stable';
    healthLabel = 'Stable';
  } else {
    healthStatus = 'attention';
    healthLabel = 'Needs attention';
  }

  return {
    insufficientData: false,
    healthScore: score,
    healthStatus,
    healthLabel,
    profitMarginPercent: margin,
    netProfit: Number(netProfit) || 0,
    monthNetProfit: Number(monthNetProfit) || 0,
    collectionRatePercent,
    setupPhase,
    hint: setupPhase
      ? 'Early setup — stock purchases weigh less on this score.'
      : null,
  };
}

function aggregateByDate(rows, dateField, amountField = 'total_amount') {
  const map = {};
  for (const row of rows || []) {
    const key = normalizeDateKey(row[dateField]);
    if (!key) continue;
    map[key] = (map[key] || 0) + Number(row[amountField] || 0);
  }
  return map;
}

function buildDailyTrendFromRows(salesRows, purchaseRows, days) {
  const salesMap = aggregateByDate(salesRows, 'invoice_date');
  const purchasesMap = aggregateByDate(purchaseRows, 'purchase_date');

  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = formatDate(d);
    result.push({
      date: key,
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      sales: salesMap[key] || 0,
      purchases: purchasesMap[key] || 0,
    });
  }

  return result;
}

function buildMonthTrendFromRows(salesRows, purchaseRows) {
  const monthStart = getMonthStartDate();
  const salesMap = aggregateByDate(
    (salesRows || []).filter((r) => normalizeDateKey(r.invoice_date) >= monthStart),
    'invoice_date'
  );
  const purchasesMap = aggregateByDate(
    (purchaseRows || []).filter((r) => normalizeDateKey(r.purchase_date) >= monthStart),
    'purchase_date'
  );

  const result = [];
  const start = new Date(monthStart);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = formatDate(d);
    result.push({
      date: key,
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      sales: salesMap[key] || 0,
      purchases: purchasesMap[key] || 0,
    });
  }

  return result;
}

function pctChange(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

function getLastMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: formatDate(start), end: formatDate(end) };
}

/** Last N complete weeks (Mon–Sun), ending with current week-to-date. */
function buildWeeklyTrendFromRows(salesRows, purchaseRows, weeks = 12) {
  const salesMap = aggregateByDate(salesRows, 'invoice_date');
  const purchasesMap = aggregateByDate(purchaseRows, 'purchase_date');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    let sales = 0;
    let purchases = 0;
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      const key = formatDate(d);
      sales += salesMap[key] || 0;
      purchases += purchasesMap[key] || 0;
    }
    result.push({
      date: formatDate(weekStart),
      label: `${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
      sales,
      purchases,
    });
  }
  return result;
}

/** Last N calendar months. */
function buildMonthlyTrendFromRows(salesRows, purchaseRows, months = 12) {
  const salesMap = {};
  const purchasesMap = {};
  for (const row of salesRows || []) {
    const key = normalizeDateKey(row.invoice_date).slice(0, 7);
    if (!key) continue;
    salesMap[key] = (salesMap[key] || 0) + Number(row.total_amount || 0);
  }
  for (const row of purchaseRows || []) {
    const key = normalizeDateKey(row.purchase_date).slice(0, 7);
    if (!key) continue;
    purchasesMap[key] = (purchasesMap[key] || 0) + Number(row.total_amount || 0);
  }

  const result = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push({
      date: key,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      sales: salesMap[key] || 0,
      purchases: purchasesMap[key] || 0,
    });
  }
  return result;
}

/** Yearly buckets for last N years (calendar year). */
function buildYearlyTrendFromRows(salesRows, purchaseRows, years = 4) {
  const salesMap = {};
  const purchasesMap = {};
  for (const row of salesRows || []) {
    const key = normalizeDateKey(row.invoice_date).slice(0, 4);
    if (!key) continue;
    salesMap[key] = (salesMap[key] || 0) + Number(row.total_amount || 0);
  }
  for (const row of purchaseRows || []) {
    const key = normalizeDateKey(row.purchase_date).slice(0, 4);
    if (!key) continue;
    purchasesMap[key] = (purchasesMap[key] || 0) + Number(row.total_amount || 0);
  }

  const result = [];
  const yNow = new Date().getFullYear();
  for (let i = years - 1; i >= 0; i--) {
    const y = String(yNow - i);
    result.push({
      date: y,
      label: y,
      sales: salesMap[y] || 0,
      purchases: purchasesMap[y] || 0,
    });
  }
  return result;
}

function inventoryStockStatus(qty, threshold = LOW_STOCK_THRESHOLD) {
  const n = Number(qty) || 0;
  if (n <= Math.max(5, Math.floor(threshold / 5))) {
    return { status: 'critical', status_label: 'Critical' };
  }
  if (n <= threshold) {
    return { status: 'low', status_label: 'Low Stock' };
  }
  return { status: 'good', status_label: 'Good' };
}

function buildProductInsights(products, purchaseItems, saleItems) {
  const purchasedQty = {};
  const soldQty = {};
  const purchaseValue = {};
  const salesValue = {};

  for (const row of purchaseItems || []) {
    purchasedQty[row.product_id] = (purchasedQty[row.product_id] || 0) + Number(row.quantity);
    purchaseValue[row.product_id] = (purchaseValue[row.product_id] || 0) + Number(row.amount);
  }

  for (const row of saleItems || []) {
    soldQty[row.product_id] = (soldQty[row.product_id] || 0) + Number(row.quantity);
    salesValue[row.product_id] = (salesValue[row.product_id] || 0) + Number(row.amount);
  }

  return (products || []).map((p) => {
    const stock = Number(p.stock_quantity);
    const needsReorder = stock <= LOW_STOCK_THRESHOLD;
    const suggestedReorderQty = needsReorder
      ? Math.max(REORDER_TARGET - stock, LOW_STOCK_THRESHOLD)
      : 0;

    return {
      ...p,
      stock_quantity: stock,
      price: Number(p.price),
      total_purchased: purchasedQty[p.id] || 0,
      total_sold: soldQty[p.id] || 0,
      purchase_value: purchaseValue[p.id] || 0,
      sales_value: salesValue[p.id] || 0,
      needs_reorder: needsReorder,
      status: needsReorder ? 'reorder' : 'in_stock',
      status_label: needsReorder ? 'Reorder Now' : 'In Stock',
      suggested_reorder_qty: suggestedReorderQty,
    };
  });
}

router.get('/', async (req, res) => {
  try {
    const db = req.db;
    if (!db) {
      return res.status(500).json({ error: 'Database client not configured' });
    }

    const monthStart = getMonthStartDate();
    const yearStart = getYearStartDate();

    const expensesPromise = fetchExpensesSafe(db);
    const preBookingsPromise = fetchDuePreBookingsSafe(
      db,
      String(req.profile?.business_id || '').trim()
    );

    const [
      productsRes,
      salesRes,
      purchasesRes,
      recentSalesRes,
      partiesRes,
      purchaseItemsRes,
      saleItemsRes,
      recentSalesActivityRes,
      recentPurchasesActivityRes,
      partiesBalanceRes,
      expenseRows,
      duePreBookings,
    ] = await Promise.all([
      db.from('products').select('*'),
      db.from('sales').select('total_amount, invoice_date, gst_amount').eq('is_deleted', false),
      db.from('purchases').select('total_amount, purchase_date'),
      db
        .from('sales')
        .select('*, parties(name)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(5),
      db.from('parties').select('type, is_active'),
      db.from('purchase_items').select('product_id, quantity, amount'),
      db.from('sale_items').select('product_id, quantity, amount, sales!inner(is_deleted)').eq('sales.is_deleted', false),
      db
        .from('sales')
        .select('id, invoice_number, total_amount, invoice_date, created_at, parties(name)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(10),
      db
        .from('purchases')
        .select('id, total_amount, purchase_date, created_at, notes, parties(name)')
        .order('created_at', { ascending: false })
        .limit(10),
      db.from('parties').select('balance, name, type'),
      expensesPromise,
      preBookingsPromise,
    ]);

    assertNoError(productsRes.error);
    assertNoError(salesRes.error);
    assertNoError(purchasesRes.error);
    assertNoError(recentSalesRes.error);
    assertNoError(partiesRes.error);
    assertNoError(purchaseItemsRes.error);
    assertNoError(saleItemsRes.error);
    assertNoError(recentSalesActivityRes.error);
    assertNoError(recentPurchasesActivityRes.error);
    assertNoError(partiesBalanceRes.error);

    const products = productsRes.data || [];
    const salesRows = salesRes.data || [];
    const purchaseRows = purchasesRes.data || [];
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    const lastMonth = getLastMonthRange();

    const totalExpenses = sumAmount(expenseRows);
    const expensesThisMonth = sumAmount(expenseRows.filter((r) => r.expense_date >= monthStart));
    const expensesThisYear = sumAmount(expenseRows.filter((r) => r.expense_date >= yearStart));

    const totalSales = sumAmount(salesRows);
    const totalPurchases = sumAmount(purchaseRows);
    const todaysSales = sumAmount(salesRows.filter((r) => normalizeDateKey(r.invoice_date) === today));
    const yesterdaySales = sumAmount(
      salesRows.filter((r) => normalizeDateKey(r.invoice_date) === yesterday)
    );
    const monthRevenue = sumAmount(salesRows.filter((r) => normalizeDateKey(r.invoice_date) >= monthStart));
    const lastMonthRevenue = sumAmount(
      salesRows.filter((r) => {
        const d = normalizeDateKey(r.invoice_date);
        return d >= lastMonth.start && d <= lastMonth.end;
      })
    );
    const monthPurchases = sumAmount(purchaseRows.filter((r) => normalizeDateKey(r.purchase_date) >= monthStart));
    const monthNetProfit = monthRevenue - monthPurchases - expensesThisMonth;
    const grossProfit = totalSales - totalPurchases;
    const monthGrossProfit = monthRevenue - monthPurchases;
    const gstThisMonth = (salesRows || [])
      .filter((r) => normalizeDateKey(r.invoice_date) >= monthStart)
      .reduce((acc, r) => acc + Number(r.gst_amount || 0), 0);
    const invoiceCountToday = salesRows.filter((r) => normalizeDateKey(r.invoice_date) === today).length;
    const invoiceCountYesterday = salesRows.filter(
      (r) => normalizeDateKey(r.invoice_date) === yesterday
    ).length;
    const monthInvoiceCount = salesRows.filter((r) => normalizeDateKey(r.invoice_date) >= monthStart).length;

    const activeCustomers = (partiesRes.data || []).filter((p) => p.is_active !== false).length;

    // Invoice-level receivables only (payment_status / amount_paid, or legacy payment_due_date).
    // Do NOT fall back to parties.balance — that ledger stays stale after Mark as paid.
    const { rows: receivableRows, mode: receivableMode } = await fetchReceivableSales(db);
    const summary = buildPendingReceivables(receivableRows, receivableMode);
    const pendingPayments = summary.pendingPayments;
    const pendingInvoiceCount = summary.pendingInvoiceCount;
    const pendingInvoices = summary.pendingInvoices;
    const pendingTone = summary.pendingTone;
    const pendingPartiesCount = new Set(summary.pendingInvoices.map((s) => s.party_name)).size;
    const outstandingAR = pendingPayments;

    const { rows: payableRows, mode: payableMode } = await fetchPayablePurchases(db);
    const payableSummary = buildPendingPayables(payableRows, payableMode);
    const pendingPayables = payableSummary.pendingPayables;
    const pendingPurchaseCount = payableSummary.pendingPurchaseCount;
    const pendingPurchases = payableSummary.pendingPurchases;
    const pendingPayableTone = payableSummary.pendingPayableTone;
    const stockValue = products.reduce(
      (acc, p) => acc + Number(p.price) * Number(p.stock_quantity),
      0
    );
    const totalStock = products.reduce((acc, p) => acc + Number(p.stock_quantity), 0);
    const lowStockProducts = products
      .filter((p) => Number(p.stock_quantity) <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity));
    const lowStockCount = lowStockProducts.length;

    const recentSales = (recentSalesRes.data || []).map((row) => {
      const { parties, ...rest } = row;
      const total = Number(rest.total_amount) || 0;
      let paid = Number(rest.amount_paid) || 0;

      const due = Math.max(0, Math.round((total - paid) * 100) / 100);
      const payment_status = due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';

      return {
        ...rest,
        party_name: parties?.name,
        amount_paid: paid,
        payment_status,
        balance_due: due,
      };
    });

    const partyCountMap = {};
    for (const party of partiesRes.data || []) {
      partyCountMap[party.type] = (partyCountMap[party.type] || 0) + 1;
    }
    const partyCounts = Object.entries(partyCountMap).map(([type, count]) => ({ type, count }));

    const productInsights = buildProductInsights(
      products,
      purchaseItemsRes.data,
      saleItemsRes.data
    );

    const salesForTrend = salesRows;
    const purchasesForTrend = purchaseRows;

    const recentActivity = [
      ...(recentSalesActivityRes.data || []).map((row) => ({
        id: `sale-${row.id}`,
        type: 'sale',
        title: row.invoice_number,
        party_name: row.parties?.name,
        amount: Number(row.total_amount),
        date: row.invoice_date,
        created_at: row.created_at,
      })),
      ...(recentPurchasesActivityRes.data || []).map((row) => ({
        id: `purchase-${row.id}`,
        type: 'purchase',
        title: row.notes ? `Purchase — ${row.notes}` : 'Stock purchase',
        party_name: row.parties?.name,
        amount: Number(row.total_amount),
        date: row.purchase_date,
        created_at: row.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);

    const topSellingProducts = [...productInsights]
      .filter((p) => p.total_sold > 0)
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        name: p.name,
        unit_size: p.unit_size,
        unit_type: p.unit_type,
        quantity_sold: p.total_sold,
        revenue: p.sales_value,
      }));

    const inventoryOverview = [...products]
      .filter((p) => p.is_active !== false)
      .map((p) => {
        const qty = Number(p.stock_quantity) || 0;
        const price = Number(p.price) || 0;
        const stock = inventoryStockStatus(qty, LOW_STOCK_THRESHOLD);
        return {
          id: p.id,
          name: p.name,
          unit_size: p.unit_size,
          unit_type: p.unit_type,
          stock_quantity: qty,
          stock_value: Math.round(qty * price * 100) / 100,
          ...stock,
        };
      })
      .sort((a, b) => {
        const rank = { critical: 0, low: 1, good: 2 };
        const diff = rank[a.status] - rank[b.status];
        if (diff !== 0) return diff;
        return a.stock_quantity - b.stock_quantity;
      })
      .slice(0, 8);

    const netProfit = totalSales - totalPurchases - totalExpenses;
    const profitMarginPercent =
      totalSales > 0 ? Math.round(((netProfit / totalSales) * 100 + Number.EPSILON) * 10) / 10 : 0;

    const trend7Days = buildDailyTrendFromRows(salesForTrend, purchasesForTrend, 7);
    const businessHealth = computeBusinessHealth({
      totalSales,
      totalPurchases,
      netProfit,
      profitMarginPercent,
      pendingPayments,
      lowStockCount,
      invoiceCount: salesRows.length,
      monthNetProfit,
      salesTrend7: trend7Days,
    });

    let monthlySalesTarget = 0;
    try {
      const settings = await fetchBusinessSettings(req.accessToken, req.profile?.business_id);
      monthlySalesTarget = Number(settings?.monthly_sales_target) || 0;
    } catch (err) {
      console.warn('[dashboard] business settings for sales target:', err.message);
    }

    const salesTargetPercent =
      monthlySalesTarget > 0
        ? Math.min(100, Math.round((monthRevenue / monthlySalesTarget) * 1000) / 10)
        : null;

    res.json({
      totalSales,
      totalPurchases,
      todaysSales,
      yesterdaySales,
      todaysSalesChangePct: pctChange(todaysSales, yesterdaySales),
      monthRevenue,
      lastMonthRevenue,
      monthRevenueChangePct: pctChange(monthRevenue, lastMonthRevenue),
      monthPurchases,
      monthNetProfit,
      monthGrossProfit,
      grossProfit,
      gstThisMonth,
      invoiceCountToday,
      invoiceCountYesterday,
      invoiceCountTodayChangePct: pctChange(invoiceCountToday, invoiceCountYesterday),
      monthInvoiceCount,
      activeCustomers,
      outstandingAR,
      pendingPayments,
      pendingPartiesCount,
      pendingInvoiceCount,
      pendingInvoices,
      pendingTone,
      pendingPayables,
      pendingPurchaseCount,
      pendingPurchases,
      pendingPayableTone,
      dueSoonDays: DUE_SOON_DAYS,
      duePreBookings,
      duePreBookingCount: (duePreBookings || []).length,
      lowStockCount,
      expensesThisMonth,
      expensesThisYear,
      totalExpenses,
      netProfit,
      productCount: products.length,
      stockValue,
      totalStock,
      lowStockProducts,
      recentSales,
      recentOrders: recentSales,
      partyCounts,
      productInsights,
      recentActivity,
      topSellingProducts,
      inventoryOverview,
      businessHealth: {
        ...businessHealth,
        monthlySalesTarget,
        salesTargetPercent,
        monthRevenue,
        expensesThisMonth,
        grossProfit: monthGrossProfit,
        netProfitMonth: monthNetProfit,
      },
      monthlySalesTarget,
      salesTargetPercent,
      trends: {
        daily: buildDailyTrendFromRows(salesForTrend, purchasesForTrend, 14),
        weekly: buildWeeklyTrendFromRows(salesForTrend, purchasesForTrend, 12),
        monthly: buildMonthlyTrendFromRows(salesForTrend, purchasesForTrend, 12),
        yearly: buildYearlyTrendFromRows(salesForTrend, purchasesForTrend, 4),
        // legacy keys for older clients
        last7Days: trend7Days,
        last30Days: buildDailyTrendFromRows(salesForTrend, purchasesForTrend, 30),
        thisMonth: buildMonthTrendFromRows(salesRows, purchaseRows),
      },
      lowStockThreshold: LOW_STOCK_THRESHOLD,
    });
  } catch (error) {
    console.error('[dashboard]', error);
    res.status(500).json({ error: error.message || 'Failed to load dashboard' });
  }
});

module.exports = router;