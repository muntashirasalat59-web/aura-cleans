const path = require('path');
const fs = require('fs');
const { splitGst } = require('../config/business');
const { formatProductNameWithSize } = require('./productDisplay');
const { formatInr } = require('./pdfInvoice');
const { hasPaymentData, enrichPaymentFields } = require('./salePayment');
const { formatAddress, formatStreetAddress, isConfigured } = require('./businessSettings');
const { invoicePlaceOfSupply, shippingIsSameAsBilling, derivePlaceOfSupply } = require('./placeOfSupply');
const { fetchImageAsset } = require('./imageFetch');

const PAGE_W = 595.28;
const M = 48;
const CONTENT_W = PAGE_W - M * 2;
const RIGHT = M + CONTENT_W;

const C = {
  brand: '#4f46e5',
  brandLight: '#eef2ff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  stripe: '#f8fafc',
  headerBg: '#0f172a',
  total: '#059669',
  white: '#ffffff',
};

const COL = {
  sn: M,
  item: M + 22,
  hsn: M + 168,
  qty: M + 228,
  rate: M + 268,
  gst: M + 328,
  amount: M + 408,
};

const COL_W = {
  sn: 18,
  item: 142,
  hsn: 54,
  qty: 34,
  rate: 54,
  gst: 74,
  amount: RIGHT - (M + 408),
};

const LOGO_PATH = path.join(__dirname, '../assets/logo.png');
const LOGO_BOX_W = 200;
const LOGO_BOX_H = 100;
const CONTINUATION_LOGO_W = 120;
const CONTINUATION_LOGO_H = 52;
const SIGNATURE_PATH = path.join(__dirname, '../assets/signature.png');
const STAMP_PATH = path.join(__dirname, '../assets/stamp.png');
/** Signature asset is wide (733×340) — size by height so it is not crushed in a square fit */
const SIGNATURE_HEIGHT = 72;
const COMPANY_STAMP_SIZE = 90;
const SIGNATORY_BLOCK_H = Math.max(SIGNATURE_HEIGHT, COMPANY_STAMP_SIZE) + 18;
const FOOTER_NOTE = 'Thank you for your business.';
const SETUP_HINT = 'Set up your business details in Settings';
const PDF_PAGE = { size: 'A4', margin: 0 };
const CLOSING_BLOCK_H = SIGNATORY_BLOCK_H + 40;

