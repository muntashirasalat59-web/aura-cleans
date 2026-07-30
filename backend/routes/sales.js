const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { supabase, assertNoError } = require('../database/supabase');
const { BUSINESS, splitGst } = require('../config/business');
const { formatProductNameWithSize } = require('../utils/productDisplay');

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const { data, error } = await supabase
    .from('sales')
    .select('invoice_number')
    .like('invoice_number', `${prefix}%`)
    .order('id', { ascending: false })
    .limit(1);

  assertNoError(error);

  let nextNum = 1;
  if (data && data.length > 0) {
    const parts = data[0].invoice_number.split('-');
    nextNum = parseInt(parts[2], 10) + 1;
  }

  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

function mapSaleRow(row) {
  const party = row.parties;
  const { parties, ...rest } = row;
  return {
    ...rest,
    party_name: party?.name,
    party_type: party?.type,
    contact: party?.contact,
    address: party?.address,
    gst_number: party?.gst_number,
  };
}

async function fetchSaleWithItems(saleId) {
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('*, parties(name, type, contact, address, gst_number)')
    .eq('id', saleId)
    .single();

  assertNoError(saleError);

  const { data: items, error: itemsError } = await supabase
    .from('sale_items')
    .select('*, products(name, hsn_sac, unit_size, unit_type)')
    .eq('sale_id', saleId);

  assertNoError(itemsError);

  const mapped = mapSaleRow(sale);
  mapped.items = (items || []).map((row) => ({
    ...row,
    product_name: row.products?.name,
    hsn_sac: row.products?.hsn_sac || '',
    unit_size: row.products?.unit_size,
    unit_type: row.products?.unit_type,
    products: undefined,
  }));

  return mapped;
}

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('*, parties(name, type)')
      .order('invoice_date', { ascending: false });

    assertNoError(error);
    res.json((data || []).map(mapSaleRow));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const sale = await fetchSaleWithItems(req.params.id);

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${sale.invoice_number}.pdf"`);

    doc.pipe(res);

    doc.fontSize(16).text(BUSINESS.name, { align: 'left' });
    doc.fontSize(9).text(BUSINESS.tagline);
    doc.fontSize(9).text(BUSINESS.address);
    doc.text(`GSTIN: ${BUSINESS.gstin}`);
    if (BUSINESS.phone) doc.text(BUSINESS.phone);
    doc.moveDown();

    doc.fontSize(20).text('TAX INVOICE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice No: ${sale.invoice_number}`);
    doc.text(`Date: ${sale.invoice_date}`);
    doc.moveDown();

    doc.fontSize(14).text('Bill To:');
    doc.fontSize(11).text(`Name: ${sale.party_name}`);
    if (sale.contact) doc.text(`Contact: ${sale.contact}`);
    if (sale.address) doc.text(`Address: ${sale.address}`);
    if (sale.gst_number) doc.text(`GST No: ${sale.gst_number}`);
    doc.moveDown();

    const col = {
      sn: 45,
      item: 62,
      hsn: 200,
      qty: 268,
      rate: 310,
      gst: 365,
      amount: 460,
    };
    const tableTop = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('#', col.sn, tableTop, { width: 14 });
    doc.text('Item Name', col.item, tableTop, { width: 130 });
    doc.text('HSN/SAC', col.hsn, tableTop, { width: 60 });
    doc.text('Qty', col.qty, tableTop, { width: 35, align: 'right' });
    doc.text('Price/Unit', col.rate, tableTop, { width: 50, align: 'right' });
    doc.text('GST', col.gst, tableTop, { width: 88, align: 'right' });
    doc.text('Amt (excl.)', col.amount, tableTop, { width: 85, align: 'right' });
    doc.font('Helvetica');
    doc.moveTo(45, tableTop + 14).lineTo(555, tableTop + 14).stroke();

    let y = tableTop + 22;
    const gstRate = Number(sale.gst_percent) || 0;
    let lineNum = 1;
    for (const item of sale.items) {
      const taxable = Number(item.quantity) * Number(item.rate);
      const lineGst = (taxable * gstRate) / 100;
      const hsn = item.hsn_sac || '—';

      doc.fontSize(8);
      doc.text(String(lineNum), col.sn, y, { width: 14 });
      doc.text(
        formatProductNameWithSize(
          {
            name: item.product_name,
            unit_size: item.unit_size,
            unit_type: item.unit_type,
          },
          'inline'
        ),
        col.item,
        y,
        { width: 130 }
      );
      doc.text(hsn, col.hsn, y, { width: 60 });
      doc.text(String(item.quantity), col.qty, y, { width: 35, align: 'right' });
      doc.text(`₹${Number(item.rate).toFixed(2)}`, col.rate, y, { width: 50, align: 'right' });
      doc.text(`₹${lineGst.toFixed(2)} (${gstRate.toFixed(1)}%)`, col.gst, y, {
        width: 88,
        align: 'right',
      });
      doc.text(`₹${taxable.toFixed(2)}`, col.amount, y, { width: 85, align: 'right' });
      y += 18;
      lineNum += 1;
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
    }

    doc.fontSize(7).fillColor('#64748b').text('Amounts exclude GST; total GST in summary below.', 45, y + 4);
    doc.fillColor('#000000');

    doc.moveDown(2);
    y = Math.max(doc.y, y + 20);

    const { cgstRate, sgstRate, cgstAmount, sgstAmount } = splitGst(sale.gst_percent, sale.gst_amount);

    doc.text(`Subtotal: ₹${Number(sale.subtotal).toFixed(2)}`, 350, y);
    doc.text(`CGST (${cgstRate}%): ₹${cgstAmount.toFixed(2)}`, 350, y + 18);
    doc.text(`SGST (${sgstRate}%): ₹${sgstAmount.toFixed(2)}`, 350, y + 36);
    doc.text(`Total GST (${sale.gst_percent}%): ₹${Number(sale.gst_amount).toFixed(2)}`, 350, y + 54);
    doc.fontSize(14).text(`Total payable: ₹${Number(sale.total_amount).toFixed(2)}`, 350, y + 78);

    doc.end();
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const sale = await fetchSaleWithItems(req.params.id);
    res.json(sale);
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { party_id, invoice_date, gst_percent, items } = req.body;

    if (!party_id || !invoice_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'Party, date and items are required' });
    }

    const gstRate = gst_percent || 18;
    const invoiceNumber = await generateInvoiceNumber();

    const { data: saleId, error } = await supabase.rpc('create_sale', {
      p_party_id: party_id,
      p_invoice_number: invoiceNumber,
      p_invoice_date: invoice_date,
      p_gst_percent: gstRate,
      p_items: items,
    });

    assertNoError(error);

    const sale = await fetchSaleWithItems(saleId);
    res.status(201).json(sale);
  } catch (error) {
    const message = error.message || 'Failed to create sale';
    if (message.includes('Not enough stock') || message.includes('Insufficient stock') || message.includes('not found')) {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { party_id, invoice_date, gst_percent, items } = req.body;

    if (!party_id || !invoice_date || !items || items.length === 0) {
      return res.status(400).json({ error: 'Party, date and items are required' });
    }

    const gstRate = gst_percent ?? 18;

    const { data: saleId, error } = await supabase.rpc('update_sale', {
      p_sale_id: Number(id),
      p_party_id: party_id,
      p_invoice_date: invoice_date,
      p_gst_percent: gstRate,
      p_items: items,
    });

    assertNoError(error);

    const sale = await fetchSaleWithItems(saleId);
    res.json(sale);
  } catch (error) {
    const message = error.message || 'Failed to update sale';
    if (
      message.includes('Not enough stock') ||
      message.includes('not found') ||
      message.includes('Sale not found')
    ) {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

module.exports = router;
