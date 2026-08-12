/** Executive Dashboard widget ids + default react-grid-layout configs. */

export const DASHBOARD_WIDGETS = [
  { id: 'kpi', label: 'Stat Cards' },
  { id: 'revenue', label: 'Revenue Overview' },
  { id: 'business', label: 'Business Summary' },
  { id: 'quick', label: 'Quick Actions' },
  { id: 'inventory', label: 'Inventory Overview' },
  { id: 'orders', label: 'Recent Orders' },
  { id: 'topselling', label: 'Top Selling Products' },
];

export const DASHBOARD_BREAKPOINTS = { lg: 1200, md: 768, sm: 0 };
export const DASHBOARD_COLS = { lg: 12, md: 10, sm: 6 };
export const DASHBOARD_ROW_HEIGHT = 36;

const LG = [
  { i: 'kpi', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2 },
  { i: 'revenue', x: 0, y: 3, w: 7, h: 9, minW: 4, minH: 6 },
  { i: 'business', x: 7, y: 3, w: 3, h: 9, minW: 2, minH: 6 },
  { i: 'quick', x: 10, y: 3, w: 2, h: 9, minW: 2, minH: 5 },
  { i: 'inventory', x: 0, y: 12, w: 4, h: 8, minW: 3, minH: 5 },
  { i: 'orders', x: 4, y: 12, w: 4, h: 8, minW: 3, minH: 5 },
  { i: 'topselling', x: 8, y: 12, w: 4, h: 8, minW: 3, minH: 5 },
];

const MD = [
  { i: 'kpi', x: 0, y: 0, w: 10, h: 4, minW: 5, minH: 2 },
  { i: 'revenue', x: 0, y: 4, w: 10, h: 9, minW: 4, minH: 6 },
  { i: 'business', x: 0, y: 13, w: 5, h: 8, minW: 3, minH: 6 },
  { i: 'quick', x: 5, y: 13, w: 5, h: 8, minW: 3, minH: 5 },
  { i: 'inventory', x: 0, y: 21, w: 10, h: 8, minW: 4, minH: 5 },
  { i: 'orders', x: 0, y: 29, w: 5, h: 8, minW: 3, minH: 5 },
  { i: 'topselling', x: 5, y: 29, w: 5, h: 8, minW: 3, minH: 5 },
];

const SM = [
  { i: 'kpi', x: 0, y: 0, w: 6, h: 7, minW: 4, minH: 3 },
  { i: 'revenue', x: 0, y: 7, w: 6, h: 9, minW: 4, minH: 6 },
  { i: 'business', x: 0, y: 16, w: 6, h: 9, minW: 4, minH: 6 },
  { i: 'quick', x: 0, y: 25, w: 6, h: 8, minW: 4, minH: 5 },
  { i: 'inventory', x: 0, y: 33, w: 6, h: 8, minW: 4, minH: 5 },
  { i: 'orders', x: 0, y: 41, w: 6, h: 8, minW: 4, minH: 5 },
  { i: 'topselling', x: 0, y: 49, w: 6, h: 8, minW: 4, minH: 5 },
];

export const DEFAULT_DASHBOARD_LAYOUTS = {
  lg: LG,
  md: MD,
  sm: SM,
};

export function cloneDefaultLayouts() {
  return {
    lg: LG.map((item) => ({ ...item })),
    md: MD.map((item) => ({ ...item })),
    sm: SM.map((item) => ({ ...item })),
  };
}

function defaultItemFor(id, bp) {
  const source = DEFAULT_DASHBOARD_LAYOUTS[bp] || LG;
  const found = source.find((item) => item.i === id);
  return found ? { ...found } : { i: id, x: 0, y: Infinity, w: 4, h: 6, minW: 2, minH: 3 };
}

/** Merge saved layouts with defaults so new widgets appear. */
export function normalizeLayouts(savedLayouts, hidden = []) {
  const hiddenSet = new Set(hidden || []);
  const base = cloneDefaultLayouts();
  const result = {};

  for (const bp of Object.keys(base)) {
    const saved = Array.isArray(savedLayouts?.[bp]) ? savedLayouts[bp] : [];
    const byId = new Map(saved.map((item) => [item.i, { ...item }]));
    result[bp] = base[bp]
      .filter((item) => !hiddenSet.has(item.i))
      .map((item) => {
        const prev = byId.get(item.i);
        if (!prev) return { ...item };
        return {
          ...item,
          ...prev,
          i: item.i,
          minW: item.minW,
          minH: item.minH,
        };
      });
  }

  return result;
}

export function removeWidgetFromLayouts(layouts, widgetId) {
  const next = {};
  for (const bp of Object.keys(layouts || {})) {
    next[bp] = (layouts[bp] || []).filter((item) => item.i !== widgetId);
  }
  return next;
}

export function addWidgetToLayouts(layouts, widgetId) {
  const next = {};
  for (const bp of Object.keys(DEFAULT_DASHBOARD_LAYOUTS)) {
    const current = [...(layouts?.[bp] || [])].filter((item) => item.i !== widgetId);
    const maxY = current.reduce((m, item) => Math.max(m, (item.y || 0) + (item.h || 1)), 0);
    const def = defaultItemFor(widgetId, bp);
    current.push({ ...def, y: maxY });
    next[bp] = current;
  }
  return next;
}

export function buildLayoutPayload(layouts, hidden) {
  return {
    version: 1,
    layouts,
    hidden: [...(hidden || [])],
  };
}

export function parseSavedLayout(raw) {
  if (!raw || typeof raw !== 'object') {
    return { layouts: cloneDefaultLayouts(), hidden: [] };
  }
  const hidden = Array.isArray(raw.hidden)
    ? raw.hidden.filter((id) => DASHBOARD_WIDGETS.some((w) => w.id === id))
    : [];
  return {
    layouts: normalizeLayouts(raw.layouts, hidden),
    hidden,
  };
}
