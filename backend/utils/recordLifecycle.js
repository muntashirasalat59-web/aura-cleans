const FK_CODE = '23503';

function isFkViolation(error) {
  if (!error) return false;
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  return code === FK_CODE || msg.includes('foreign key constraint');
}

async function countPartyLinks(supabase, partyId) {
  const [salesRes, purchasesRes] = await Promise.all([
    supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('party_id', partyId)
      .eq('is_deleted', false),
    supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('party_id', partyId),
  ]);

  return {
    sales: salesRes.count || 0,
    purchases: purchasesRes.count || 0,
  };
}

async function countProductLinks(supabase, productId) {
  const [saleItemsRes, purchaseItemsRes] = await Promise.all([
    supabase.from('sale_items').select('id', { count: 'exact', head: true }).eq('product_id', productId),
    supabase
      .from('purchase_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId),
  ]);

  return {
    saleItems: saleItemsRes.count || 0,
    purchaseItems: purchaseItemsRes.count || 0,
  };
}

async function countEmployeeLinks(supabase, employeeId) {
  const { count } = await supabase
    .from('salary_payments')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', employeeId);

  return { salaryPayments: count || 0 };
}

function hasPartyLinks(counts) {
  return counts.sales > 0 || counts.purchases > 0;
}

function hasProductLinks(counts) {
  return counts.saleItems > 0 || counts.purchaseItems > 0;
}

function partyDeleteBlockedMessage(counts) {
  const parts = [];
  if (counts.sales > 0) parts.push(`${counts.sales} invoice(s)`);
  if (counts.purchases > 0) parts.push(`${counts.purchases} purchase(s)`);
  const linked = parts.join(' and ');
  return `This party cannot be deleted because ${linked} are linked to it. Delete those records first, or deactivate this party to keep history safe.`;
}

function productDeleteBlockedMessage(counts) {
  const saleItems = counts.saleItems || 0;
  if (saleItems > 0) {
    return `This product cannot be deleted because ${saleItems} sale line item(s) are linked to it. Deactivate this product instead to hide it from new invoices while keeping past records.`;
  }
  const parts = [];
  if (counts.purchaseItems > 0) parts.push(`${counts.purchaseItems} purchase line item(s)`);
  const linked = parts.join(' and ') || 'linked records';
  return `This product cannot be deleted because ${linked} are linked to it. Deactivate this product instead to hide it from new invoices while keeping past records.`;
}

function employeeDeleteBlockedMessage(counts) {
  if (counts.salaryPayments > 0) {
    return `This employee cannot be deleted because ${counts.salaryPayments} salary payment record(s) exist. Set status to Inactive instead to preserve payroll history.`;
  }
  return null;
}

function genericFkMessage(entityLabel) {
  return `This ${entityLabel} cannot be deleted because other records still reference it. Deactivate or archive it instead, or remove linked records first.`;
}

module.exports = {
  isFkViolation,
  countPartyLinks,
  countProductLinks,
  countEmployeeLinks,
  hasPartyLinks,
  hasProductLinks,
  partyDeleteBlockedMessage,
  productDeleteBlockedMessage,
  employeeDeleteBlockedMessage,
  genericFkMessage,
};
