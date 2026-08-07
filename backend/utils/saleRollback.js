const { supabase, assertNoError } = require('../database/supabase');

/** Undo a failed create (restores stock + hard-deletes draft row). Not used for UI delete. */
async function rollbackSale(saleId) {
  if (!saleId) return;
  const { error } = await supabase.rpc('hard_delete_sale', { p_sale_id: Number(saleId) });
  if (error) {
    const legacy = await supabase.rpc('delete_sale', { p_sale_id: Number(saleId) });
    if (legacy.error) {
      console.error('[sales] rollback failed for sale', saleId, legacy.error.message);
      throw new Error(
        `Invoice was not saved completely, and automatic rollback failed: ${legacy.error.message}`
      );
    }
    return;
  }
}

module.exports = { rollbackSale };
