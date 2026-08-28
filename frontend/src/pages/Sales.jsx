import { useState, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, X, Eye, FileDown, FileText, Pencil, Banknote, MessageCircle, Barcode, ScanLine, MapPin } from 'lucide-react';
import { salesAPI, partiesAPI, productsAPI, citiesAPI, preBookingsAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import ExportMenu from '../components/ExportMenu';
import EmptyState from '../components/EmptyState';
import ListSearchInput, { matchesListSearch } from '../components/ListSearchInput';
import { SALE_EXPORT_COLUMNS, mapSaleExportRow } from '../config/exportColumns';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import PartySelectField from '../components/forms/PartySelectField';
import CityBranchField from '../components/forms/CityBranchField';
import InvoiceLetterPreview from '../components/forms/InvoiceLetterPreview';
import InvoicePaymentFields from '../components/forms/InvoicePaymentFields';
import InvoicePaymentStatusBadge from '../components/invoice/InvoicePaymentStatusBadge';
import DeleteInvoiceModal from '../components/invoice/DeleteInvoiceModal';
import MarkPaidModal from '../components/invoice/MarkPaidModal';
import ErrorModal from '../components/ErrorModal';
import { computeGstTotals } from '../utils/invoiceGst';
import { resolveInvoicePlaceOfSupply, shippingIsSameAsBilling } from '../utils/placeOfSupply';
import { shipToFromParty, shipToMatchesParty } from '../utils/shipTo';
import { formatInrAmount, formatLineGstDisplay, enrichInvoiceLine } from '../utils/invoiceLineItems';
import { formatProductNameWithSize, formatProductOptionLabel } from '../utils/productDisplay';
import { catalogRate } from '../utils/productPricing';
import {
  SALES_PARTY_TYPES,
  SALES_QUICK_ADD_TYPES,
} from '../utils/partyTypes';
import { refreshPartiesAfterCreate } from '../utils/partyList';
import { useBusinessSettings } from '../context/BusinessSettingsContext';
import { useDataSync } from '../hooks/useDataSync';
import { notifyDataSync } from '../lib/dataSync';
import {
  emptyPaymentDetails,
  paymentFromSale,
  paymentToPayload,
  paymentBreakdown,
} from '../utils/invoicePayment';
import { balanceDue, paymentStatus, enrichPaymentFields } from '../utils/invoiceReceivables';
import {
  todayISO,
  gstPercentFromBookingItems,
  invoiceItemsFromBooking,
} from '../utils/preBookings';

const emptySaleChannel = { sale_channel: 'offline', platform: '' };
const DEFAULT_GST_RATE = 18;

function defaultCityIdFrom(list) {
  const active = (list || []).filter((c) => c.is_active !== false);
  const pick = active[0] || list?.[0];
  return pick ? String(pick.id) : '';
}

export default function Sales() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings: businessSettings } = useBusinessSettings();
  const [sales, setSales] = useState([]);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const fromPreBookingId = searchParams.get('fromPreBooking');
  const paymentFilter = searchParams.get('payment');
  const cityFilter = searchParams.get('city') || 'all';
  const [showForm, setShowForm] = useState(false);
  const [convertingBookingId, setConvertingBookingId] = useState(null);
  const appliedPrefill = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editingInvoiceNumber, setEditingInvoiceNumber] = useState('');
  const [editStockBaseline, setEditStockBaseline] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [sharingWhatsAppId, setSharingWhatsAppId] = useState(null);
  const [listSearch, setListSearch] = useState('');
  const [errorModal, setErrorModal] = useState({ open: false, title: '', message: '' });
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const [gstEnabled, setGstEnabled] = useState(true);
  const [savedGstPercent, setSavedGstPercent] = useState(DEFAULT_GST_RATE);
  const [form, setForm] = useState({
    party_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    gst_percent: DEFAULT_GST_RATE,
    place_of_supply: '',
    ship_same_as_billing: true,
    shipping_address: '',
    ship_to_same_as_party: false,
    ship_to_city: '',
    ship_to_address: '',
    items: [{ product_id: '', quantity: 1, rate: 0, price_type: 'wholesale' }],
    payment: emptyPaymentDetails(),
    ...emptySaleChannel,
    city_id: '',
  });

  function showError(title, message) {
    setErrorModal({ open: true, title, message });
  }

  function closeErrorModal() {
    setErrorModal({ open: false, title: '', message: '' });
  }

  function formatCreateInvoiceError(err) {
    const msg = err?.message || '';
    if (
      err?.code === 'INVOICE_NUMBER_CONFLICT' ||
      /duplicate key|sales_invoice_number|invoice_number/i.test(msg)
    ) {
      return 'Something went wrong while generating the invoice number. Please try again.';
    }
    return msg || 'Failed to save invoice.';
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!fromPreBookingId || loading) return;
    if (appliedPrefill.current === fromPreBookingId) return;
    appliedPrefill.current = fromPreBookingId;
    let cancelled = false;
    (async () => {
      try {
        const row = await preBookingsAPI.getOne(fromPreBookingId);
        if (cancelled) return;
        if ((row.status || 'upcoming') !== 'upcoming') {
          showError(
            'Pre-booking unavailable',
            'Only upcoming pre-bookings can be converted to an invoice.'
          );
          closeForm();
          return;
        }
        await openFromPreBooking(row);
      } catch (err) {
        if (cancelled) return;
        showError('Could not load pre-booking', err.message || 'Failed to open invoice form.');
        closeForm();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromPreBookingId, loading]);

  useEffect(() => {
    if (!showForm || editingId) return;
    setForm((prev) => {
      if (prev.city_id) return prev;
      const next = defaultCityIdFrom(cities);
      return next ? { ...prev, city_id: next } : prev;
    });
  }, [cities, showForm, editingId]);

  useDataSync(['sales', 'parties', 'products', 'business_cities'], () => loadData(true));

  const displayedSales = useMemo(() => {
    let list = sales;
    if (paymentFilter === 'pending') {
      list = list.filter((sale) => {
        const status = sale.payment_status || paymentStatus(sale);
        const due = sale.balance_due != null ? Number(sale.balance_due) : balanceDue(sale);
        return due > 0 && (status === 'pending' || status === 'partial');
      });
    }
    if (cityFilter === 'none') {
      list = list.filter((sale) => sale.city_id == null || sale.city_id === '');
    } else if (cityFilter && cityFilter !== 'all') {
      list = list.filter((sale) => String(sale.city_id) === String(cityFilter));
    }
    return list.filter((sale) =>
      matchesListSearch(listSearch, sale.invoice_number, sale.party_name, sale.city_name)
    );
  }, [sales, paymentFilter, cityFilter, listSearch]);

  function clearPaymentFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete('payment');
    setSearchParams(next, { replace: true });
  }

  function setCityFilter(value) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete('city');
    else next.set('city', value);
    setSearchParams(next, { replace: true });
  }

  function clearFromPreBookingParam() {
    if (!searchParams.get('fromPreBooking')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('fromPreBooking');
    setSearchParams(next, { replace: true });
  }

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      const [salesData, partiesData, productsData, citiesResult] = await Promise.all([
        salesAPI.getAll(),
        partiesAPI.getAll({ activeOnly: true }),
        productsAPI.getAll({ activeOnly: true }),
        citiesAPI
          .getAll()
          .then((rows) => rows || [])
          .catch(() => []),
      ]);
      setSales(salesData);
      setParties(partiesData);
      setProducts(productsData);
      setCities(citiesResult);
    } catch (err) {
      if (!silent) alert('Error: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function addItemRow() {
    setForm({
      ...form,
      items: [...form.items, { product_id: '', quantity: 1, rate: 0, price_type: 'wholesale' }],
    });
  }

  function removeItemRow(index) {
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  }

  function updateItem(index, field, value) {
    const newItems = [...form.items];
    newItems[index][field] = value;

    if (field === 'product_id') {
      const product = products.find((p) => p.id === parseInt(value, 10));
      if (product) {
        newItems[index].rate = catalogRate(product, newItems[index].price_type || 'wholesale');
      }
    }

    if (field === 'price_type') {
      const product = products.find((p) => p.id === parseInt(newItems[index].product_id, 10));
      if (product) {
        newItems[index].rate = catalogRate(product, value);
      }
    }

    setForm({ ...form, items: newItems });
  }

  /** GST OFF sets the invoice rate to 0% (remembers the prior rate to restore on GST ON). */
  function handleToggleGst() {
    if (gstEnabled) {
      setSavedGstPercent(Number(form.gst_percent) || DEFAULT_GST_RATE);
      setGstEnabled(false);
      setForm((prev) => ({ ...prev, gst_percent: 0 }));
    } else {
      setGstEnabled(true);
      setForm((prev) => ({ ...prev, gst_percent: savedGstPercent || DEFAULT_GST_RATE }));
    }
  }

  /** Barcode scan: finds the product client-side (products are already loaded)
   * and either bumps quantity on an existing line for it, fills the first
   * empty row, or adds a new one. */
  function handleScanBarcode(e) {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const product = products.find((p) => (p.barcode || '').trim() === code);
    if (!product) {
      setBarcodeError(`No product found for barcode ${code}`);
      setBarcodeInput('');
      return;
    }

    setBarcodeError('');
    setForm((prev) => {
      const items = [...prev.items];
      const existingIndex = items.findIndex(
        (item) => parseInt(item.product_id, 10) === product.id
      );

      if (existingIndex >= 0) {
        items[existingIndex] = {
          ...items[existingIndex],
          quantity: (parseInt(items[existingIndex].quantity, 10) || 0) + 1,
        };
        return { ...prev, items };
      }

      const emptyIndex = items.findIndex((item) => !item.product_id);
      const priceType =
        emptyIndex >= 0 ? items[emptyIndex].price_type || 'wholesale' : 'wholesale';
      const newItem = {
        product_id: String(product.id),
        quantity: 1,
        rate: catalogRate(product, priceType),
        price_type: priceType,
      };
      if (emptyIndex >= 0) {
        items[emptyIndex] = newItem;
      } else {
        items.push(newItem);
      }
      return { ...prev, items };
    });
    setBarcodeInput('');
  }

  const gstTotals = computeGstTotals(form.items, form.gst_percent);
  const calculateSubtotal = () => gstTotals.subtotal;
  const calculateGST = () => gstTotals.gstAmount;
  const calculateTotal = () => gstTotals.total;

  function getSelectedParty() {
    return parties.find((p) => p.id === parseInt(form.party_id, 10));
  }

  function resetForm() {
    setEditingId(null);
    setEditingInvoiceNumber('');
    setEditStockBaseline({});
    setBarcodeInput('');
    setBarcodeError('');
    setGstEnabled(true);
    setSavedGstPercent(DEFAULT_GST_RATE);
    setForm({
      party_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      gst_percent: DEFAULT_GST_RATE,
      place_of_supply: '',
      ship_same_as_billing: true,
      shipping_address: '',
      ship_to_same_as_party: false,
      ship_to_city: '',
      ship_to_address: '',
      items: [{ product_id: '', quantity: 1, rate: 0, price_type: 'wholesale' }],
      payment: emptyPaymentDetails(),
      ...emptySaleChannel,
      city_id: defaultCityIdFrom(cities),
    });
  }

  function openCreateForm() {
    appliedPrefill.current = null;
    setConvertingBookingId(null);
    clearFromPreBookingParam();
    resetForm();
    setShowForm(true);
  }

  function closeForm() {
    appliedPrefill.current = null;
    setConvertingBookingId(null);
    clearFromPreBookingParam();
    setShowForm(false);
    resetForm();
  }

  async function openFromPreBooking(row) {
    const items = invoiceItemsFromBooking(row.items);
    await ensurePartyInList(row.party_id);
    await ensureProductsInList(items.map((item) => parseInt(item.product_id, 10)).filter(Boolean));
    let party = parties.find((p) => String(p.id) === String(row.party_id));
    if (!party && row.party_id) {
      try {
        party = await partiesAPI.getOne(row.party_id);
      } catch {
        party = null;
      }
    }
    const gstPercent = gstPercentFromBookingItems(row.items);
    setEditingId(null);
    setEditingInvoiceNumber('');
    setEditStockBaseline({});
    setBarcodeInput('');
    setBarcodeError('');
    setGstEnabled(gstPercent > 0);
    setSavedGstPercent(gstPercent > 0 ? gstPercent : DEFAULT_GST_RATE);
    setConvertingBookingId(row.id);
    setForm({
      party_id: String(row.party_id || ''),
      invoice_date: todayISO(),
      gst_percent: gstPercent,
      place_of_supply: resolveInvoicePlaceOfSupply({
        party,
        shippingAddress: party?.address,
        business: businessSettings,
      }),
      ship_same_as_billing: true,
      shipping_address: '',
      ship_to_same_as_party: false,
      ship_to_city: '',
      ship_to_address: '',
      items,
      payment: emptyPaymentDetails(),
      ...emptySaleChannel,
      city_id:
        row.city_id != null && row.city_id !== ''
          ? String(row.city_id)
          : defaultCityIdFrom(cities),
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** While editing, qty on this invoice is still "reserved" until save — show effective stock in dropdown */
  function getDisplayStock(productId) {
    const id = parseInt(productId, 10);
    if (!id) return 0;
    const product = products.find((p) => p.id === id);
    if (!product) return 0;
    const restored = editStockBaseline[id] || 0;
    return Number(product.stock_quantity) + restored;
  }

  async function ensurePartyInList(partyId) {
    if (!partyId || parties.some((p) => String(p.id) === String(partyId))) return;
    try {
      const party = await partiesAPI.getOne(partyId);
      setParties((prev) => [...prev, party]);
    } catch {
      /* party may have been hard-deleted */
    }
  }

  async function handlePartyCreated(party) {
    try {
      const { party: saved, parties: fresh } = await refreshPartiesAfterCreate(
        partiesAPI,
        party
      );
      flushSync(() => {
        setParties(fresh);
      });
      return saved;
    } catch (err) {
      flushSync(() => {
        setParties((prev) =>
          prev.some((p) => String(p.id) === String(party?.id)) ? prev : [...prev, party]
        );
      });
      throw new Error(
        err.message ||
          'Customer saved, but the list could not reload. Pick them from the dropdown or refresh the page.'
      );
    }
  }

  async function ensureProductsInList(productIds) {
    const missing = productIds.filter((id) => id && !products.some((p) => p.id === id));
    if (missing.length === 0) return;
    const fetched = await Promise.all(
      missing.map(async (id) => {
        try {
          return await productsAPI.getOne(id);
        } catch {
          return null;
        }
      })
    );
    const valid = fetched.filter(Boolean);
    if (valid.length > 0) {
      setProducts((prev) => [...prev, ...valid]);
    }
  }

  async function openEditInvoice(id) {
    try {
      const data = await salesAPI.getOne(id);
      await ensurePartyInList(data.party_id);
      await ensureProductsInList(data.items.map((item) => item.product_id));
      const baseline = {};
      for (const item of data.items) {
        baseline[item.product_id] = (baseline[item.product_id] || 0) + item.quantity;
      }
      setEditingId(data.id);
      setEditingInvoiceNumber(data.invoice_number);
      setEditStockBaseline(baseline);
      setBarcodeInput('');
      setBarcodeError('');
      const loadedGst = Number(data.gst_percent) || 0;
      setGstEnabled(loadedGst > 0);
      setSavedGstPercent(loadedGst > 0 ? loadedGst : DEFAULT_GST_RATE);
      setForm({
        party_id: String(data.party_id),
        invoice_date: data.invoice_date,
        gst_percent: loadedGst,
        place_of_supply: resolveInvoicePlaceOfSupply({
          placeOfSupply: data.place_of_supply,
          party: { gst_number: data.gst_number, address: data.address },
          shippingAddress: data.shipping_address,
          business: businessSettings,
        }),
        ship_same_as_billing: shippingIsSameAsBilling(data.shipping_address, data.address),
        shipping_address: data.shipping_address || '',
        ship_to_city: data.ship_to_city || '',
        ship_to_address: data.ship_to_address || '',
        ship_to_same_as_party: shipToMatchesParty(
          data.ship_to_city,
          data.ship_to_address,
          { address: data.address }
        ),
        items: data.items.map((item) => ({
          product_id: String(item.product_id),
          quantity: item.quantity,
          rate: item.rate,
        })),
        payment: paymentFromSale(data),
        sale_channel: data.sale_channel === 'online' ? 'online' : 'offline',
        platform: data.platform || '',
        city_id: data.city_id != null ? String(data.city_id) : defaultCityIdFrom(cities),
      });
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert('Error loading invoice: ' + err.message);
    }
  }

  function getPreviewLineItems() {
    return form.items
      .filter((item) => item.product_id)
      .map((item) => {
        const product = products.find((p) => p.id === parseInt(item.product_id, 10));
        return {
          name: product?.name || 'Product',
          unit_size: product?.unit_size,
          unit_type: product?.unit_type,
          hsn_sac: product?.hsn_sac || '',
          quantity: item.quantity,
          rate: item.rate,
        };
      });
  }

  function getProductHsn(productId) {
    const product = products.find((p) => p.id === parseInt(productId, 10));
    return product?.hsn_sac?.trim() || '—';
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.party_id) {
      alert('Please select a customer / party.');
      return;
    }

    if (!form.city_id) {
      alert('Select a city/branch for this invoice.');
      return;
    }

    const validItems = form.items.filter((item) => item.product_id);
    if (validItems.length === 0) {
      alert('Add at least one product');
      return;
    }

    if (form.sale_channel === 'online' && !form.platform.trim()) {
      alert('Enter the platform name (e.g. Amazon, Flipkart) for an online sale.');
      return;
    }

    for (const item of validItems) {
      const productId = parseInt(item.product_id, 10);
      const product = products.find((p) => p.id === productId);
      const qty = parseInt(item.quantity, 10);
      const available = getDisplayStock(productId);
      if (qty > available) {
        const name = product?.name || 'Product';
        alert(`Insufficient stock for ${name}. Available: ${available}, requested: ${qty}.`);
        return;
      }
    }

    const invoiceTotal = calculateTotal();
    const settlement = paymentBreakdown(form.payment, invoiceTotal);
    if (form.payment.collection === 'pending') {
      const entered = Number(form.payment.amount_paid);
      if (form.payment.amount_paid !== '' && Number.isFinite(entered) && entered > invoiceTotal + 0.001) {
        alert('Amount received now cannot exceed the invoice total.');
        return;
      }
      if (settlement.status !== 'paid' && !form.payment.due_date?.trim()) {
        alert('Select a due date for pending payment.');
        return;
      }
    }

    try {
      const payload = {
        party_id: parseInt(form.party_id),
        invoice_date: form.invoice_date,
        gst_percent: gstEnabled ? parseFloat(form.gst_percent) : 0,
        place_of_supply: form.place_of_supply.trim(),
        ship_same_as_billing: form.ship_same_as_billing,
        shipping_address: form.ship_same_as_billing ? '' : form.shipping_address.trim(),
        ship_to_city: form.ship_to_city.trim(),
        ship_to_address: form.ship_to_address.trim(),
        items: validItems.map((item) => ({
          product_id: parseInt(item.product_id),
          quantity: parseInt(item.quantity),
          rate: parseFloat(item.rate),
        })),
        payment: paymentToPayload(form.payment, invoiceTotal),
        sale_channel: form.sale_channel,
        platform: form.sale_channel === 'online' ? form.platform.trim() : '',
        city_id: form.city_id ? parseInt(form.city_id, 10) : null,
      };
      const linkedBookingId = !editingId ? convertingBookingId : null;
      if (linkedBookingId) {
        payload.pre_booking_id = linkedBookingId;
      }

      if (editingId) {
        await salesAPI.update(editingId, payload);
        alert('Invoice updated! Stock and totals recalculated.');
      } else {
        await salesAPI.create(payload);
        alert('Invoice created! Stock updated automatically.');
      }

      closeForm();
      notifyDataSync('sales');
      notifyDataSync('products');
      if (linkedBookingId) notifyDataSync('pre_bookings');
    } catch (err) {
      showError('Could not save invoice', formatCreateInvoiceError(err));
    }
  }

  async function viewInvoiceDetails(id) {
    try {
      const data = await salesAPI.getOne(id);
      setViewInvoice(data);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function downloadPDF(id) {
    try {
      await salesAPI.downloadPDF(id);
    } catch (err) {
      alert('Error downloading PDF: ' + err.message);
    }
  }

  async function shareOnWhatsApp(id) {
    if (sharingWhatsAppId) return;
    try {
      setSharingWhatsAppId(id);
      const result = await salesAPI.shareWhatsApp(id);
      if (!result?.whatsappUrl) {
        throw new Error('WhatsApp link could not be created');
      }
      window.open(result.whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const message = err.message || 'Failed to share on WhatsApp';
      if (/contact number|PARTY_CONTACT/i.test(message)) {
        showError('Contact missing', 'Party ka contact number add karo pehle');
      } else {
        showError('WhatsApp share failed', message);
      }
    } finally {
      setSharingWhatsAppId(null);
    }
  }

  function openDeleteInvoice(id, invoiceNumber) {
    setDeleteTarget({ id, invoiceNumber });
  }

  function closeDeleteInvoice() {
    if (deletingInvoice) return;
    setDeleteTarget(null);
  }

  async function confirmDeleteInvoice(reason) {
    if (!deleteTarget) return;

    const { id } = deleteTarget;

    try {
      setDeletingInvoice(true);
      const result = await salesAPI.delete(id, { reason });
      alert(result.message || 'Invoice deleted.');
      setDeleteTarget(null);
      if (editingId === id) closeForm();
      if (viewInvoice?.id === id) setViewInvoice(null);
      notifyDataSync('sales');
      notifyDataSync('products');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setDeletingInvoice(false);
    }
  }

  function openMarkPaid(sale) {
    const payment = enrichPaymentFields(sale);
    setMarkPaidTarget({
      id: sale.id,
      invoiceNumber: sale.invoice_number,
      partyName: sale.party_name,
      amountDue: payment.balance_due,
    });
  }

  function closeMarkPaid() {
    if (markingPaid) return;
    setMarkPaidTarget(null);
  }

  async function confirmMarkPaid({ payment_date, payment_method }) {
    if (!markPaidTarget) return;
    try {
      setMarkingPaid(true);
      const updated = await salesAPI.markPaid(markPaidTarget.id, {
        payment_date,
        payment_method,
      });
      setSales((prev) =>
        prev.map((s) => (s.id === markPaidTarget.id ? { ...s, ...updated } : s))
      );
      setMarkPaidTarget(null);
      notifyDataSync('sales');
      notifyDataSync('parties');
    } catch (err) {
      showError('Could not mark as paid', err.message || 'Failed to update payment status.');
    } finally {
      setMarkingPaid(false);
    }
  }

  if (loading && sales.length === 0 && parties.length === 0) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Sales & invoices"
        description="Create GST invoices, track revenue, and download PDFs."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <ExportMenu
              filePrefix="sales"
              successLabel="Sales"
              columns={SALE_EXPORT_COLUMNS}
              getRows={() =>
                displayedSales.map((s) =>
                  mapSaleExportRow(s, { paymentStatus, balanceDue })
                )
              }
            />
            <button
              onClick={() => (showForm ? closeForm() : openCreateForm())}
              className={`btn w-full sm:w-auto ${showForm ? 'btn-secondary' : 'btn-primary'}`}
            >
              {showForm ? (
                <>
                  <X className="h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  New invoice
                </>
              )}
            </button>
          </div>
        }
      />

      {paymentFilter === 'pending' && (
        <div className="status-banner status-banner-info mb-4 flex flex-wrap items-center gap-2 py-2 dark:border dark:border-sky-700/50 dark:bg-sky-950/40 dark:text-sky-100">
          <span className="font-medium">
            Showing pending / partial invoices ({displayedSales.length})
          </span>
          <button
            type="button"
            onClick={clearPaymentFilter}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-[var(--app-accent-soft)] dark:hover:bg-sky-900/50"
          >
            Clear filter
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {cities.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-400" />
          <button
            type="button"
            onClick={() => setCityFilter('all')}
            className={`btn btn-sm ${cityFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All Cities
          </button>
          {cities.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => setCityFilter(String(city.id))}
              className={`btn btn-sm ${cityFilter === String(city.id) ? 'btn-primary' : 'btn-secondary'}`}
            >
              {city.city_name}
            </button>
          ))}
          {sales.some((s) => s.city_id == null || s.city_id === '') && (
            <button
              type="button"
              onClick={() => setCityFilter('none')}
              className={`btn btn-sm ${cityFilter === 'none' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Unassigned
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div className="form-panel">
          <FormShell
            icon={FileText}
            title={editingId ? 'Edit invoice' : 'Invoice builder'}
            subtitle={
              editingId
                ? `Update line items, party, or tax — ${editingInvoiceNumber}. Stock adjusts on save.`
                : convertingBookingId
                  ? 'Pre-filled from a pre-booking. Edit anything before you save — the booking is marked delivered only after this invoice is created.'
                  : 'Create a GST tax invoice — preview before you save.'
            }
          >
            <form onSubmit={handleSubmit}>
              <p className="form-section-label">Invoice header</p>
              <div className="form-grid mb-8">
                <FormField label="Invoice date" required>
                  <input
                    type="date"
                    className="input input-premium"
                    value={form.invoice_date}
                    onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                    required
                  />
                </FormField>
                <CityBranchField
                  cities={cities}
                  value={form.city_id}
                  onChange={(cityId) => setForm((prev) => ({ ...prev, city_id: cityId }))}
                  onCityCreated={(created) => {
                    setCities((prev) => {
                      if (prev.some((c) => String(c.id) === String(created.id))) return prev;
                      return [...prev, created];
                    });
                    notifyDataSync('business_cities');
                  }}
                />
                <FormField label="GST">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleToggleGst}
                      className={`btn shrink-0 ${gstEnabled ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {gstEnabled ? 'GST ON' : 'GST OFF'}
                    </button>
                    <input
                      type="number"
                      className="input input-premium"
                      value={form.gst_percent}
                      disabled={!gstEnabled}
                      onChange={(e) => setForm({ ...form, gst_percent: e.target.value })}
                    />
                  </div>
                </FormField>
                <FormField label="Invoice no.">
                  <input
                    className="input input-premium bg-slate-50"
                    value={editingId ? editingInvoiceNumber : 'Auto-generated on save'}
                    readOnly
                    disabled
                  />
                </FormField>
              </div>

              <p className="form-section-label">Sale channel</p>
              <div className="form-grid mb-8">
                <FormField label="Where was this sold?" className="md:col-span-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, sale_channel: 'offline', platform: '' }))}
                      className={`btn flex-1 ${form.sale_channel === 'offline' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      Offline
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, sale_channel: 'online' }))}
                      className={`btn flex-1 ${form.sale_channel === 'online' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      Online
                    </button>
                  </div>
                </FormField>
                {form.sale_channel === 'online' && (
                  <FormField
                    label="Platform"
                    required
                    hint="e.g. Amazon, Flipkart, Blinkit, Meesho"
                    className="md:col-span-2"
                  >
                    <input
                      className="input input-premium"
                      value={form.platform}
                      onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}
                      placeholder="Type the platform name"
                    />
                  </FormField>
                )}
              </div>

              <p className="form-section-label">Bill to — party</p>
              <div className="form-grid mb-8">
                <PartySelectField
                  label="Customer / party"
                  required
                  className="md:col-span-2"
                  value={form.party_id}
                  onChange={(partyId) => {
                    const party = parties.find((p) => String(p.id) === String(partyId));
                    setForm((prev) => {
                      const next = {
                        ...prev,
                        party_id: partyId,
                        place_of_supply: resolveInvoicePlaceOfSupply({
                          party,
                          shippingAddress: prev.ship_same_as_billing
                            ? party?.address
                            : prev.shipping_address,
                          business: businessSettings,
                        }),
                      };
                      if (prev.ship_to_same_as_party) {
                        const from = shipToFromParty(party);
                        if (from.ship_to_city || from.ship_to_address) {
                          next.ship_to_city = from.ship_to_city;
                          next.ship_to_address = from.ship_to_address;
                        }
                      }
                      return next;
                    });
                  }}
                  parties={parties}
                  onPartyCreated={handlePartyCreated}
                  defaultTypes={SALES_PARTY_TYPES}
                  showAllLabel="Show all party types (including manufacturers)"
                  quickAddLabel="New Customer"
                  quickAddTitle="New customer"
                  quickAddDefaultType="retailer"
                  quickAddAllowedTypes={SALES_QUICK_ADD_TYPES}
                  placeholder="Search customer…"
                />
                <FormField
                  label="Place of supply"
                  hint="Defaults to your business state, or the customer's state when their GSTIN or address is in a different state."
                  className="md:col-span-2"
                >
                  <input
                    className="input input-premium"
                    value={form.place_of_supply}
                    onChange={(e) => setForm({ ...form, place_of_supply: e.target.value })}
                    placeholder="Customer state (e.g. Gujarat)"
                  />
                </FormField>
                <FormField label="Shipping" className="md:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={form.ship_same_as_billing}
                      onChange={(e) =>
                        setForm({ ...form, ship_same_as_billing: e.target.checked })
                      }
                    />
                    Ship to same as billing
                  </label>
                </FormField>
                {!form.ship_same_as_billing && (
                  <FormField label="Shipping address" className="md:col-span-2">
                    <textarea
                      className="input input-premium min-h-[84px]"
                      value={form.shipping_address}
                      onChange={(e) => setForm({ ...form, shipping_address: e.target.value })}
                      placeholder="Enter shipping address"
                    />
                  </FormField>
                )}
              </div>

              <p className="form-section-label">Shipping / delivery details</p>
              <div className="form-grid mb-8">
                <FormField
                  label="Courier destination"
                  hint="Optional. Prints a SHIP TO city on the invoice for courier delivery. Leave empty for local invoices — City/Branch above is not printed."
                  className="md:col-span-2"
                >
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={form.ship_to_same_as_party}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm((prev) => {
                          if (!checked) {
                            return { ...prev, ship_to_same_as_party: false };
                          }
                          const party = parties.find((p) => String(p.id) === String(prev.party_id));
                          const from = shipToFromParty(party);
                          if (!from.ship_to_city && !from.ship_to_address) {
                            return { ...prev, ship_to_same_as_party: true };
                          }
                          return {
                            ...prev,
                            ship_to_same_as_party: true,
                            ship_to_city: from.ship_to_city,
                            ship_to_address: from.ship_to_address,
                          };
                        });
                      }}
                    />
                    Same as party's city/address
                  </label>
                </FormField>
                <FormField
                  label="Ship to City"
                  hint='Destination city for courier (e.g. Surat, Vadodara)'
                >
                  <input
                    className="input input-premium"
                    value={form.ship_to_city}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        ship_to_city: e.target.value,
                        ship_to_same_as_party: false,
                      }))
                    }
                    placeholder="Surat"
                  />
                </FormField>
                <FormField
                  label="Ship to Address"
                  hint="Optional full delivery address"
                  className="md:col-span-2"
                >
                  <textarea
                    className="input input-premium min-h-[84px]"
                    value={form.ship_to_address}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        ship_to_address: e.target.value,
                        ship_to_same_as_party: false,
                      }))
                    }
                    placeholder="Optional street / landmark"
                  />
                </FormField>
              </div>

              <p className="form-section-label">Product line items</p>

              <div className="mb-4 flex gap-2">
                <div className="relative flex-1">
                  <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    className="input input-premium pl-9"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleScanBarcode(e);
                      }
                    }}
                    placeholder="Scan or type barcode, then press Enter"
                  />
                </div>
                <button type="button" onClick={handleScanBarcode} className="btn btn-secondary shrink-0">
                  <Barcode className="h-4 w-4" />
                  Add
                </button>
              </div>
              {barcodeError && (
                <p className="mb-4 -mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                  {barcodeError}
                </p>
              )}

              <div className="invoice-form-table-scroll">
                <table className="line-items-table">
                  <thead>
                    <tr>
                      <th className="col-sn text-center">#</th>
                      <th className="col-item">Item Name</th>
                      <th className="col-hsn whitespace-nowrap">HSN/SAC</th>
                      <th className="col-qty text-right">Qty</th>
                      <th className="col-price-type whitespace-nowrap">Price type</th>
                      <th className="col-rate text-right whitespace-nowrap">Price/Unit (₹)</th>
                      <th className="col-gst text-right whitespace-nowrap">GST</th>
                      <th className="col-amount text-right whitespace-nowrap">Amount (excl. GST)</th>
                      <th className="col-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, index) => {
                      const product = item.product_id
                        ? products.find((p) => p.id === parseInt(item.product_id, 10))
                        : null;
                      const line = product
                        ? enrichInvoiceLine(
                            {
                              quantity: item.quantity,
                              rate: item.rate,
                              name: product.name,
                              unit_size: product.unit_size,
                              unit_type: product.unit_type,
                              hsn_sac: getProductHsn(item.product_id),
                            },
                            index,
                            form.gst_percent
                          )
                        : null;
                      return (
                        <tr key={index}>
                          <td className="col-sn text-center tabular-nums text-slate-500 font-medium">{index + 1}</td>
                          <td className="col-item">
                            <select
                              className="line-item-row-input"
                              value={item.product_id}
                              onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                              title={product ? formatProductNameWithSize(product, 'inline') : 'Select product'}
                            >
                              <option value="">Select product</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {formatProductOptionLabel(p, { stock: getDisplayStock(p.id) })}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="col-hsn">
                            <span className="line-item-cell-hsn">
                              {item.product_id ? getProductHsn(item.product_id) : '—'}
                            </span>
                          </td>
                          <td className="col-qty">
                            <input
                              type="number"
                              min="1"
                              className="line-item-qty-input"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            />
                          </td>
                          <td className="col-price-type">
                            <select
                              className="line-item-row-input"
                              value={item.price_type || 'wholesale'}
                              onChange={(e) => updateItem(index, 'price_type', e.target.value)}
                              aria-label="Price type"
                            >
                              <option value="wholesale">Wholesale</option>
                              <option value="retail">Retail</option>
                            </select>
                          </td>
                          <td className="col-rate">
                            <input
                              type="number"
                              step="0.01"
                              className="line-item-rate-input"
                              value={item.rate}
                              onChange={(e) => updateItem(index, 'rate', e.target.value)}
                            />
                          </td>
                          <td className="col-gst">
                            <span className="line-item-cell-gst">
                              {line ? formatLineGstDisplay(line) : '—'}
                            </span>
                          </td>
                          <td className="col-amount">
                            <span className="line-item-cell-amount">
                              {line ? formatInrAmount(line.taxable) : '—'}
                            </span>
                          </td>
                          <td className="col-actions">
                            {form.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItemRow(index)}
                                className="btn-icon text-red-500 hover:bg-red-50"
                                aria-label="Remove"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-500 mb-4">
                Line amounts exclude GST. GST updates automatically when qty, rate, or invoice GST % changes.
              </p>

              <button type="button" onClick={addItemRow} className="link-action text-sm mb-6">
                <Plus className="h-4 w-4" />
                Add line item
              </button>

              <p className="form-section-label">Payment collection</p>
              <InvoicePaymentFields
                payment={form.payment}
                invoiceTotal={calculateTotal()}
                onChange={(payment) => setForm((prev) => ({ ...prev, payment }))}
              />

              <div className="hidden lg:block mb-2">
                <p className="form-section-label mb-3">Live preview</p>
                <div className="invoice-live-preview-wrap">
                  <InvoiceLetterPreview
                    compact
                    invoiceNumber={editingId ? editingInvoiceNumber : 'INV-DRAFT'}
                    invoiceDate={form.invoice_date}
                    party={getSelectedParty()}
                    placeOfSupply={form.place_of_supply}
                    shippingAddress={form.shipping_address}
                    shipSameAsBilling={form.ship_same_as_billing}
                    shipToCity={form.ship_to_city}
                    shipToAddress={form.ship_to_address}
                    items={getPreviewLineItems()}
                    gstPercent={form.gst_percent}
                    subtotal={calculateSubtotal()}
                    gstAmount={calculateGST()}
                    total={calculateTotal()}
                    payment={form.payment}
                  />
                </div>
              </div>

              <FormActions
                submitLabel={editingId ? 'Update invoice' : 'Create invoice'}
                onCancel={closeForm}
                extra={
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-lg hidden lg:inline-flex"
                      onClick={() => setShowPreview(true)}
                    >
                      <Eye className="h-4 w-4" />
                      Preview
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-lg lg:hidden"
                      onClick={() => setShowPreview(true)}
                    >
                      <Eye className="h-4 w-4" />
                      Preview invoice
                    </button>
                  </>
                }
              />
            </form>
          </FormShell>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="bg-slate-100 surface-light w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900">Preview invoice</h3>
              <button type="button" className="btn-icon" onClick={() => setShowPreview(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <InvoiceLetterPreview
              invoiceNumber={editingId ? editingInvoiceNumber : 'INV-DRAFT'}
              invoiceDate={form.invoice_date}
              party={getSelectedParty()}
              placeOfSupply={form.place_of_supply}
              shippingAddress={form.shipping_address}
              shipSameAsBilling={form.ship_same_as_billing}
              shipToCity={form.ship_to_city}
              shipToAddress={form.ship_to_address}
              items={getPreviewLineItems()}
              gstPercent={form.gst_percent}
              subtotal={calculateSubtotal()}
              gstAmount={calculateGST()}
              total={calculateTotal()}
              payment={form.payment}
              forPrint
            />
          </div>
        </div>
      )}

      {viewInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 print-modal-root">
          <div className="bg-white surface-light rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-200 print-modal-panel">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-start no-print print:hidden dark:bg-slate-900 dark:border-slate-700">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{viewInvoice.invoice_number}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{viewInvoice.invoice_date}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewInvoice(null)}
                className="btn-icon"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 print-invoice-shell">
              <InvoiceLetterPreview
                invoiceNumber={viewInvoice.invoice_number}
                invoiceDate={viewInvoice.invoice_date}
                party={{
                  name: viewInvoice.party_name,
                  contact: viewInvoice.contact,
                  address: viewInvoice.address,
                  gst_number: viewInvoice.gst_number,
                }}
                placeOfSupply={viewInvoice.place_of_supply}
                shippingAddress={viewInvoice.shipping_address}
                shipSameAsBilling={shippingIsSameAsBilling(
                  viewInvoice.shipping_address,
                  viewInvoice.address
                )}
                shipToCity={viewInvoice.ship_to_city}
                shipToAddress={viewInvoice.ship_to_address}
                items={viewInvoice.items.map((item) => ({
                  product_name: item.product_name,
                  unit_size: item.unit_size,
                  unit_type: item.unit_type,
                  hsn_sac: item.hsn_sac,
                  quantity: item.quantity,
                  rate: item.rate,
                }))}
                gstPercent={viewInvoice.gst_percent}
                subtotal={viewInvoice.subtotal}
                gstAmount={viewInvoice.gst_amount}
                total={viewInvoice.total_amount}
                payment={paymentFromSale(viewInvoice)}
                forPrint
              />

              <div className="flex flex-col sm:flex-row gap-3 mt-6 no-print print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-secondary flex-1"
                >
                  <FileText className="h-4 w-4" />
                  Print
                </button>
                <button onClick={() => downloadPDF(viewInvoice.id)} className="btn btn-primary flex-1">
                  <FileDown className="h-4 w-4" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => shareOnWhatsApp(viewInvoice.id)}
                  disabled={sharingWhatsAppId === viewInvoice.id}
                  className="btn btn-secondary flex-1"
                >
                  <MessageCircle className="h-4 w-4" />
                  {sharingWhatsAppId === viewInvoice.id ? 'Sharing…' : 'Share on WhatsApp'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="table-wrap no-print">
        <div className="table-wrap-header flex-wrap">
          <div className="min-w-0">
            <h3 className="card-section-title mb-0">Invoice history</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {displayedSales.length} invoice{displayedSales.length === 1 ? '' : 's'}
              {paymentFilter === 'pending' && sales.length !== displayedSales.length
                ? ` of ${sales.length}`
                : ''}
              {listSearch.trim() ? ' matching search' : ''}
            </p>
          </div>
          <ListSearchInput
            value={listSearch}
            onChange={setListSearch}
            placeholder="Search invoices..."
            aria-label="Search invoices by number or party name"
          />
        </div>
        {displayedSales.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={
              listSearch.trim()
                ? 'No matching invoices'
                : paymentFilter === 'pending'
                  ? 'No pending invoices'
                  : 'No invoices yet'
            }
            description={
              listSearch.trim()
                ? 'Try another invoice number or party name.'
                : paymentFilter === 'pending'
                  ? 'All invoices are fully paid, or no receivables match this filter.'
                  : 'Create a GST invoice to record a sale, update stock, and download a PDF.'
            }
            actionLabel={
              listSearch.trim()
                ? undefined
                : paymentFilter === 'pending'
                  ? 'Show all invoices'
                  : 'New invoice'
            }
            onAction={
              listSearch.trim()
                ? undefined
                : paymentFilter === 'pending'
                  ? clearPaymentFilter
                  : openCreateForm
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Date</th>
                  <th>Party</th>
                  <th>City</th>
                  <th>Channel</th>
                  <th className="col-num">Qty</th>
                  <th className="col-num">Subtotal</th>
                  <th className="col-num">GST</th>
                  <th className="col-num">Total Billed</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <p className="list-primary whitespace-nowrap">{sale.invoice_number}</p>
                    </td>
                    <td className="whitespace-nowrap tabular-nums">{sale.invoice_date}</td>
                    <td>
                      <p className="list-primary font-medium text-[14px]">{sale.party_name}</p>
                    </td>
                    <td>
                      {sale.city_name ? (
                        <span className="badge badge-blue">{sale.city_name}</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td>
                      {sale.sale_channel === 'online' ? (
                        <span className="badge badge-blue">{sale.platform || 'Online'}</span>
                      ) : (
                        <span className="badge badge-red">Offline</span>
                      )}
                    </td>
                    <td className="col-num">
                      {Number(sale.total_quantity ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="col-num">₹{Number(sale.subtotal).toLocaleString('en-IN')}</td>
                    <td className="col-num">₹{Number(sale.gst_amount).toLocaleString('en-IN')}</td>
                    <td className="col-num font-semibold text-emerald-600 dark:text-emerald-400">
                      <p>₹{Number(sale.total_amount).toLocaleString('en-IN')}</p>
                      {(sale.payment_status === 'partial' ||
                        (Number(sale.amount_paid) > 0 &&
                          Number(sale.balance_due != null ? sale.balance_due : 0) > 0)) && (
                        <p className="list-secondary font-normal">
                          Recd ₹{Number(sale.amount_paid || 0).toLocaleString('en-IN')}
                        </p>
                      )}
                    </td>
                    <td>
                      <InvoicePaymentStatusBadge sale={sale} />
                    </td>
                    <td className="text-right">
                      <div className="list-actions">
                        <button
                          type="button"
                          onClick={() => openEditInvoice(sale.id)}
                          className="link-action"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => viewInvoiceDetails(sale.id)}
                          className="link-action-muted"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadPDF(sale.id)}
                          className="link-action-muted"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => shareOnWhatsApp(sale.id)}
                          disabled={sharingWhatsAppId === sale.id}
                          className="link-action-muted disabled:opacity-60"
                          title="Share invoice PDF on WhatsApp"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {sharingWhatsAppId === sale.id ? 'Sharing…' : 'WhatsApp'}
                        </button>
                        {(() => {
                          const status = sale.payment_status || paymentStatus(sale);
                          if (status === 'pending' || status === 'partial') {
                            return (
                              <button
                                type="button"
                                onClick={() => openMarkPaid(sale)}
                                className="link-action text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                              >
                                <Banknote className="h-3.5 w-3.5" />
                                Mark as paid
                              </button>
                            );
                          }
                          return null;
                        })()}
                        <button
                          type="button"
                          onClick={() => openDeleteInvoice(sale.id, sale.invoice_number)}
                          className="link-action-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteInvoiceModal
        open={Boolean(deleteTarget)}
        invoiceNumber={deleteTarget?.invoiceNumber}
        onClose={closeDeleteInvoice}
        onConfirm={confirmDeleteInvoice}
        confirming={deletingInvoice}
      />

      <MarkPaidModal
        open={Boolean(markPaidTarget)}
        invoiceNumber={markPaidTarget?.invoiceNumber}
        partyName={markPaidTarget?.partyName}
        amountDue={markPaidTarget?.amountDue}
        onClose={closeMarkPaid}
        onConfirm={confirmMarkPaid}
        confirming={markingPaid}
      />

      <ErrorModal
        open={errorModal.open}
        title={errorModal.title || 'Something went wrong'}
        message={errorModal.message}
        onClose={closeErrorModal}
      />
    </div>
  );
}