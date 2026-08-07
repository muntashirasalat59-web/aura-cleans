function formatSaleDeleteMessage(result) {
  const restored = result?.restored || [];
  const skipped = result?.skipped || [];

  let message = 'Invoice deleted.';
  if (restored.length > 0) {
    const details = restored
      .map((row) => `${row.product_name} +${row.quantity} restored`)
      .join('; ');
    message += ` Stock has been updated: ${details}.`;
  } else {
    message += ' No stock was restored.';
  }
  if (skipped.length > 0) {
    message += ` ${skipped.length} line item(s) skipped (product no longer exists).`;
  }
  return message;
}

function formatPurchaseDeleteMessage(result) {
  const reversed = result?.reversed || [];
  const skipped = result?.skipped || [];

  let message = 'Purchase deleted.';
  if (reversed.length > 0) {
    const details = reversed
      .map((row) => `${row.product_name} −${row.quantity} removed from stock`)
      .join('; ');
    message += ` Stock has been updated: ${details}.`;
  } else {
    message += ' No stock changes applied.';
  }
  if (skipped.length > 0) {
    message += ` ${skipped.length} line item(s) skipped (product no longer exists).`;
  }
  return message;
}

module.exports = { formatSaleDeleteMessage, formatPurchaseDeleteMessage };