function formatDisplayDate(iso) {
  if (!iso) return '—';
  const raw = String(iso).trim();
  const isoDay = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) return `${isoDay[3]}/${isoDay[2]}/${isoDay[1]}`;
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function companyInitials(name) {
  return (name || 'AC')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function setFill(doc, color) {
  doc.fillColor(color);
}

function hLine(doc, y, color = C.border, width = 0.5) {
  doc.save();
  doc.strokeColor(color).lineWidth(width).moveTo(M, y).lineTo(RIGHT, y).stroke();
  doc.restore();
}

function drawAccentBar(doc) {
  doc.save();
  setFill(doc, C.brand);
  doc.rect(0, 0, PAGE_W, 5).fill();
  doc.restore();
}

function openLogoImage(doc, business, asset) {
  const buffer = asset && asset.kind !== 'svg' ? asset.buffer : null;
  if (buffer) {
    try {
      return doc.openImage(buffer);
    } catch (err) {
      console.warn('[invoice-pdf] could not open Business Settings logo', err.message);
    }
  }

  const hasRemoteLogo = Boolean(String(business?.logo_url || '').trim());
  if (hasRemoteLogo) return null;

  if (fs.existsSync(LOGO_PATH)) {
    try {
      return doc.openImage(LOGO_PATH);
    } catch (err) {
      console.warn('[invoice-pdf] could not open bundled logo', err.message);
    }
  }
  return null;
}

function tryDrawSvgLogo(doc, x, y, boxW, boxH, svgBuffer) {
  let SVGtoPDF;
  try {
    SVGtoPDF = require('svg-to-pdfkit');
  } catch {
    return false;
  }
  try {
    const svg = svgBuffer.toString('utf8');
    SVGtoPDF(doc, svg, x, y, {
      width: boxW,
      height: boxH,
      preserveAspectRatio: 'xMinYMid meet',
      assumePt: true,
    });
    return true;
  } catch (err) {
    console.warn('[invoice-pdf] could not draw SVG logo', err.message);
    return false;
  }
}

function drawContainedRaster(doc, img, x, y, boxW, boxH) {
  doc.image(img, x, y, {
    fit: [boxW, boxH],
    align: 'left',
    valign: 'center',
  });
}

function drawBrandLogo(doc, x, y, business, asset) {
  if (asset?.kind === 'svg' && tryDrawSvgLogo(doc, x, y, LOGO_BOX_W, LOGO_BOX_H, asset.buffer)) {
    return { height: LOGO_BOX_H, width: LOGO_BOX_W, stacked: true };
  }

  const img = openLogoImage(doc, business, asset);
  if (img) {
    drawContainedRaster(doc, img, x, y, LOGO_BOX_W, LOGO_BOX_H);
    return { height: LOGO_BOX_H, width: LOGO_BOX_W, stacked: true };
  }
  drawLogoPlaceholder(doc, x, y, business);
  return { height: LOGO_BOX_H, width: 52, stacked: false };
}

function drawLogoPlaceholder(doc, x, y, business) {
  const size = 46;
  const name = business?.company_name || 'AC';
  doc.save();
  setFill(doc, C.brand);
  doc.roundedRect(x, y, size, size, 10).fill();
  setFill(doc, C.white);
  doc.font('InvoiceBold').fontSize(15).text(companyInitials(name), x, y + 14, {
    width: size,
    align: 'center',
  });
  doc.restore();
}

const META_DETAIL_SIZE = 8;
const META_DETAIL_LINE = 11;
const META_DETAIL_GAP = 6;
const HEADER_DIVIDER_GAP = 16;

function drawDetailMetaLine(doc, text, x, y, maxWidth) {
  doc.font('InvoiceRegular').fontSize(META_DETAIL_SIZE).fillColor(C.muted);
  doc.text(text, x, y, { width: maxWidth, lineGap: 0 });
  const lineBottom = Math.max(doc.y, y + META_DETAIL_LINE);
  return lineBottom + META_DETAIL_GAP;
}

function drawCompanyMeta(doc, x, startY, maxWidth, business) {
  let y = startY;

  if (!isConfigured(business)) {
    return drawDetailMetaLine(doc, SETUP_HINT, x, y, maxWidth);
  }

  const legalName = String(business.company_name || '').trim();
  if (legalName) {
    doc.font('InvoiceBold').fontSize(13).fillColor(C.text);
    doc.text(legalName.toUpperCase(), x, y, { width: maxWidth, lineGap: 1 });
    y = Math.max(doc.y, y + 16) + 5;
  }

  const address = formatStreetAddress(business) || business.address_display || formatAddress(business);
  if (address) {
    y = drawDetailMetaLine(doc, address, x, y, maxWidth);
  }

  const phone = String(business.phone || '').trim();
  if (phone) {
    y = drawDetailMetaLine(doc, `Phone: ${phone}`, x, y, maxWidth);
  }

  const gstin = String(business.gstin || '').trim();
  if (gstin) {
    y = drawDetailMetaLine(doc, `GSTIN: ${gstin}`, x, y, maxWidth);
  }

  const state =
    String(business.state || '').trim() ||
    derivePlaceOfSupply({ gst_number: gstin, address: business.address_display || formatAddress(business) });
  if (state) {
    y = drawDetailMetaLine(doc, `State: ${state}`, x, y, maxWidth);
  }

  return y;
}

function drawHeader(doc, sale, business, logoAsset) {
  drawAccentBar(doc);

  const topY = M + 8;
  const logo = drawBrandLogo(doc, M, topY, business, logoAsset);
  const metaW = 220;
  const metaX = RIGHT - metaW;
  const detailsX = logo.stacked ? M : M + logo.width + 10;
  const detailsY = logo.stacked ? topY + logo.height + 14 : topY + 2;
  const metaWidth = Math.max(180, metaX - detailsX - 12);

  const leftBottom = drawCompanyMeta(doc, detailsX, detailsY, metaWidth, business);
  doc.font('InvoiceBold').fontSize(20).fillColor(C.text).text('TAX INVOICE', metaX, topY, {
    width: metaW,
    align: 'right',
  });

  const metaRows = [
    ['Invoice No.:', sale.invoice_number || '—'],
    ['Date:', formatDisplayDate(sale.invoice_date)],
    ['Place of Supply:', invoicePlaceOfSupply(sale, business)],
  ];
  let metaY = topY + 30;
  for (const [label, value] of metaRows) {
    doc.font('InvoiceRegular').fontSize(8).fillColor(C.muted).text(label, metaX, metaY, {
      width: 88,
      lineGap: 0,
    });
    doc.font('InvoiceBold').fontSize(8).fillColor(C.text).text(value, metaX + 88, metaY, {
      width: metaW - 88,
      align: 'right',
      lineGap: 0,
    });
    metaY += 13;
  }
  const rightBottom = metaY;

  const contentBottom = Math.max(leftBottom, rightBottom, topY + logo.height);
  const dividerY = contentBottom + HEADER_DIVIDER_GAP;
  hLine(doc, dividerY, C.text, 0.75);

  return dividerY + 20;
}

function drawSectionLabel(doc, label, x, y) {
  doc.font('InvoiceBold').fontSize(7).fillColor(C.muted).text(label.toUpperCase(), x, y, {
    characterSpacing: 0.8,
  });
}

function partyCardLines(sale, { shipping = false } = {}) {
  if (shipping) {
    if (shippingIsSameAsBilling(sale.shipping_address, sale.address)) {
      return [{ text: 'Same as billing' }];
    }
    return [{ text: sale.shipping_address }];
  }
  const lines = [];
  lines.push({ bold: true, size: 11, color: C.text, text: sale.party_name || '—' });
  if (sale.contact) lines.push({ text: `Contact: ${sale.contact}` });
  if (sale.address) lines.push({ text: sale.address });
  if (sale.gst_number) lines.push({ text: `GSTIN: ${sale.gst_number}` });
  return lines;
}

function drawPartyCard(doc, label, lines, cardX, startY, cardW) {
  const pad = 12;
  const labelH = 10;
  const contentH = lines.reduce((acc, line) => acc + (line.bold ? 16 : 14), 0);
  const cardH = pad + labelH + 8 + contentH + pad;

  doc.save();
  doc.roundedRect(cardX, startY, cardW, cardH, 8).fill(C.brandLight);
  doc.roundedRect(cardX, startY, cardW, cardH, 8).lineWidth(0.75).strokeColor(C.border).stroke();
  doc.restore();

  drawSectionLabel(doc, label, cardX + pad, startY + pad);

  let y = startY + pad + labelH + 8;
  for (const line of lines) {
    if (line.bold) {
      doc.font('InvoiceBold').fontSize(line.size || 11).fillColor(line.color || C.text);
    } else {
      doc.font('InvoiceRegular').fontSize(9).fillColor(C.muted);
    }
    doc.text(line.text, cardX + pad, y, { width: cardW - pad * 2, lineGap: 1 });
    y = doc.y + 4;
  }

  return cardH;
}

function drawBillToCard(doc, sale, startY) {
  const gap = 12;
  const cardW = (CONTENT_W - gap) / 2;
  const billH = drawPartyCard(doc, 'Bill To', partyCardLines(sale), M, startY, cardW);
  const shipH = drawPartyCard(
    doc,
    'Ship To',
    partyCardLines(sale, { shipping: true }),
    M + cardW + gap,
    startY,
    cardW
  );
  return startY + Math.max(billH, shipH) + 16;
}

function drawTableHeader(doc, y) {
  const h = 26;
  doc.save();
  setFill(doc, C.headerBg);
  doc.rect(M, y, CONTENT_W, h).fill();
  doc.restore();

  const ty = y + 8;
  doc.font('InvoiceBold').fontSize(7).fillColor(C.white);
  doc.text('#', COL.sn, ty, { width: COL_W.sn });
  doc.text('ITEM NAME', COL.item, ty, { width: COL_W.item });
  doc.text('HSN/SAC', COL.hsn, ty, { width: COL_W.hsn });
  doc.text('QTY', COL.qty, ty, { width: COL_W.qty, align: 'right' });
  doc.text('PRICE/UNIT', COL.rate, ty, { width: COL_W.rate, align: 'right' });
  doc.text('GST', COL.gst, ty, { width: COL_W.gst, align: 'right' });
  doc.text('AMT (EXCL.)', COL.amount, ty, { width: COL_W.amount, align: 'right' });

  return y + h;
}

function drawTableRow(doc, item, lineNum, gstRate, y, stripe) {
  const rowH = 22;
  if (stripe) {
    doc.save();
    setFill(doc, C.stripe);
    doc.rect(M, y, CONTENT_W, rowH).fill();
    doc.restore();
  }

  const taxable = Number(item.quantity) * Number(item.rate);
  const lineGst = (taxable * gstRate) / 100;
  const hsn = item.hsn_sac || '—';
  const itemName = formatProductNameWithSize(
    {
      name: item.product_name,
      unit_size: item.unit_size,
      unit_type: item.unit_type,
    },
    'inline'
  );

  const ty = y + 6;
  doc.font('InvoiceRegular').fontSize(8).fillColor(C.text);
  doc.text(String(lineNum), COL.sn, ty, { width: COL_W.sn });
  doc.text(itemName, COL.item, ty, { width: COL_W.item, lineGap: 0 });
  doc.fillColor(C.muted).text(hsn, COL.hsn, ty, { width: COL_W.hsn });
  doc.fillColor(C.text).text(String(item.quantity), COL.qty, ty, { width: COL_W.qty, align: 'right' });
  doc.text(formatInr(item.rate), COL.rate, ty, { width: COL_W.rate, align: 'right' });
  doc.text(`${formatInr(lineGst)} (${gstRate.toFixed(1)}%)`, COL.gst, ty, {
    width: COL_W.gst,
    align: 'right',
  });
  doc.font('InvoiceBold').text(formatInr(taxable), COL.amount, ty, { width: COL_W.amount, align: 'right' });

  doc.save();
  doc.strokeColor(C.border).lineWidth(0.25).moveTo(M, y + rowH).lineTo(RIGHT, y + rowH).stroke();
  doc.restore();

  return y + rowH;
}

function drawSummaryCard(doc, sale, startY) {
  const { cgstRate, sgstRate, cgstAmount, sgstAmount } = splitGst(sale.gst_percent, sale.gst_amount);
  const payment = enrichPaymentFields(sale);
  const isPartial = payment.payment_status === 'partial';
  const cardW = 228;
  const cardX = RIGHT - cardW;
  const pad = 16;
  const rowH = 18;
  const totalBlockH = 36;
  const extraH = isPartial ? rowH + totalBlockH : 0;
  const cardH = pad + rowH * 5 + totalBlockH + extraH + pad;

  doc.save();
  doc.roundedRect(cardX, startY, cardW, cardH, 8).fill(C.white);
  doc.roundedRect(cardX, startY, cardW, cardH, 8).lineWidth(0.75).strokeColor(C.border).stroke();
  doc.restore();

  drawSectionLabel(doc, 'Summary', cardX + pad, startY + pad);

  const rows = [
    ['Subtotal', formatInr(sale.subtotal)],
    [`CGST (${cgstRate}%)`, formatInr(cgstAmount)],
    [`SGST (${sgstRate}%)`, formatInr(sgstAmount)],
    [`Total GST (${sale.gst_percent}%)`, formatInr(sale.gst_amount)],
  ];

  let y = startY + pad + 14;
  doc.font('InvoiceRegular').fontSize(9).fillColor(C.muted);
  for (const [label, value] of rows) {
    doc.text(label, cardX + pad, y, { width: cardW / 2, continued: false });
    doc.text(value, cardX + pad, y, { width: cardW - pad * 2, align: 'right' });
    y += rowH;
  }

  const totalY = y + 6;
  doc.save();
  setFill(doc, '#ecfdf5');
  doc.roundedRect(cardX + pad, totalY, cardW - pad * 2, totalBlockH - 4, 6).fill();
  doc.restore();

  const billedLabel = isPartial ? 'Total Billed' : 'Total payable';
  doc.font('InvoiceBold').fontSize(10).fillColor(C.text).text(billedLabel, cardX + pad + 8, totalY + 8);
  doc.font('InvoiceBold').fontSize(13).fillColor(C.total).text(formatInr(sale.total_amount), cardX + pad, totalY + 6, {
    width: cardW - pad * 2 - 8,
    align: 'right',
  });

  if (isPartial) {
    const receivedY = totalY + totalBlockH;
    doc.font('InvoiceRegular').fontSize(9).fillColor(C.muted);
    doc.text('Amount Received', cardX + pad, receivedY, { width: cardW / 2, continued: false });
    doc.text(formatInr(payment.amount_paid), cardX + pad, receivedY, {
      width: cardW - pad * 2,
      align: 'right',
    });

    const dueY = receivedY + rowH + 2;
    doc.save();
    setFill(doc, '#fffbeb');
    doc.roundedRect(cardX + pad, dueY, cardW - pad * 2, totalBlockH - 4, 6).fill();
    doc.restore();
    doc.font('InvoiceBold').fontSize(10).fillColor(C.text).text('Balance Due', cardX + pad + 8, dueY + 8);
    doc
      .font('InvoiceBold')
      .fontSize(13)
      .fillColor('#b45309')
      .text(formatInr(payment.balance_due), cardX + pad, dueY + 6, {
        width: cardW - pad * 2 - 8,
        align: 'right',
      });
  }

  return startY + cardH;
}

function drawPaymentDetailsCard(doc, sale, startY, business) {
  const bankName = sale.payment_bank_name || business?.bank_name || '';
  const account = sale.payment_account_number || business?.bank_account_number || '';
  const upi = sale.payment_upi || business?.upi_id || '';
  const hasBank = Boolean(bankName || account || upi);
  const hasSalePayment = hasPaymentData(sale);

  if (!hasBank && !hasSalePayment) return startY;

  const cardX = M;
  const cardW = CONTENT_W * 0.52;
  const pad = 14;
  const lines = [];

  if (bankName) lines.push({ label: 'Bank', value: bankName });
  if (account) lines.push({ label: 'Account', value: account });
  if (upi) lines.push({ label: 'UPI', value: upi });
  if (sale.payment_due_date) {
    lines.push({ label: 'Due date', value: formatDisplayDate(sale.payment_due_date) });
  }

  if (!lines.length && !sale.payment_terms) return startY;

  const termsH = sale.payment_terms ? 28 : 0;
  const cardH = pad + 12 + Math.max(lines.length, 1) * 15 + termsH + pad;

  doc.save();
  doc.roundedRect(cardX, startY, cardW, cardH, 8).fill(C.brandLight);
  doc.roundedRect(cardX, startY, cardW, cardH, 8).lineWidth(0.75).strokeColor(C.border).stroke();
  doc.restore();

  drawSectionLabel(doc, 'Payment details', cardX + pad, startY + pad);

  let y = startY + pad + 14;
  doc.font('InvoiceRegular').fontSize(8.5).fillColor(C.text);
  for (const line of lines) {
    doc.font('InvoiceBold').text(`${line.label}: `, cardX + pad, y, { continued: true, width: cardW - pad * 2 });
    doc.font('InvoiceRegular').text(line.value);
    y += 15;
  }

  if (sale.payment_terms) {
    doc.font('InvoiceRegular').fontSize(7.5).fillColor(C.muted).text(sale.payment_terms, cardX + pad, y + 2, {
      width: cardW - pad * 2,
      lineGap: 1,
    });
  }

  return startY + cardH;
}

function drawSignatoryBlock(doc, startY) {
  const hasSignature = fs.existsSync(SIGNATURE_PATH);
  const hasStamp = fs.existsSync(STAMP_PATH);
  const blockH = SIGNATORY_BLOCK_H;
  const blockY = startY;
  const blockW = 200;
  const blockX = RIGHT - blockW;

  if (hasStamp) {
    const stampX = RIGHT - COMPANY_STAMP_SIZE;
    const stampY = blockY + Math.max(0, SIGNATURE_HEIGHT - COMPANY_STAMP_SIZE + 8);
    doc.image(STAMP_PATH, stampX, stampY, {
      fit: [COMPANY_STAMP_SIZE, COMPANY_STAMP_SIZE],
      align: 'right',
      valign: 'bottom',
    });
  }

  if (hasSignature) {
    const sigImg = doc.openImage(SIGNATURE_PATH);
    const sigH = SIGNATURE_HEIGHT;
    const sigW = sigImg.height ? (sigImg.width / sigImg.height) * sigH : sigH * 2.15;
    const sigX = RIGHT - sigW - (hasStamp ? COMPANY_STAMP_SIZE * 0.35 : 0);
    const sigY = blockY + Math.max(0, Math.max(SIGNATURE_HEIGHT, hasStamp ? COMPANY_STAMP_SIZE : 0) - sigH);
    doc.image(sigImg, sigX, sigY, { height: sigH });
    doc.image(sigImg, sigX - 0.35, sigY, { height: sigH });
  }

  doc
    .font('InvoiceRegular')
    .fontSize(7)
    .fillColor(C.muted)
    .text('Authorized Signatory', blockX, blockY + blockH - 12, {
      width: blockW,
      align: 'right',
    });

  return startY + blockH;
}

function drawThankYouNote(doc, startY) {
  hLine(doc, startY, C.border, 0.5);
  doc.font('InvoiceBold').fontSize(9).fillColor(C.text).text(FOOTER_NOTE, M, startY + 10, {
    width: CONTENT_W,
    align: 'center',
  });
  return startY + 28;
}

function drawClosingAfterContent(doc, startY) {
  const y = drawSignatoryBlock(doc, startY);
  return drawThankYouNote(doc, y + 6);
}

function drawContinuationHeader(doc, business, logoAsset) {
  drawAccentBar(doc);
  const topY = M;
  if (logoAsset?.kind === 'svg' && tryDrawSvgLogo(doc, M, topY, CONTINUATION_LOGO_W, CONTINUATION_LOGO_H, logoAsset.buffer)) {
    const name = String(business?.company_name || '').trim();
    if (name) {
      doc.font('InvoiceBold').fontSize(9).fillColor(C.text).text(name.toUpperCase(), M + CONTINUATION_LOGO_W + 8, topY + 16, {
        width: CONTENT_W - CONTINUATION_LOGO_W - 8,
      });
    }
  } else {
    const img = openLogoImage(doc, business, logoAsset);
    let x = M;
    if (img) {
      drawContainedRaster(doc, img, x, topY, CONTINUATION_LOGO_W, CONTINUATION_LOGO_H);
      x += CONTINUATION_LOGO_W + 8;
    } else {
      drawLogoPlaceholder(doc, x, topY, business);
      x += 54;
    }
    const name = String(business?.company_name || '').trim();
    if (name) {
      doc.font('InvoiceBold').fontSize(9).fillColor(C.text).text(name.toUpperCase(), x, topY + 16, {
        width: CONTENT_W - (x - M),
      });
    }
  }
  const bottom = topY + CONTINUATION_LOGO_H + 10;
  hLine(doc, bottom, C.text, 0.5);
  return bottom + 14;
}

function pageBottom(doc) {
  return doc.page.height - 36;
}

function ensureLineItemSpace(doc, y, needed, ctx) {
  if (y + needed <= pageBottom(doc)) return y;
  doc.addPage();
  doc.font('InvoiceRegular');
  const nextY = drawContinuationHeader(doc, ctx.business, ctx.logoAsset);
  return drawTableHeader(doc, nextY);
}

function ensureBlockSpace(doc, y, needed, ctx) {
  if (y + needed <= pageBottom(doc)) return y;
  doc.addPage();
  doc.font('InvoiceRegular');
  return drawContinuationHeader(doc, ctx.business, ctx.logoAsset);
}

/** Render a premium tax invoice PDF into an open PDFKit document. */
async function renderPremiumInvoicePdf(doc, sale, business = null) {
  const logoAsset = await fetchImageAsset(business?.logo_url);
  const ctx = { sale, business, logoAsset };

  doc.font('InvoiceRegular');

  let y = drawHeader(doc, sale, business, logoAsset);
  y = drawBillToCard(doc, sale, y);

  drawSectionLabel(doc, 'Line Items', M, y - 4);
  y += 10;
  y = drawTableHeader(doc, y);

  const gstRate = Number(sale.gst_percent) || 0;
  let lineNum = 1;
  for (const item of sale.items || []) {
    y = ensureLineItemSpace(doc, y, 24, ctx);
    y = drawTableRow(doc, item, lineNum, gstRate, y, lineNum % 2 === 0);
    lineNum += 1;
  }

  y += 10;
  y = ensureBlockSpace(doc, y, 24, ctx);
  doc.font('InvoiceRegular').fontSize(7).fillColor(C.muted).text(
    'Amounts exclude GST; invoice total includes CGST/SGST in the summary.',
    M,
    y
  );
  y = doc.y + 12;

  const payment = enrichPaymentFields(sale);
  const approxSummaryH = payment.payment_status === 'partial' ? 220 : 170;
  y = ensureBlockSpace(doc, y, approxSummaryH, ctx);

  const summaryTop = y;
  y = drawSummaryCard(doc, sale, summaryTop);
  const paymentEnd = drawPaymentDetailsCard(doc, sale, summaryTop, business);
  y = Math.max(y, paymentEnd) + 12;

  y = ensureBlockSpace(doc, y, CLOSING_BLOCK_H, ctx);
  drawClosingAfterContent(doc, y);
}

module.exports = { renderPremiumInvoicePdf, C, M, PAGE_W, PDF_PAGE };
