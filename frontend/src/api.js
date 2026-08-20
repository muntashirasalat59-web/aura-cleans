// API helper - all backend calls in one place
// Base URL is proxied through Vite to http://localhost:5000

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

let accessToken = null;
let unauthorizedHandler = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text || !text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 240) || 'Invalid JSON from server');
  }
}

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new Error(
      err?.message?.includes('fetch')
        ? 'Cannot reach API. Is the backend running on port 5000?'
        : err.message || 'Network error'
    );
  }

  if (!response.ok) {
    const body = await readJsonResponse(response);
    const message =
      body?.error ||
      body?.message ||
      (response.status === 502
        ? 'Backend unavailable (502). Start the server: cd backend && npm run dev'
        : `Request failed (${response.status})`);

    if (response.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }

    const err = new Error(message);
    err.status = response.status;
    err.code = body?.code || null;
    err.detail = body?.detail || null;
    throw err;
  }

  // PDF download returns blob, not JSON
  if (response.headers.get('content-type')?.includes('application/pdf')) {
    return response;
  }

  const data = await readJsonResponse(response);
  if (data === null) {
    throw new Error('Empty response from server. Check backend logs for /api' + url);
  }
  return data;
}

// Products API
export const productsAPI = {
  getAll: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.activeOnly) params.set('active_only', 'true');
    if (opts.status) params.set('status', opts.status);
    const qs = params.toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  getOne: (id) => request(`/products/${id}`),
  generateBarcode: () => request('/products/generate-barcode', { method: 'POST' }),
  create: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deactivate: (id) => request(`/products/${id}/deactivate`, { method: 'POST' }),
  reactivate: (id) => request(`/products/${id}/reactivate`, { method: 'POST' }),
  delete: (id) => request(`/products/${id}`, { method: 'DELETE' }),
};

// Parties API
export const partiesAPI = {
  getAll: (opts = {}) => {
    const params = new URLSearchParams();
    if (typeof opts === 'string') {
      params.set('type', opts);
    } else {
      if (opts.type) params.set('type', opts.type);
      if (opts.activeOnly) params.set('active_only', 'true');
      if (opts.status) params.set('status', opts.status);
    }
    const qs = params.toString();
    return request(`/parties${qs ? `?${qs}` : ''}`);
  },
  getOne: (id) => request(`/parties/${id}`),
  create: (data) => request('/parties', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deactivate: (id) => request(`/parties/${id}/deactivate`, { method: 'POST' }),
  reactivate: (id) => request(`/parties/${id}/reactivate`, { method: 'POST' }),
  getLinkedRecords: (id) => request(`/parties/${id}/linked-records`),
  delete: (id) => request(`/parties/${id}`, { method: 'DELETE' }),
  deleteCascade: (id) => request(`/parties/${id}/cascade`, { method: 'DELETE' }),
};

// Purchases API
export const purchasesAPI = {
  getAll: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.partyId) params.set('party_id', opts.partyId);
    const qs = params.toString();
    return request(`/purchases${qs ? `?${qs}` : ''}`);
  },
  getOne: (id) => request(`/purchases/${id}`),
  create: (data) => request('/purchases', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    request(`/purchases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  markPaid: (id, data) =>
    request(`/purchases/${id}/mark-paid`, {
      method: 'PATCH',
      body: JSON.stringify(data || {}),
    }),
  delete: (id) => request(`/purchases/${id}`, { method: 'DELETE' }),
};

// Cities / branches API
export const citiesAPI = {
  getAll: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.activeOnly) params.set('active_only', 'true');
    const qs = params.toString();
    return request(`/cities${qs ? `?${qs}` : ''}`);
  },
  create: (data) => request('/cities', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/cities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id) => request(`/cities/${id}`, { method: 'DELETE' }),
};

// Sales API
export const salesAPI = {
  getAll: () => request('/sales'),
  getOne: (id) => request(`/sales/${id}`),
  create: (data) => request('/sales', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/sales/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  markPaid: (id, data) =>
    request(`/sales/${id}/mark-paid`, {
      method: 'PATCH',
      body: JSON.stringify(data || {}),
    }),
  delete: (id, { reason } = {}) =>
    request(`/sales/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),
  downloadPDF: async (id) => {
    const response = await request(`/sales/${id}/pdf`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${id}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  },
  shareWhatsApp: (id) =>
    request(`/sales/${id}/whatsapp-share`, { method: 'POST', body: JSON.stringify({}) }),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => request('/dashboard'),
};

// Expenses API
export const expensesAPI = {
  getAll: () => request('/expenses'),
  getOne: (id) => request(`/expenses/${id}`),
  create: (data) => request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),
};

