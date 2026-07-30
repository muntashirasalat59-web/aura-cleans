// API helper - all backend calls in one place
// Base URL is proxied through Vite to http://localhost:5000

const API_BASE = '/api';

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
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
    throw new Error(message);
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
  delete: (id) => request(`/parties/${id}`, { method: 'DELETE' }),
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
  create: (data) => request('/purchases', { method: 'POST', body: JSON.stringify(data) })
};

// Sales API
export const salesAPI = {
  getAll: () => request('/sales'),
  getOne: (id) => request(`/sales/${id}`),
  create: (data) => request('/sales', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/sales/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  downloadPDF: async (id) => {
    const response = await request(`/sales/${id}/pdf`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${id}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
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
};

export const usersAPI = {
  getAll: () => request('/users'),
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
};
