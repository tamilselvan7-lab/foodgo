const CATEGORIES = [
  { name: "Pizza", icon: "🍕" }, { name: "Burgers", icon: "🍔" }, { name: "Chinese", icon: "🥡" },
  { name: "Biryani", icon: "🍛" }, { name: "Mexican", icon: "🌮" }, { name: "Healthy", icon: "🥗" },
  { name: "Desserts", icon: "🍰" }, { name: "Beverages", icon: "🥤" },
];

let activeCategory = null;

function renderCategories() {
  const el = document.getElementById("categoryList");
  el.innerHTML = CATEGORIES.map(
    (c) => `<button class="category-item" data-cat="${c.name}">
      <div class="bubble">${c.icon}</div><span>${c.name}</span>
    </button>`
  ).join("");
  el.querySelectorAll("[data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat;
      activeCategory = activeCategory === cat ? null : cat;
      el.querySelectorAll(".category-item").forEach((b) => b.classList.toggle("active", b.dataset.cat === activeCategory));
      loadRestaurants();
    });
  });
}

function restaurantCard(r) {
  const tags = [];
  if (r.has_veg) tags.push('<span class="veg-dot"></span>');
  if (r.has_nonveg) tags.push('<span class="nonveg-dot"></span>');
  return `
    <a class="restaurant-card" href="restaurant.html?id=${r.id}">
      <div class="img-wrap">
        <img src="${r.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600'}" alt="${r.name}" />
        <span class="rating-chip">⭐ ${r.rating ?? "New"}</span>
      </div>
      <div class="info">
        <div class="row"><h4>${r.name}</h4><div style="display:flex;gap:4px;">${tags.join("")}</div></div>
        <p class="cuisine">${r.cuisine || ""}</p>
        <div class="tag-pills">
          <span class="tag-pill">⏱ ${r.eta_minutes || "30-35"} min</span>
          <span class="tag-pill">${r.delivery_fee ? `₹${r.delivery_fee}` : "Free delivery"}</span>
        </div>
      </div>
    </a>`;
}

async function loadRestaurants() {
  const grid = document.getElementById("restaurantGrid");
  const search = document.getElementById("searchInput").value.trim();
  grid.innerHTML = "<p>Loading restaurants…</p>";
  try {
    const params = {};
    if (search) params.search = search;
    if (activeCategory) params.cuisine = activeCategory;
    const restaurants = await api.getRestaurants(params);
    grid.innerHTML = restaurants.length
      ? restaurants.map(restaurantCard).join("")
      : "<p>No restaurants match that search.</p>";
    document.getElementById("listTitle").textContent = search || activeCategory ? "Search results" : "Popular near you";
  } catch (err) {
    grid.innerHTML = `<p>Couldn't load restaurants: ${err.message}</p>`;
  }
}

function clearFilters() {
  activeCategory = null;
  document.getElementById("searchInput").value = "";
  document.querySelectorAll(".category-item").forEach((b) => b.classList.remove("active"));
  loadRestaurants();
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderCategories();
  loadRestaurants();
  let debounce;
  document.getElementById("searchInput").addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(loadRestaurants, 300);
  });
});