export const preBookingsAPI = {
  getAll: () => request('/pre-bookings'),
  getOne: (id) => request(`/pre-bookings/${id}`),
  create: (data) => request('/pre-bookings', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/pre-bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cancel: (id) => request(`/pre-bookings/${id}/cancel`, { method: 'PATCH' }),
  delete: (id) => request(`/pre-bookings/${id}`, { method: 'DELETE' }),
};

// Employees API
export const employeesAPI = {
  getAll: () => request('/employees'),
  getOne: (id) => request(`/employees/${id}`),
  create: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deactivate: (id) => request(`/employees/${id}/deactivate`, { method: 'POST' }),
  reactivate: (id) => request(`/employees/${id}/reactivate`, { method: 'POST' }),
  delete: (id) => request(`/employees/${id}`, { method: 'DELETE' }),
  markSalaryPaid: (id) => request(`/employees/${id}/mark-salary-paid`, { method: 'POST' }),
};

// Reports API
export const reportsAPI = {
  get: ({ from, to }) => request(`/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
};

export const authAPI = {
  me: () => request('/auth/me'),
  signup: (data) => request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  resendConfirmation: (email) =>
    request('/auth/resend-confirmation', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
};

export const supportAPI = {
  threads: () => request('/support-messages/threads'),
  unreadCount: () => request('/support-messages/unread-count'),
  markRead: (userId) =>
    request('/support-messages/read', {
      method: 'PATCH',
      body: JSON.stringify({ user_id: userId }),
    }),
  list: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.user_id) params.set('user_id', opts.user_id);
    const qs = params.toString();
    return request(`/support-messages${qs ? `?${qs}` : ''}`);
  },
  send: (data) => request('/support-messages', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => request(`/support-messages/${id}`, { method: 'DELETE' }),
};

export const usersAPI = {
  getAll: () => request('/users'),
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  markBusinessPaid: (id, data) =>
    request(`/users/${id}/mark-business-paid`, {
      method: 'PATCH',
      body: JSON.stringify(data || {}),
    }),
};

export const settingsAPI = {
  getBusiness: () => request('/settings/business'),
  updateBusiness: (data) =>
    request('/settings/business', { method: 'PUT', body: JSON.stringify(data) }),
  uploadImage: (type, base64Data) =>
    request('/settings/business/upload-image', {
      method: 'POST',
      body: JSON.stringify({ type, data: base64Data }),
    }),
  getDashboardLayout: () => request('/settings/dashboard-layout'),
  saveDashboardLayout: (layout) =>
    request('/settings/dashboard-layout', {
      method: 'PUT',
      body: JSON.stringify({ layout }),
    }),
  resetDashboardLayout: () =>
    request('/settings/dashboard-layout', { method: 'DELETE' }),
};

export const activityLogAPI = {
  list: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    if (opts.user_id) params.set('user_id', opts.user_id);
    if (opts.action_type) params.set('action_type', opts.action_type);
    if (opts.entity_type) params.set('entity_type', opts.entity_type);
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    const qs = params.toString();
    return request(`/activity-log${qs ? `?${qs}` : ''}`);
  },
  getActors: () => request('/activity-log/actors'),
};