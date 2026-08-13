import { useEffect, useMemo, useState } from 'react';
import { Calculator, Info } from 'lucide-react';
import { productsAPI } from '../api';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import SummaryStatCard from '../components/ui/SummaryStatCard';
import { FormField } from '../components/forms/FormField';

function parseMoney(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatInr(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`;
}

function marginPct(profit, base) {
  if (profit == null || base == null || base === 0) return null;
  return (profit / base) * 100;
}

export default function PricingCalculator() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productId, setProductId] = useState('');
  const [cost, setCost] = useState('');
  const [wholesale, setWholesale] = useState('');
  const [mrp, setMrp] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingProducts(true);
        const data = await productsAPI.getAll();
        if (!cancelled) setProducts(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const costN = parseMoney(cost);
  const wholesaleN = parseMoney(wholesale);
  const mrpN = parseMoney(mrp);

  const results = useMemo(() => {
    const yourProfit =
      costN != null && wholesaleN != null ? wholesaleN - costN : null;
    const wholesalerProfit =
      wholesaleN != null && mrpN != null ? mrpN - wholesaleN : null;
    const totalMargin = costN != null && mrpN != null ? mrpN - costN : null;

    return {
      yourProfit,
      yourProfitPct: marginPct(yourProfit, costN),
      wholesalerProfit,
      wholesalerProfitPct: marginPct(wholesalerProfit, wholesaleN),
      totalMargin,
      totalMarginPct: marginPct(totalMargin, costN),
    };
  }, [costN, wholesaleN, mrpN]);

  if (loadingProducts) {
    return <LoadingState message="Loading products…" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing & Margin Calculator"
        description="What-if tool for cost, wholesale, and retail margins — nothing is saved."
      />

      <div
        className="flex gap-3 rounded-[var(--aura-radius-medium)] border border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] px-4 py-3 text-[length:var(--aura-type-body)] text-[color:var(--status-info-text)]"
        role="note"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          This is a calculator only — it does not change or save your actual product prices. Update
          prices from the Products page.
        </p>
      </div>

      <div className="card space-y-6 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-aura-text">
          <Calculator className="h-4 w-4 text-aura-primary" aria-hidden />
          <h2 className="text-[length:var(--aura-type-h5)] font-semibold">Inputs</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Product (label only)" className="sm:col-span-2 lg:col-span-4">
            <select
              className="input input-premium"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Select a product (optional)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` · ${p.sku}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[length:var(--aura-type-caption)] text-aura-muted">
              Choosing a product does not fill any rates — enter all values yourself.
            </p>
          </FormField>

          <FormField label="Your Cost (₹)" required>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className="input input-premium"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
            />
          </FormField>

          <FormField label="Wholesale Rate (₹)" required>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className="input input-premium"
              value={wholesale}
              onChange={(e) => setWholesale(e.target.value)}
              placeholder="0.00"
            />
          </FormField>

          <FormField label="MRP / Retail Rate (₹)" required>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className="input input-premium"
              value={mrp}
              onChange={(e) => setMrp(e.target.value)}
              placeholder="0.00"
            />
          </FormField>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryStatCard
          title="Your Profit"
          value={formatInr(results.yourProfit)}
          subtitle={`${formatPct(results.yourProfitPct)} of cost · Wholesale − Cost`}
        />
        <SummaryStatCard
          title="Wholesaler's Profit"
          value={formatInr(results.wholesalerProfit)}
          subtitle={`${formatPct(results.wholesalerProfitPct)} of wholesale · MRP − Wholesale`}
        />
        <SummaryStatCard
          title="Total Margin (end-to-end)"
          value={formatInr(results.totalMargin)}
          subtitle={`${formatPct(results.totalMarginPct)} of cost · MRP − Cost`}
          className="sm:col-span-2 lg:col-span-1"
        />
      </div>
    </div>
  );
}
