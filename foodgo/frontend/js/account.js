function orderCard(o) {
  return `<div class="card" style="margin-bottom:0;">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h4>${o.restaurant_name}</h4>
        <p style="color:var(--color-text-muted); font-size:14px; margin:4px 0;">${new Date(o.created_at).toLocaleString()}</p>
        <p style="font-size:14px;">${o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}</p>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:600;">₹${o.total_amount}</div>
        <span class="tag-pill" style="margin-top:4px; display:inline-block;">${o.status.replace(/_/g, " ")}</span>
        <br/>
        <a class="change-link" href="track.html?order=${o.id}">Track order →</a>
      </div>
    </div>
  </div>`;
}

async function loadOrders() {
  const user = await getCurrentUser();
  if (!user) {
    location.href = "login.html?next=account.html";
    return;
  }
  try {
    const orders = await api.getOrders();
    document.getElementById("orderHistory").innerHTML = orders.length
      ? orders.map(orderCard).join("")
      : "<p>You haven't placed any orders yet. <a href='index.html'>Browse restaurants</a>.</p>";
  } catch (err) {
    document.getElementById("orderHistory").innerHTML = `<p>Couldn't load orders: ${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  loadOrders();
  document.getElementById("signOutBtn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    location.href = "index.html";
  });
});
