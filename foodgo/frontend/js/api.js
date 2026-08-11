// Thin wrapper around fetch() that talks to backend.js and attaches the
// Supabase access token so the backend can authenticate the user.
async function apiRequest(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (auth) {
    const token = await getAccessToken();
    if (!token) throw new Error("You need to be signed in for this action.");
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${window.FOODGO_CONFIG.API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

const api = {
  // Restaurants
  getRestaurants: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/restaurants${qs ? `?${qs}` : ""}`);
  },
  getRestaurant: (id) => apiRequest(`/restaurants/${id}`),
  getMenu: (id) => apiRequest(`/restaurants/${id}/menu`),

  // Profile / addresses
  getAddresses: () => apiRequest("/addresses", { auth: true }),
  addAddress: (payload) => apiRequest("/addresses", { method: "POST", body: payload, auth: true }),

  // Orders
  createOrder: (payload) => apiRequest("/orders", { method: "POST", body: payload, auth: true }),
  getOrder: (id) => apiRequest(`/orders/${id}`, { auth: true }),
  getOrders: () => apiRequest("/orders", { auth: true }),

  // Payments
  createPaymentOrder: (orderId) =>
    apiRequest("/payments/create-order", { method: "POST", body: { orderId }, auth: true }),
  verifyPayment: (payload) =>
    apiRequest("/payments/verify", { method: "POST", body: payload, auth: true }),

  // Delivery partner (used by a driver-facing view / simulator)
  updateDeliveryLocation: (orderId, payload) =>
    apiRequest(`/delivery/${orderId}/location`, { method: "POST", body: payload, auth: true }),
};
