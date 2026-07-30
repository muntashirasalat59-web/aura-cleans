const express = require('express');
const router = express.Router();
const { assertNoError } = require('../database/supabase');

const LOW_STOCK_THRESHOLD = 10;
const REORDER_TARGET = 25;

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

function sumAmount(rows, field = 'total_amount') {
  return (rows || []).reduce((acc, row) => acc + Number(row[field] || 0), 0);
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
    const needsReorder = stock < LOW_STOCK_THRESHOLD;
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
    const trendStart = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const expensesPromise = fetchExpensesSafe(db);

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
    ] = await Promise.all([
      db.from('products').select('*'),
      db.from('sales').select('total_amount, invoice_date, gst_amount'),
      db.from('purchases').select('total_amount, purchase_date'),
      db
        .from('sales')
        .select('*, parties(name)')
        .order('created_at', { ascending: false })
        .limit(5),
      db.from('parties').select('type'),
      db.from('purchase_items').select('product_id, quantity, amount'),
      db.from('sale_items').select('product_id, quantity, amount'),
      db
        .from('sales')
        .select('id, invoice_number, total_amount, invoice_date, created_at, parties(name)')
        .order('created_at', { ascending: false })
        .limit(10),
      db
        .from('purchases')
        .select('id, total_amount, purchase_date, created_at, notes, parties(name)')
        .order('created_at', { ascending: false })
        .limit(10),
      db.from('parties').select('balance, name, type'),
      expensesPromise,
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

    const totalExpenses = sumAmount(expenseRows);
    const expensesThisMonth = sumAmount(expenseRows.filter((r) => r.expense_date >= monthStart));
    const expensesThisYear = sumAmount(expenseRows.filter((r) => r.expense_date >= yearStart));

    const totalSales = sumAmount(salesRows);
    const totalPurchases = sumAmount(purchaseRows);
    const todaysSales = sumAmount(salesRows.filter((r) => normalizeDateKey(r.invoice_date) === today));
    const monthRevenue = sumAmount(salesRows.filter((r) => normalizeDateKey(r.invoice_date) >= monthStart));
    const monthPurchases = sumAmount(purchaseRows.filter((r) => normalizeDateKey(r.purchase_date) >= monthStart));
    const monthNetProfit = monthRevenue - monthPurchases - expensesThisMonth;
    const gstThisMonth = (salesRows || [])
      .filter((r) => normalizeDateKey(r.invoice_date) >= monthStart)
      .reduce((acc, r) => acc + Number(r.gst_amount || 0), 0);
    const invoiceCountToday = salesRows.filter((r) => normalizeDateKey(r.invoice_date) === today).length;
    const monthInvoiceCount = salesRows.filter((r) => normalizeDateKey(r.invoice_date) >= monthStart).length;

    const partyBalanceRows = partiesBalanceRes.data || [];
    const outstandingAR = partyBalanceRows
      .filter((p) => ['retailer', 'wholesaler'].includes(p.type) && Number(p.balance) > 0)
      .reduce((acc, p) => acc + Number(p.balance), 0);

    const pendingPayments = partyBalanceRows
      .filter((p) => Number(p.balance) > 0)
      .reduce((acc, p) => acc + Number(p.balance), 0);

    const pendingPartiesCount = partyBalanceRows.filter((p) => Number(p.balance) > 0).length;
    const stockValue = products.reduce(
      (acc, p) => acc + Number(p.price) * Number(p.stock_quantity),
      0
    );
    const totalStock = products.reduce((acc, p) => acc + Number(p.stock_quantity), 0);
    const lowStockProducts = products
      .filter((p) => Number(p.stock_quantity) < LOW_STOCK_THRESHOLD)
      .sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity));
    const lowStockCount = lowStockProducts.length;

    const recentSales = (recentSalesRes.data || []).map((row) => {
      const { parties, ...rest } = row;
      return { ...rest, party_name: parties?.name };
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

  const salesForTrend = salesRows.filter((r) => normalizeDateKey(r.invoice_date) >= trendStart);
  const purchasesForTrend = purchaseRows.filter((r) => normalizeDateKey(r.purchase_date) >= trendStart);

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

    const netProfit = totalSales - totalPurchases - totalExpenses;
    const profitMarginPercent =
      totalSales > 0 ? Math.round(((netProfit / totalSales) * 100 + Number.EPSILON) * 10) / 10 : 0;

    let healthStatus = 'strong';
    let healthLabel = 'Strong';
    if (profitMarginPercent < 10 || lowStockCount >= 3) {
      healthStatus = 'attention';
      healthLabel = 'Needs attention';
    } else if (profitMarginPercent < 25 || lowStockCount >= 1) {
      healthStatus = 'moderate';
      healthLabel = 'Moderate';
    }

    const healthScore = Math.max(
      0,
      Math.min(100, Math.round(50 + profitMarginPercent / 2 - lowStockCount * 5 - (pendingPayments > totalSales * 0.3 ? 15 : 0)))
    );

    res.json({
      totalSales,
      totalPurchases,
      todaysSales,
      monthRevenue,
      monthPurchases,
      monthNetProfit,
      gstThisMonth,
      invoiceCountToday,
      monthInvoiceCount,
      outstandingAR,
      pendingPayments,
      pendingPartiesCount,
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
      partyCounts,
      productInsights,
      recentActivity,
      topSellingProducts,
      businessHealth: {
        profitMarginPercent,
        netProfit,
        healthScore,
        healthStatus,
        healthLabel,
      },
      trends: {
        last7Days: buildDailyTrendFromRows(salesForTrend, purchasesForTrend, 7),
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
