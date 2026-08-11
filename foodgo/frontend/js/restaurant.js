const params = new URLSearchParams(location.search);
const restaurantId = params.get("id");
let restaurant = null;
let menuByCategory = {};

function foodItemHTML(item) {
  return `
    <div class="food-item">
      <div class="details">
        <span class="${item.is_veg ? "veg-dot" : "nonveg-dot"}"></span>
        <h3>${item.name}</h3>
        <div class="price">₹${item.price}</div>
        ${item.rating ? `<div class="rating">⭐ ${item.rating} (${item.rating_count || 0})</div>` : ""}
        <p class="desc">${item.description || ""}</p>
      </div>
      <div class="thumb-wrap">
        <img src="${item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300'}" alt="${item.name}" />
        <button class="add-btn" data-add="${item.id}">ADD</button>
      </div>
    </div>`;
}

function renderMenu() {
  const tabsEl = document.getElementById("categoryTabs");
  const listEl = document.getElementById("menuList");
  const categories = Object.keys(menuByCategory);
  tabsEl.innerHTML = categories
    .map((c, i) => `<button class="tab-btn ${i === 0 ? "active" : ""}" data-tab="${c}">${c}</button>`)
    .join("");

  listEl.innerHTML = categories
    .map(
      (c) => `<div class="menu-category" id="cat-${c.replace(/\s+/g, "-")}">
        <h3>${c}</h3>
        ${menuByCategory[c].map(foodItemHTML).join("")}
      </div>`
    )
    .join("");

  tabsEl.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabsEl.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`cat-${btn.dataset.tab.replace(/\s+/g, "-")}`).scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  listEl.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = Object.values(menuByCategory).flat().find((i) => i.id === btn.dataset.add);
      addToCart(restaurant, { id: item.id, name: item.name, price: item.price, veg: item.is_veg, image: item.image_url });
      renderCartSidebar();
    });
  });
}

function renderCartSidebar() {
  const cart = getCart();
  const linesEl = document.getElementById("cartLines");
  const subtotalRow = document.getElementById("cartSubtotalRow");
  const subtotalEl = document.getElementById("cartSubtotal");
  const viewBtn = document.getElementById("viewCartBtn");
  const titleEl = document.getElementById("cartTitle");

  if (!cart.items.length) {
    linesEl.innerHTML = '<p class="empty-cart">Your cart is empty. Add items to get started.</p>';
    subtotalRow.style.display = "none";
    viewBtn.style.display = "none";
    titleEl.textContent = "Your Cart";
    return;
  }

  titleEl.textContent = `Your Cart (${cartItemCount(cart)} items)`;
  linesEl.innerHTML = cart.items
    .map(
      (i) => `<div class="cart-line">
      <div>
        <div class="name"><span class="${i.veg ? "veg-dot" : "nonveg-dot"}"></span>${i.name}</div>
        <div class="price">₹${i.price}</div>
      </div>
      <div class="qty-stepper">
        <button data-qty="-1" data-id="${i.id}">−</button>
        <span>${i.qty}</span>
        <button data-qty="1" data-id="${i.id}">+</button>
      </div>
    </div>`
    )
    .join("");

  linesEl.querySelectorAll("[data-qty]").forEach((btn) => {
    btn.addEventListener("click", () => {
      changeQty(btn.dataset.id, parseInt(btn.dataset.qty, 10));
      renderCartSidebar();
    });
  });

  subtotalRow.style.display = "flex";
  subtotalEl.textContent = `₹${cartSubtotal(cart)}`;
  viewBtn.style.display = "flex";
}

async function init() {
  renderHeader();
  if (!restaurantId) {
    document.getElementById("menuList").innerHTML = "<p>No restaurant selected.</p>";
    return;
  }
  try {
    const [r, menu] = await Promise.all([api.getRestaurant(restaurantId), api.getMenu(restaurantId)]);
    restaurant = r;
    document.getElementById("coverImg").src = r.cover_image_url || r.image_url || "";
    document.getElementById("rName").textContent = r.name;
    document.getElementById("rCuisine").textContent = r.cuisine || "";
    document.getElementById("rRating").textContent = `⭐ ${r.rating ?? "New"} (${r.rating_count || 0}+ ratings)`;
    document.getElementById("rEta").textContent = `${r.eta_minutes || "30-35"} mins`;
    document.getElementById("rCost").textContent = r.cost_for_two ? `₹${r.cost_for_two} for two` : "";

    menuByCategory = menu.reduce((acc, item) => {
      const cat = item.category || "Menu";
      (acc[cat] = acc[cat] || []).push(item);
      return acc;
    }, {});
    renderMenu();
    renderCartSidebar();
  } catch (err) {
    document.getElementById("menuList").innerHTML = `<p>Couldn't load this restaurant: ${err.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", init);
