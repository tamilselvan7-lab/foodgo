/**
 * =============================================================================
 * FoodGo backend — single-file Express + Supabase(Postgres) + Razorpay server
 * =============================================================================
 *
 * Run:
 *   npm install express cors dotenv @supabase/supabase-js razorpay
 *   node backend.js
 *
 * Required environment variables (see .env.example):
 *   PORT
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (server-only — NEVER expose to the frontend)
 *   RAZORPAY_KEY_ID
 *   RAZORPAY_KEY_SECRET         (server-only — NEVER expose to the frontend)
 *   FRONTEND_ORIGIN             (CORS allow-list, e.g. http://localhost:5500)
 *
 * -----------------------------------------------------------------------------
 * DATABASE SCHEMA (run this once in the Supabase SQL editor)
 * -----------------------------------------------------------------------------
 *
 * -- Extensions -----------------------------------------------------------
 * create extension if not exists "pgcrypto";
 *
 * -- profiles: one row per Supabase Auth user --------------------------------
 * create table profiles (
 *   id            uuid primary key references auth.users(id) on delete cascade,
 *   full_name     text,
 *   phone         text,
 *   avatar_url    text,
 *   role          text not null default 'customer' check (role in ('customer','delivery_partner','admin')),
 *   created_at    timestamptz not null default now()
 * );
 *
 * -- auto-create a profile row whenever someone signs up via Supabase Auth --
 * create or replace function public.handle_new_user()
 * returns trigger as $$
 * begin
 *   insert into public.profiles (id, full_name)
 *   values (new.id, new.raw_user_meta_data->>'full_name');
 *   return new;
 * end;
 * $$ language plpgsql security definer;
 *
 * create trigger on_auth_user_created
 *   after insert on auth.users
 *   for each row execute procedure public.handle_new_user();
 *
 * -- restaurants --------------------------------------------------------------
 * create table restaurants (
 *   id               uuid primary key default gen_random_uuid(),
 *   name             text not null,
 *   cuisine          text,
 *   image_url        text,
 *   cover_image_url  text,
 *   rating           numeric(2,1) default 0,
 *   rating_count     int default 0,
 *   eta_minutes      text,
 *   cost_for_two     int,
 *   delivery_fee     int default 0,
 *   has_veg          boolean default true,
 *   has_nonveg       boolean default true,
 *   latitude         double precision,
 *   longitude        double precision,
 *   is_active        boolean default true,
 *   created_at       timestamptz not null default now()
 * );
 *
 * -- menu_items -----------------------------------------------------------
 * create table menu_items (
 *   id             uuid primary key default gen_random_uuid(),
 *   restaurant_id  uuid not null references restaurants(id) on delete cascade,
 *   category       text not null default 'Menu',
 *   name           text not null,
 *   description    text,
 *   price          numeric(10,2) not null check (price >= 0),
 *   image_url      text,
 *   is_veg         boolean default true,
 *   rating         numeric(2,1),
 *   rating_count   int default 0,
 *   is_available   boolean default true,
 *   created_at     timestamptz not null default now()
 * );
 *
 * -- addresses --------------------------------------------------------------
 * create table addresses (
 *   id              uuid primary key default gen_random_uuid(),
 *   user_id         uuid not null references profiles(id) on delete cascade,
 *   label           text not null default 'Home',
 *   line1           text not null,
 *   city_state_zip  text,
 *   latitude        double precision,
 *   longitude       double precision,
 *   created_at      timestamptz not null default now()
 * );
 *
 * -- delivery_partners --------------------------------------------------------
 * create table delivery_partners (
 *   id          uuid primary key default gen_random_uuid(),
 *   profile_id  uuid references profiles(id) on delete set null,
 *   name        text not null,
 *   phone       text,
 *   photo_url   text,
 *   vehicle     text,
 *   rating      numeric(2,1) default 5.0,
 *   is_active   boolean default true
 * );
 *
 * -- orders -------------------------------------------------------------------
 * create table orders (
 *   id                  uuid primary key default gen_random_uuid(),
 *   user_id             uuid not null references profiles(id) on delete cascade,
 *   restaurant_id       uuid not null references restaurants(id),
 *   address_id          uuid not null references addresses(id),
 *   delivery_partner_id uuid references delivery_partners(id),
 *   status              text not null default 'pending_payment'
 *                        check (status in ('pending_payment','confirmed','preparing','picked_up','out_for_delivery','delivered','cancelled')),
 *   payment_status      text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
 *   payment_method      text,
 *   instructions        text,
 *   item_total          numeric(10,2) not null,
 *   delivery_fee        numeric(10,2) not null default 0,
 *   platform_fee        numeric(10,2) not null default 0,
 *   tax                 numeric(10,2) not null default 0,
 *   discount             numeric(10,2) not null default 0,
 *   total_amount        numeric(10,2) not null,
 *   eta_minutes         int,
 *   status_times        jsonb not null default '{}'::jsonb,
 *   created_at          timestamptz not null default now()
 * );
 *
 * -- order_items ----------------------------------------------------------
 * create table order_items (
 *   id            uuid primary key default gen_random_uuid(),
 *   order_id      uuid not null references orders(id) on delete cascade,
 *   menu_item_id  uuid not null references menu_items(id),
 *   name          text not null,   -- snapshot at order time
 *   price         numeric(10,2) not null, -- snapshot at order time
 *   quantity      int not null check (quantity > 0)
 * );
 *
 * -- payments ------------------------------------------------------------
 * create table payments (
 *   id                  uuid primary key default gen_random_uuid(),
 *   order_id            uuid not null references orders(id) on delete cascade,
 *   razorpay_order_id   text not null,
 *   razorpay_payment_id text,
 *   razorpay_signature  text,
 *   amount              numeric(10,2) not null,
 *   status              text not null default 'created' check (status in ('created','paid','failed')),
 *   created_at          timestamptz not null default now()
 * );
 *
 * -- delivery_locations (live GPS pings — read via Supabase Realtime) --------
 * create table delivery_locations (
 *   id          uuid primary key default gen_random_uuid(),
 *   order_id    uuid not null references orders(id) on delete cascade,
 *   latitude    double precision not null,
 *   longitude   double precision not null,
 *   recorded_at timestamptz not null default now()
 * );
 *
 * -- Enable Realtime on the tables the frontend subscribes to ----------------
 * alter publication supabase_realtime add table delivery_locations;
 * alter publication supabase_realtime add table orders;
 *
 * -- Row Level Security --------------------------------------------------
 * alter table profiles enable row level security;
 * alter table addresses enable row level security;
 * alter table orders enable row level security;
 * alter table order_items enable row level security;
 * alter table payments enable row level security;
 * alter table delivery_locations enable row level security;
 * alter table delivery_partners enable row level security;
 * alter table restaurants enable row level security;
 * alter table menu_items enable row level security;
 *
 * create policy "read own profile" on profiles for select using (auth.uid() = id);
 * create policy "update own profile" on profiles for update using (auth.uid() = id);
 *
 * create policy "manage own addresses" on addresses for all
 *   using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 * create policy "read own orders" on orders for select using (auth.uid() = user_id);
 * create policy "read own order items" on order_items for select
 *   using (exists (select 1 from orders o where o.id = order_items.order_id and o.user_id = auth.uid()));
 * create policy "read own payments" on payments for select
 *   using (exists (select 1 from orders o where o.id = payments.order_id and o.user_id = auth.uid()));
 * create policy "read own delivery locations" on delivery_locations for select
 *   using (exists (select 1 from orders o where o.id = delivery_locations.order_id and o.user_id = auth.uid()));
 *
 * create policy "public read restaurants" on restaurants for select using (is_active = true);
 * create policy "public read menu" on menu_items for select using (is_available = true);
 *
 * -- All writes to orders/order_items/payments/delivery_locations/restaurants
 * -- go through backend.js using the service_role key, which bypasses RLS —
 * -- that is why every write route below re-checks ownership/authorization
 * -- in application code before touching the database.
 * =============================================================================
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const Razorpay = require("razorpay");

const {
  PORT = 4000,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  FRONTEND_ORIGIN = "http://localhost:5500",
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}
if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in environment.");
  process.exit(1);
}

// Service-role client — full DB access. Never send this key to the frontend.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

// -----------------------------------------------------------------------------
// Auth middleware — verifies the Supabase access token sent as
// `Authorization: Bearer <token>` and attaches req.user.
// -----------------------------------------------------------------------------
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing or invalid Authorization header." });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Invalid or expired session." });

  req.user = data.user;
  next();
}

// Small helper: 400 on missing required fields.
function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === "");
  return missing.length ? `Missing required field(s): ${missing.join(", ")}` : null;
}

// =============================================================================
// Restaurants & menus (public reads)
// =============================================================================
app.get("/api/restaurants", async (req, res) => {
  const { search, cuisine } = req.query;
  let query = supabase.from("restaurants").select("*").eq("is_active", true);

  if (search) query = query.or(`name.ilike.%${search}%,cuisine.ilike.%${search}%`);
  if (cuisine) query = query.ilike("cuisine", `%${cuisine}%`);

  const { data, error } = await query.order("rating", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/api/restaurants/:id", async (req, res) => {
  const { data, error } = await supabase.from("restaurants").select("*").eq("id", req.params.id).single();
  if (error) return res.status(404).json({ error: "Restaurant not found." });
  res.json(data);
});

app.get("/api/restaurants/:id/menu", async (req, res) => {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("restaurant_id", req.params.id)
    .eq("is_available", true)
    .order("category");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// =============================================================================
// Addresses (auth required, scoped to the caller)
// =============================================================================
app.get("/api/addresses", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/addresses", requireAuth, async (req, res) => {
  const missing = requireFields(req.body, ["line1"]);
  if (missing) return res.status(400).json({ error: missing });

  const { label = "Home", line1, city_state_zip, latitude, longitude } = req.body;
  const { data, error } = await supabase
    .from("addresses")
    .insert({ user_id: req.user.id, label, line1, city_state_zip, latitude, longitude })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// =============================================================================
// Orders
// =============================================================================

// Create a pending order. Prices are ALWAYS recomputed from menu_items in the
// DB — the client only sends menuItemId + quantity, never a price, so a
// tampered request can't discount an order.
app.post("/api/orders", requireAuth, async (req, res) => {
  const missing = requireFields(req.body, ["restaurantId", "addressId", "items"]);
  if (missing) return res.status(400).json({ error: missing });

  const { restaurantId, addressId, items, instructions, paymentMethod } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Order must include at least one item." });
  }

  // Ownership check: the address must belong to the caller.
  const { data: address, error: addrErr } = await supabase
    .from("addresses")
    .select("id")
    .eq("id", addressId)
    .eq("user_id", req.user.id)
    .single();
  if (addrErr || !address) return res.status(403).json({ error: "That address does not belong to you." });

  const menuItemIds = items.map((i) => i.menuItemId);
  const { data: dbItems, error: itemsErr } = await supabase
    .from("menu_items")
    .select("id, name, price, restaurant_id")
    .in("id", menuItemIds);
  if (itemsErr) return res.status(500).json({ error: itemsErr.message });
  if (dbItems.length !== menuItemIds.length) return res.status(400).json({ error: "One or more menu items are invalid." });
  if (dbItems.some((i) => i.restaurant_id !== restaurantId)) {
    return res.status(400).json({ error: "All items must belong to the same restaurant." });
  }

  const orderItems = items.map((reqItem) => {
    const dbItem = dbItems.find((d) => d.id === reqItem.menuItemId);
    const quantity = Math.max(1, parseInt(reqItem.quantity, 10) || 1);
    return { menu_item_id: dbItem.id, name: dbItem.name, price: dbItem.price, quantity };
  });

  const itemTotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = 30;
  const platformFee = 10;
  const tax = Math.round(itemTotal * 0.05 * 100) / 100;
  const discount = 0;
  const totalAmount = itemTotal + deliveryFee + platformFee + tax - discount;

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      user_id: req.user.id,
      restaurant_id: restaurantId,
      address_id: addressId,
      instructions,
      payment_method: paymentMethod,
      item_total: itemTotal,
      delivery_fee: deliveryFee,
      platform_fee: platformFee,
      tax,
      discount,
      total_amount: totalAmount,
      status: "pending_payment",
      status_times: { confirmed: new Date().toISOString() },
    })
    .select()
    .single();
  if (orderErr) return res.status(500).json({ error: orderErr.message });

  const { error: lineErr } = await supabase
    .from("order_items")
    .insert(orderItems.map((i) => ({ ...i, order_id: order.id })));
  if (lineErr) return res.status(500).json({ error: lineErr.message });

  res.status(201).json(order);
});

app.get("/api/orders", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*, restaurants(name), order_items(*)")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  res.json(
    data.map((o) => ({
      id: o.id,
      restaurant_name: o.restaurants?.name,
      status: o.status,
      total_amount: o.total_amount,
      created_at: o.created_at,
      items: o.order_items.map((i) => ({ name: i.name, quantity: i.quantity })),
    }))
  );
});

app.get("/api/orders/:id", requireAuth, async (req, res) => {
  const { data: order, error } = await supabase
    .from("orders")
    .select("*, restaurants(name, cuisine, latitude, longitude), addresses(line1, latitude, longitude), order_items(*), delivery_partners(name, phone, photo_url, vehicle, rating)")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id) // ownership check
    .single();
  if (error || !order) return res.status(404).json({ error: "Order not found." });

  const { data: lastLocation } = await supabase
    .from("delivery_locations")
    .select("latitude, longitude")
    .eq("order_id", order.id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  res.json({
    id: order.id,
    status: order.status,
    status_times: order.status_times,
    eta_minutes: order.eta_minutes,
    restaurant_name: order.restaurants?.name,
    restaurant_cuisine: order.restaurants?.cuisine,
    restaurant_location: order.restaurants?.latitude
      ? { lat: order.restaurants.latitude, lng: order.restaurants.longitude }
      : null,
    delivery_location: order.addresses?.latitude
      ? { lat: order.addresses.latitude, lng: order.addresses.longitude }
      : null,
    driver_location: lastLocation ? { lat: lastLocation.latitude, lng: lastLocation.longitude } : null,
    delivery_partner: order.delivery_partners,
    items: order.order_items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
    total_amount: order.total_amount,
  });
});

// =============================================================================
// Payments (Razorpay) — server-side create + verify, secrets never leave here
// =============================================================================
app.post("/api/payments/create-order", requireAuth, async (req, res) => {
  const missing = requireFields(req.body, ["orderId"]);
  if (missing) return res.status(400).json({ error: missing });

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, total_amount, user_id, payment_status")
    .eq("id", req.body.orderId)
    .eq("user_id", req.user.id)
    .single();
  if (error || !order) return res.status(404).json({ error: "Order not found." });
  if (order.payment_status === "paid") return res.status(400).json({ error: "Order is already paid." });

  const amountInPaise = Math.round(order.total_amount * 100);
  const razorpayOrder = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: order.id,
    notes: { order_id: order.id, user_id: req.user.id },
  });

  await supabase.from("payments").insert({
    order_id: order.id,
    razorpay_order_id: razorpayOrder.id,
    amount: order.total_amount,
    status: "created",
  });

  res.json({ razorpayOrderId: razorpayOrder.id, amount: amountInPaise, currency: "INR" });
});

// Verifies the Razorpay signature server-side (HMAC SHA256 of order_id|payment_id
// using the key_secret) before marking the order as paid — this is the only
// trustworthy way to confirm a payment; never trust a "success" from the client alone.
app.post("/api/payments/verify", requireAuth, async (req, res) => {
  const missing = requireFields(req.body, ["orderId", "razorpay_order_id", "razorpay_payment_id", "razorpay_signature"]);
  if (missing) return res.status(400).json({ error: missing });

  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, user_id")
    .eq("id", orderId)
    .eq("user_id", req.user.id)
    .single();
  if (error || !order) return res.status(404).json({ error: "Order not found." });

  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    await supabase.from("payments").update({ status: "failed" }).eq("razorpay_order_id", razorpay_order_id);
    return res.status(400).json({ error: "Payment signature verification failed." });
  }

  await supabase
    .from("payments")
    .update({ status: "paid", razorpay_payment_id, razorpay_signature })
    .eq("razorpay_order_id", razorpay_order_id);

  // Assign the next available delivery partner (simple round-robin for demo purposes).
  const { data: partner } = await supabase
    .from("delivery_partners")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      status: "confirmed",
      delivery_partner_id: partner?.id || null,
      eta_minutes: 25,
      status_times: { confirmed: new Date().toISOString() },
    })
    .eq("id", orderId);

  res.json({ ok: true, orderId });
});

// =============================================================================
// Delivery tracking — a driver-facing client (or simulator) posts GPS pings
// here; the frontend never writes this table directly, so authorization and
// order-ownership are enforced in one place.
// =============================================================================
app.post("/api/delivery/:orderId/location", requireAuth, async (req, res) => {
  const missing = requireFields(req.body, ["latitude", "longitude"]);
  if (missing) return res.status(400).json({ error: missing });

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, delivery_partner_id, delivery_partners(profile_id)")
    .eq("id", req.params.orderId)
    .single();
  if (error || !order) return res.status(404).json({ error: "Order not found." });

  // Only the assigned delivery partner (or an admin) may post a location for this order.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", req.user.id).single();
  const isAssignedPartner = order.delivery_partners?.profile_id === req.user.id;
  if (!isAssignedPartner && profile?.role !== "admin") {
    return res.status(403).json({ error: "You are not the delivery partner for this order." });
  }

  const { latitude, longitude } = req.body;
  const { error: insertErr } = await supabase
    .from("delivery_locations")
    .insert({ order_id: order.id, latitude, longitude });
  if (insertErr) return res.status(500).json({ error: insertErr.message });

  res.status(201).json({ ok: true });
});

// Optional: let a delivery partner (or admin) advance the order status —
// the frontend timeline updates live via the Supabase Realtime subscription on `orders`.
app.patch("/api/delivery/:orderId/status", requireAuth, async (req, res) => {
  const validStatuses = ["confirmed", "preparing", "picked_up", "out_for_delivery", "delivered"];
  const { status } = req.body;
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status." });

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status_times, delivery_partners(profile_id)")
    .eq("id", req.params.orderId)
    .single();
  if (error || !order) return res.status(404).json({ error: "Order not found." });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", req.user.id).single();
  const isAssignedPartner = order.delivery_partners?.profile_id === req.user.id;
  if (!isAssignedPartner && profile?.role !== "admin") {
    return res.status(403).json({ error: "You are not authorized to update this order." });
  }

  const statusTimes = { ...order.status_times, [status]: new Date().toISOString() };
  const { error: updateErr } = await supabase
    .from("orders")
    .update({ status, status_times: statusTimes })
    .eq("id", order.id);
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  res.json({ ok: true });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`FoodGo backend listening on http://localhost:${PORT}`));
