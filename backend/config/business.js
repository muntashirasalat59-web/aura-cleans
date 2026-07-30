const BUSINESS = {
  name: 'InvoStack',
  tagline: 'Invoice & Inventory Management',
  address: 'Your Business Address Line, City, State — PIN',
  gstin: '29XXXXX0000X1ZX',
  phone: '+91 XXXXX XXXXX',
};

function splitGst(gstPercent, gstAmount) {
  const rate = Number(gstPercent) || 0;
  const amount = Number(gstAmount) || 0;
  return {
    cgstRate: rate / 2,
    sgstRate: rate / 2,
    cgstAmount: amount / 2,
    sgstAmount: amount / 2,
  };
}

module.exports = { BUSINESS, splitGst };
