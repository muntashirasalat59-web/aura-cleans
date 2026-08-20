const express = require('express');
const router = express.Router();
const { supabase, assertNoError } = require('../database/supabase');

function sumAmount(rows, field = 'total_amount') {
  return (rows || []).reduce((acc, row) => acc + Number(row[field] || 0), 0);
}

function mapSale(row) {
  const { parties, ...rest } = row;
  return {
    ...rest,
    party_name: parties?.name,
  };
}

function mapPurchase(row) {
  const { parties, ...rest } = row;
  return {
    ...rest,
    party_name: parties?.name,
  };
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Realized margin from invoice line rates vs current product cost. */
function buildRealizedMargin(saleItemRows) {
  const byProduct = new Map();
  let realizedProfit = 0;
  let catalogPotential = 0;
  let actualRevenue = 0;
  let totalCost = 0;

  for (const row of saleItemRows || []) {
    const qty = Number(row.quantity) || 0;
    const rate = Number(row.rate);
    const amountRaw = row.amount;
    const revenue =
      amountRaw != null && amountRaw !== ''
        ? Number(amountRaw) || 0
        : (Number.isFinite(rate) ? rate : 0) * qty;
    const costEach = Number(row.products?.cost_price) || 0;
    const listEach = Number(row.products?.price) || 0;
    const cost = costEach * qty;
    const profit = revenue - cost;
    const potential = (listEach - costEach) * qty;

    realizedProfit += profit;
    catalogPotential += potential;
    actualRevenue += revenue;
    totalCost += cost;

    const key = String(
      row.product_id ?? `${row.products?.name || 'product'}-${row.products?.unit_size || ''}`
    );
    const existing = byProduct.get(key) || {
      product_id: row.product_id,
      product_name: row.products?.name || 'Product',
      unit_size: row.products?.unit_size,
      unit_type: row.products?.unit_type,
      quantity: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
    };
    existing.quantity += qty;
    existing.revenue += revenue;
    existing.cost += cost;
    existing.profit += profit;
    byProduct.set(key, existing);
  }

  const products = Array.from(byProduct.values())
    .map((row) => ({
      ...row,
      revenue: roundMoney(row.revenue),
      cost: roundMoney(row.cost),
      profit: roundMoney(row.profit),
      margin_percent: row.revenue > 0 ? roundMoney((row.profit / row.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  return {
    realizedProfit: roundMoney(realizedProfit),
    catalogPotential: roundMoney(catalogPotential),
    difference: roundMoney(realizedProfit - catalogPotential),
    actualRevenue: roundMoney(actualRevenue),
    totalCost: roundMoney(totalCost),
    products,
  };
}

router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Query params "from" and "to" (YYYY-MM-DD) are required' });
    }

    if (from > to) {
      return res.status(400).json({ error: '"from" date must be on or before "to" date' });
    }

    const [salesRes, purchasesRes, expensesRes] = await Promise.all([
      supabase
        .from('sales')
        .select('id, invoice_number, invoice_date, subtotal, gst_amount, total_amount, parties(name)')
        .eq('is_deleted', false)
        .gte('invoice_date', from)
        .lte('invoice_date', to)
        .order('invoice_date', { ascending: false }),
      supabase
        .from('purchases')
        .select('id, purchase_date, total_amount, notes, parties(name)')
        .gte('purchase_date', from)
        .lte('purchase_date', to)
        .order('purchase_date', { ascending: false }),
      supabase
        .from('expenses')
        .select('id, title, category, amount, expense_date, payment_method, notes')
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('expense_date', { ascending: false }),
    ]);

    assertNoError(salesRes.error);
    assertNoError(purchasesRes.error);
    assertNoError(expensesRes.error);

    const sales = (salesRes.data || []).map(mapSale);
    const purchases = (purchasesRes.data || []).map(mapPurchase);
    const expenses = expensesRes.data || [];

    const saleIds = sales.map((row) => row.id);
    const purchaseIds = purchases.map((row) => row.id);

    const lineItemQueries = [];
    if (saleIds.length > 0) {
      lineItemQueries.push(
        supabase
          .from('sale_items')
          .select(
            'product_id, quantity, rate, amount, sale_id, sales(invoice_number, invoice_date, parties(name)), products(name, unit_size, unit_type, cost_price, price)'
          )
          .in('sale_id', saleIds)
      );
    }
    if (purchaseIds.length > 0) {
      lineItemQueries.push(
        supabase
          .from('purchase_items')
          .select(
            'quantity, amount, purchase_id, purchases(purchase_date, notes, parties(name)), products(name, unit_size, unit_type)'
          )
          .in('purchase_id', purchaseIds)
      );
    }

    const lineItemResults = lineItemQueries.length > 0 ? await Promise.all(lineItemQueries) : [];
    let saleItemsRes = { data: [] };
    let purchaseItemsRes = { data: [] };
    if (saleIds.length > 0) {
      saleItemsRes = lineItemResults[0];
      assertNoError(saleItemsRes.error);
    }
    if (purchaseIds.length > 0) {
      purchaseItemsRes = lineItemResults[saleIds.length > 0 ? 1 : 0];
      assertNoError(purchaseItemsRes.error);
    }

    const saleItemRows = saleItemsRes.data || [];
    const realizedMargin = buildRealizedMargin(saleItemRows);

    const salesLineItems = saleItemRows
      .map((row) => ({
        invoice_date: row.sales?.invoice_date,
        invoice_number: row.sales?.invoice_number,
        party_name: row.sales?.parties?.name,
        product_name: row.products?.name,
        unit_size: row.products?.unit_size,
        unit_type: row.products?.unit_type,
        quantity: row.quantity,
        rate: row.rate,
        amount: row.amount,
      }))
      .sort((a, b) => String(b.invoice_date).localeCompare(String(a.invoice_date)));

    const purchaseLineItems = (purchaseItemsRes.data || [])
      .map((row) => ({
        purchase_date: row.purchases?.purchase_date,
        party_name: row.purchases?.parties?.name,
        notes: row.purchases?.notes,
        product_name: row.products?.name,
        unit_size: row.products?.unit_size,
        unit_type: row.products?.unit_type,
        quantity: row.quantity,
        amount: row.amount,
      }))
      .sort((a, b) => String(b.purchase_date).localeCompare(String(a.purchase_date)));

    const totalSales = sumAmount(sales);
    const totalPurchases = sumAmount(purchases);
    const totalExpenses = sumAmount(expenses, 'amount');
    const netProfit = totalSales - totalPurchases - totalExpenses;

    res.json({
      from,
      to,
      summary: {
        totalSales,
        totalPurchases,
        totalExpenses,
        netProfit,
        realizedProfit: realizedMargin.realizedProfit,
        catalogPotential: realizedMargin.catalogPotential,
        realizedVsCatalog: realizedMargin.difference,
        realizedRevenue: realizedMargin.actualRevenue,
        realizedCost: realizedMargin.totalCost,
      },
      realizedByProduct: realizedMargin.products,
      sales,
      purchases,
      expenses,
      salesLineItems,
      purchaseLineItems,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
