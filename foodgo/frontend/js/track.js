const trackParams = new URLSearchParams(location.search);
const orderId = trackParams.get("order");

const STEPS = [
  { key: "confirmed", label: "Order Confirmed" },
  { key: "preparing", label: "Food Prepared" },
  { key: "picked_up", label: "Picked up" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

let map, restaurantMarker, customerMarker, driverMarker, routeLine;
let currentOrder = null;

function renderTimeline(status) {
  const idx = STEPS.findIndex((s) => s.key === status);
  const activeIdx = idx === -1 ? 0 : idx;
  const el = document.getElementById("timeline");
  el.innerHTML =
    '<div class="line"></div><div class="line-fill" id="lineFill"></div>' +
    STEPS.map((s, i) => {
      const cls = i < activeIdx ? "" : i === activeIdx ? "active" : "pending";
      const time = i <= activeIdx && currentOrder?.status_times?.[s.key] ? currentOrder.status_times[s.key] : "";
      return `<div class="timeline-step ${cls}">
        <div class="dot">${i < activeIdx ? "✓" : ""}</div>
        <div class="label">${s.label}</div>
        ${time ? `<div class="time">${time}</div>` : ""}
      </div>`;
    }).join("");
  document.getElementById("lineFill").style.height = `${(activeIdx / (STEPS.length - 1)) * 100}%`;
  document.getElementById("progressFill").style.width = `${((activeIdx + 1) / STEPS.length) * 100}%`;
}

function renderOrderSummary(order) {
  document.getElementById("orderTitle").textContent = `Track Your Order - #${order.id.slice(0, 8).toUpperCase()}`;
  document.getElementById("orderRestaurantName").textContent = order.restaurant_name;
  document.getElementById("orderRestaurantCuisine").textContent = order.restaurant_cuisine || "";
  document.getElementById("itemCountChip").textContent = `${order.items.length} Items`;
  document.getElementById("orderItemsList").innerHTML = order.items
    .map((i) => `<p style="margin:4px 0;">${i.quantity}x ${i.name}</p>`)
    .join("");
  document.getElementById("etaMinutes").textContent = order.eta_minutes ? `${order.eta_minutes} min` : "--";
  if (order.delivery_partner) {
    document.getElementById("driverName").textContent = `${order.delivery_partner.name} is on the way`;
    document.getElementById("driverRating").textContent = `⭐ ${order.delivery_partner.rating || "New"}`;
    document.getElementById("driverVehicle").textContent = order.delivery_partner.vehicle || "";
    if (order.delivery_partner.photo_url) document.getElementById("driverPhoto").src = order.delivery_partner.photo_url;
  }
  renderTimeline(order.status);
}

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 12.9716, lng: 77.5946 }, // sensible default; recentres once we have real coords
    zoom: 13,
    disableDefaultUI: true,
    styles: [{ elementType: "geometry", stylers: [{ color: "#fff0ee" }] }],
  });
  loadOrderAndSubscribe();
}

function placeOrUpdateMarker(markerRef, position, opts) {
  if (markerRef) {
    markerRef.setPosition(position);
    return markerRef;
  }
  return new google.maps.Marker({ position, map, ...opts });
}

function updateDriverPosition(lat, lng) {
  const pos = { lat, lng };
  driverMarker = placeOrUpdateMarker(driverMarker, pos, {
    label: { text: "🛵", fontSize: "20px" },
    title: "Delivery partner",
  });
  map.panTo(pos);
}

function subscribeToDeliveryLocation(id) {
  supabaseClient
    .channel(`delivery-location-${id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "delivery_locations", filter: `order_id=eq.${id}` },
      (payload) => {
        const row = payload.new;
        if (row && row.latitude && row.longitude) {
          updateDriverPosition(row.latitude, row.longitude);
        }
      }
    )
    .subscribe();

  // Also listen for order status changes (confirmed -> preparing -> ... -> delivered)
  supabaseClient
    .channel(`order-status-${id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
      (payload) => {
        renderTimeline(payload.new.status);
      }
    )
    .subscribe();
}

async function loadOrderAndSubscribe() {
  if (!orderId) {
    document.getElementById("orderTitle").textContent = "No order specified";
    return;
  }
  try {
    const order = await api.getOrder(orderId);
    currentOrder = order;
    renderOrderSummary(order);

    if (order.restaurant_location) {
      restaurantMarker = placeOrUpdateMarker(order.restaurant_location, order.restaurant_location, { label: "🏠", title: order.restaurant_name });
      map.setCenter(order.restaurant_location);
    }
    if (order.delivery_location) {
      customerMarker = placeOrUpdateMarker(order.delivery_location, order.delivery_location, { label: "📍", title: "You" });
    }
    if (order.driver_location) {
      updateDriverPosition(order.driver_location.lat, order.driver_location.lng);
    }

    subscribeToDeliveryLocation(orderId);
  } catch (err) {
    document.getElementById("orderTitle").textContent = "Couldn't load order";
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", updateCartBadge);
window.initMap = initMap; // called by the Google Maps script callback
