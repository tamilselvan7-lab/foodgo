// Cart lives in localStorage as: { restaurantId, restaurantName, items: [{id,name,price,qty,veg,image}] }
const CART_KEY = "foodgo_cart";

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || { restaurantId: null, restaurantName: null, items: [] };
  } catch {
    return { restaurantId: null, restaurantName: null, items: [] };
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartBadge();
}

// Adding an item from a different restaurant replaces the cart (one restaurant per order).
function addToCart(restaurant, item) {
  let cart = getCart();
  if (cart.restaurantId && cart.restaurantId !== restaurant.id) {
    if (!confirm("Your cart has items from another restaurant. Start a new cart?")) return cart;
    cart = { restaurantId: null, restaurantName: null, items: [] };
  }
  cart.restaurantId = restaurant.id;
  cart.restaurantName = restaurant.name;

  const existing = cart.items.find((i) => i.id === item.id);
  if (existing) existing.qty += 1;
  else cart.items.push({ ...item, qty: 1 });

  saveCart(cart);
  return cart;
}

function changeQty(itemId, delta) {
  const cart = getCart();
  const item = cart.items.find((i) => i.id === itemId);
  if (!item) return cart;
  item.qty += delta;
  cart.items = cart.items.filter((i) => i.qty > 0);
  if (cart.items.length === 0) {
    cart.restaurantId = null;
    cart.restaurantName = null;
  }
  saveCart(cart);
  return cart;
}

function cartSubtotal(cart = getCart()) {
  return cart.items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function cartItemCount(cart = getCart()) {
  return cart.items.reduce((sum, i) => sum + i.qty, 0);
}

function updateCartBadge() {
  const badge = document.querySelector("[data-cart-count]");
  if (!badge) return;
  const count = cartItemCount();
  badge.textContent = count;
  badge.style.display = count > 0 ? "flex" : "none";
}
