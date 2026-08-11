let selectedAddress = null;
let selectedMethod = "upi";
const DELIVERY_FEE = 30;
const PLATFORM_FEE = 10;
const TAX_RATE = 0.05;

function renderSummary() {
  const cart = getCart();
  const itemsEl = document.getElementById("summaryItems");
  if (!cart.items.length) {
    itemsEl.innerHTML = "<p>Your cart is empty. <a href='index.html'>Browse restaurants</a>.</p>";
    document.getElementById("payBtn").disabled = true;
    return;
  }
  itemsEl.innerHTML = cart.items
    .map(
      (i) => `<div class="summary-item">
      <div class="left">
        <img class="thumb" src="${i.image || ''}" alt="" />
        <div>
          <h4 style="display:flex;align-items:center;gap:6px;"><span class="${i.veg ? "veg-dot" : "nonveg-dot"}"></span>${i.name}</h4>
          <p style="margin:0;color:var(--color-text-muted);font-size:14px;">Qty: ${i.qty}</p>
        </div>
      </div>
      <span>₹${i.price * i.qty}</span>
    </div>`
    )
    .join("");

  const subtotal = cartSubtotal(cart);
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + DELIVERY_FEE + PLATFORM_FEE + tax;

  document.getElementById("billItemTotal").textContent = `₹${subtotal}`;
  document.getElementById("billDelivery").textContent = `₹${DELIVERY_FEE}`;
  document.getElementById("billPlatform").textContent = `₹${PLATFORM_FEE}`;
  document.getElementById("billTax").textContent = `₹${tax}`;
  document.getElementById("billTotal").textContent = `₹${total}`;
  document.getElementById("payAmountLabel").textContent = `₹${total}`;
}

async function loadAddresses() {
  try {
    const addresses = await api.getAddresses();
    if (addresses.length) {
      selectedAddress = addresses[0];
      renderAddress();
    }
  } catch {
    // Not signed in yet — user will be prompted at pay time.
  }
}

function renderAddress() {
  const el = document.getElementById("addrDisplay");
  if (!selectedAddress) return;
  el.innerHTML = `<div>
    <h4>${selectedAddress.label}</h4>
    <p class="addr-text">${selectedAddress.line1}<br/>${selectedAddress.city_state_zip}</p>
  </div>`;
}

function wirePaymentOptions() {
  document.querySelectorAll(".pay-option").forEach((el) => {
    el.addEventListener("click", () => {
      document.querySelectorAll(".pay-option").forEach((o) => o.classList.remove("selected"));
      el.classList.add("selected");
      selectedMethod = el.dataset.method;
    });
  });
}

function wireAddressForm() {
  document.getElementById("changeAddrLink").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("addrForm").style.display = "block";
  });
  document.getElementById("saveAddrBtn").addEventListener("click", async () => {
    const payload = {
      label: document.getElementById("addrLabel").value || "Home",
      line1: document.getElementById("addrLine").value,
      city_state_zip: document.getElementById("addrCity").value,
    };
    if (!payload.line1) return alert("Please enter your address.");
    try {
      selectedAddress = await api.addAddress(payload);
      renderAddress();
      document.getElementById("addrForm").style.display = "none";
    } catch (err) {
      alert(err.message.includes("signed in") ? "Please sign in to save an address." : err.message);
      if (err.message.includes("signed in")) location.href = "login.html";
    }
  });
}

function showError(msg) {
  const el = document.getElementById("checkoutError");
  el.textContent = msg;
  el.style.display = "block";
}

async function handlePay() {
  showErrorReset();
  const cart = getCart();
  if (!cart.items.length) return showError("Your cart is empty.");
  if (!selectedAddress) return showError("Please add a delivery address first.");

  const user = await getCurrentUser();
  if (!user) {
    location.href = "login.html?next=checkout.html";
    return;
  }

  const payBtn = document.getElementById("payBtn");
  payBtn.disabled = true;
  payBtn.textContent = "Processing…";

  try {
    // 1. Create the order server-side (server recomputes totals from the DB — never trust client prices)
    const order = await api.createOrder({
      restaurantId: cart.restaurantId,
      addressId: selectedAddress.id,
      instructions: document.getElementById("instructions").value,
      paymentMethod: selectedMethod,
      items: cart.items.map((i) => ({ menuItemId: i.id, quantity: i.qty })),
    });

    // 2. Ask the backend to create a matching Razorpay order
    const paymentOrder = await api.createPaymentOrder(order.id);

    // 3. Open Razorpay checkout
    const rzp = new Razorpay({
      key: window.FOODGO_CONFIG.RAZORPAY_KEY_ID,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      name: "FoodGo",
      description: `Order #${order.id}`,
      order_id: paymentOrder.razorpayOrderId,
      prefill: { email: user.email },
      handler: async (response) => {
        try {
          await api.verifyPayment({
            orderId: order.id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          clearCart();
          location.href = `track.html?order=${order.id}`;
        } catch (err) {
          showError(`Payment could not be verified: ${err.message}`);
          resetPayBtn();
        }
      },
      modal: { ondismiss: resetPayBtn },
      theme: { color: "#b51c00" },
    });
    rzp.open();
  } catch (err) {
    showError(err.message);
    resetPayBtn();
  }
}

function resetPayBtn() {
  const payBtn = document.getElementById("payBtn");
  payBtn.disabled = false;
  payBtn.textContent = "Pay ";
  const span = document.createElement("span");
  span.id = "payAmountLabel";
  payBtn.appendChild(span);
  renderSummary();
}

function showErrorReset() {
  document.getElementById("checkoutError").style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderSummary();
  wirePaymentOptions();
  wireAddressForm();
  loadAddresses();
  document.getElementById("payBtn").addEventListener("click", handlePay);
});
