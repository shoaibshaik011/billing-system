const API_BASE = '/api';

export function getActiveTenantSlug() {
  const match = window.location.pathname.match(/^\/r\/([^\/]+)/);
  if (match) return match[1];
  try {
    const stored = sessionStorage.getItem('tenant_slug');
    if (stored) return stored;
  } catch (e) {}
  return '';
}

async function request(url, options = {}) {
  const tenantSlug = getActiveTenantSlug();
  const headers = { 
    'Content-Type': 'application/json',
    ...(tenantSlug ? { 'x-tenant-slug': tenantSlug } : {}),
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${API_BASE}${url}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Categories
export const getCategories = () => request('/categories');
export const createCategory = (data) => request('/categories', { method: 'POST', body: data });
export const updateCategory = (id, data) => request(`/categories/${id}`, { method: 'PUT', body: data });
export const deleteCategory = (id) => request(`/categories/${id}`, { method: 'DELETE' });

// Menu Items
export const getMenuItems = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/menu-items${query ? `?${query}` : ''}`);
};
export const createMenuItem = (data) => request('/menu-items', { method: 'POST', body: data });
export const updateMenuItem = (id, data) => request(`/menu-items/${id}`, { method: 'PUT', body: data });
export const toggleMenuItem = (id) => request(`/menu-items/${id}/toggle`, { method: 'PATCH' });
export const deleteMenuItem = (id) => request(`/menu-items/${id}`, { method: 'DELETE' });

// Tables
export const getTables = () => request('/tables');
export const createTable = (data) => request('/tables', { method: 'POST', body: data });
export const updateTable = (id, data) => request(`/tables/${id}`, { method: 'PUT', body: data });
export const updateTableStatus = (id, status) => request(`/tables/${id}/status`, { method: 'PATCH', body: { status } });
export const deleteTable = (id) => request(`/tables/${id}`, { method: 'DELETE' });

// Orders
export const getOrders = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/orders${query ? `?${query}` : ''}`);
};
export const getOrder = (id) => request(`/orders/${id}`);
export const createOrder = (data) => request('/orders', { method: 'POST', body: data });
export const addOrderItems = (orderId, items) => request(`/orders/${orderId}/items`, { method: 'POST', body: { items } });
export const updateOrderItem = (orderId, itemId, data) => request(`/orders/${orderId}/items/${itemId}`, { method: 'PUT', body: data });
export const deleteOrderItem = (orderId, itemId) => request(`/orders/${orderId}/items/${itemId}`, { method: 'DELETE' });
export const applyDiscount = (orderId, data) => request(`/orders/${orderId}/discount`, { method: 'PATCH', body: data });
export const completeOrder = (orderId, data) => request(`/orders/${orderId}/complete`, { method: 'PATCH', body: data });
export const cancelOrder = (orderId) => request(`/orders/${orderId}/cancel`, { method: 'PATCH' });

// KOT
export const getKots = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/kot${query ? `?${query}` : ''}`);
};
export const updateKotStatus = (id, status) => request(`/kot/${id}/status`, { method: 'PATCH', body: { status } });

// Customers
export const getCustomers = (search = '') => request(`/customers${search ? `?search=${search}` : ''}`);
export const getCustomer = (id) => request(`/customers/${id}`);
export const createCustomer = (data) => request('/customers', { method: 'POST', body: data });
export const updateCustomer = (id, data) => request(`/customers/${id}`, { method: 'PUT', body: data });
export const deleteCustomer = (id) => request(`/customers/${id}`, { method: 'DELETE' });

// Analytics & Settings
export const getDashboard = () => request('/dashboard');
export const getReports = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/reports${query ? `?${query}` : ''}`);
};
export const getSettings = () => request('/settings');
export const updateSettings = (data) => request('/settings', { method: 'PUT', body: data });

// Commercial SaaS Subscriptions
export const getSubscription = () => request('/subscription');
export const upgradeSubscription = (data) => request('/subscription/upgrade', { method: 'POST', body: data });
export const renewSubscription = () => request('/subscription/renew', { method: 'POST' });

// Guest QR Table Ordering
export const getGuestTableMenu = (tableNumber) => request(`/guest/table/${tableNumber}`);
export const placeGuestOrder = (tableNumber, data) => request(`/guest/table/${tableNumber}/order`, { method: 'POST', body: data });
export const getGuestOrderStatus = (orderId) => request(`/guest/order/${orderId}/status`);
export const requestGuestBill = (orderId) => request(`/guest/order/${orderId}/request-bill`, { method: 'POST' });
export const payGuestOrder = (orderId, data) => request(`/guest/order/${orderId}/pay`, { method: 'POST', body: data });

// SaaS Vendor / Super Admin Client Customizer & Provisioner
export const getAdminTenants = () => request('/admin/tenants');
export const getTenantConfig = (slug) => request(`/admin/tenants/${slug}`);
export const createTenant = (data) => request('/admin/tenants', { method: 'POST', body: data });
export const updateTenant = (id, data) => request(`/admin/tenants/${id}`, { method: 'PUT', body: data });
export const renewTenantSubscription = (id, days = 30) => request(`/admin/tenants/${id}/renew`, { method: 'PATCH', body: { days } });
export const toggleTenantStatus = (id, status) => request(`/admin/tenants/${id}/status`, { method: 'PATCH', body: { status } });
export const deleteTenant = (id) => request(`/admin/tenants/${id}`, { method: 'DELETE' });

// Staff & User Authentication
export const login = (data) => request('/auth/login', { method: 'POST', body: data });
export const resetTenantPassword = (data) => request('/auth/reset-tenant-password', { method: 'POST', body: data });
export const getUsers = () => request('/auth/users');
export const createUser = (data) => request('/auth/users', { method: 'POST', body: data });
export const updateUser = (id, data) => request(`/auth/users/${id}`, { method: 'PUT', body: data });
export const deleteUser = (id) => request(`/auth/users/${id}`, { method: 'DELETE' });

