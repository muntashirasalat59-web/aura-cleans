import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, MapPin } from 'lucide-react';
import { citiesAPI, salesAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import SummaryStatCard from '../components/ui/SummaryStatCard';
import { SALE_EXPORT_COLUMNS, mapSaleExportRow } from '../config/exportColumns';
import { downloadXlsx, downloadXlsxWorkbook, exportDateStamp } from '../utils/exportData';
import { balanceDue, paymentStatus } from '../utils/invoiceReceivables';
import { useDataSync } from '../hooks/useDataSync';
import { useToast } from '../context/ToastContext';
import { Link, useNavigate } from 'react-router-dom';

function formatInr(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

function mapRows(sales) {
  return sales.map((sale) => mapSaleExportRow(sale, { paymentStatus, balanceDue }));
}

function summarize(sales) {
  const invoices = sales.length;
  const totalSales = sales.reduce((sum, sale) => sum + (Number(sale.total_amount) || 0), 0);
  const pending = sales.reduce((sum, sale) => {
    const due = sale.balance_due != null ? Number(sale.balance_due) : balanceDue(sale);
    return sum + (Number.isFinite(due) ? due : 0);
  }, 0);
  return { invoices, totalSales, pending };
}

export default function CityReports() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [cities, setCities] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingKey, setExportingKey] = useState('');

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [cityRows, saleRows] = await Promise.all([citiesAPI.getAll(), salesAPI.getAll()]);
      setCities(cityRows || []);
      setSales(saleRows || []);
    } catch (err) {
      if (!silent) alert('Error loading city reports: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useDataSync(['sales', 'business_cities'], () => loadData(true));

  const groups = useMemo(() => {
    const byId = new Map();
    for (const city of cities) {
      byId.set(String(city.id), {
        id: city.id,
        name: city.city_name,
        is_active: city.is_active !== false,
        sales: [],
      });
    }
    const unassigned = [];
    for (const sale of sales) {
      const key = sale.city_id != null ? String(sale.city_id) : '';
      if (key && byId.has(key)) {
        byId.get(key).sales.push(sale);
      } else {
        unassigned.push(sale);
      }
    }
    const list = Array.from(byId.values());
    if (unassigned.length) {
      list.push({ id: 'unassigned', name: 'Unassigned', is_active: true, sales: unassigned });
    }
    return list;
  }, [cities, sales]);

  async function exportCity(group) {
    const rows = mapRows(group.sales);
    if (!rows.length) {
      showToast(`No invoices for ${group.name}`, { type: 'error' });
      return;
    }
    const key = String(group.id);
    try {
      setExportingKey(key);
      const slug = String(group.name || 'city')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      await downloadXlsx(rows, SALE_EXPORT_COLUMNS, `sales_${slug}_${exportDateStamp()}`, group.name);
      showToast(`${group.name} exported`);
    } catch (err) {
      showToast(err.message || 'Export failed', { type: 'error' });
    } finally {
      setExportingKey('');
    }
  }

  async function exportAllCities() {
    const sheets = groups.map((group) => ({
      name: group.name,
      columns: SALE_EXPORT_COLUMNS,
      rows: mapRows(group.sales),
    }));
    if (!sheets.length) {
      showToast('No cities to export', { type: 'error' });
      return;
    }
    try {
      setExportingKey('all');
      await downloadXlsxWorkbook(sheets, `sales_all_cities_${exportDateStamp()}`);
      showToast('All cities exported');
    } catch (err) {
      showToast(err.message || 'Export failed', { type: 'error' });
    } finally {
      setExportingKey('');
    }
  }

  if (loading && cities.length === 0) {
    return <LoadingState message="Loading city reports…" />;
  }

  return (
    <div>
      <PageHeader
        title="City-wise Reports"
        description="Sales totals and pending amounts by city/branch. Invoice PDFs stay unchanged."
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={exportAllCities}
            disabled={exportingKey === 'all' || groups.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {exportingKey === 'all' ? 'Exporting…' : 'Export all cities (combined)'}
          </button>
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No cities yet"
          description="Add cities in Business Settings, then tag invoices on the Sales form."
          actionLabel="Open Business Settings"
          onAction={() => navigate('/settings/business')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {groups.map((group) => {
            const stats = summarize(group.sales);
            return (
              <div key={group.id} className="card p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-[var(--app-heading)] dark:text-white">
                      {group.name}
                      {group.is_active === false ? (
                        <span className="ml-2 text-xs font-medium text-slate-400">Inactive</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tagged invoices for this city/branch
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => exportCity(group)}
                    disabled={exportingKey === String(group.id)}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    {exportingKey === String(group.id) ? 'Exporting…' : 'Export as Excel'}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <SummaryStatCard title="Invoices" value={stats.invoices.toLocaleString('en-IN')} />
                  <SummaryStatCard title="Total sales" value={formatInr(stats.totalSales)} />
                  <SummaryStatCard title="Pending" value={formatInr(stats.pending)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        Manage the city list in{' '}
        <Link to="/settings/business" className="font-medium underline">
          Business Settings
        </Link>
        .
      </p>
    </div>
  );
}
