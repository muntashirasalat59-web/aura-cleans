/**
 * Shared low-stock threshold for the dashboard banner and "Low stock items" KPI.
 * Change this once — keep frontend + backend dashboard.js in sync.
 */
export const LOW_STOCK_THRESHOLD = 50;

/** @deprecated Use LOW_STOCK_THRESHOLD — kept as alias for existing imports */
export const STOCK_ALERT_THRESHOLD = LOW_STOCK_THRESHOLD;

export const STOCK_ALERT_DISMISS_KEY = 'dashboard-stock-alert-dismissed';
