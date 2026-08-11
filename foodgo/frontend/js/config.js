// ==========================================================================
// FoodGo frontend config
// Only PUBLIC/anon keys go here — this file is shipped to every browser.
// Never put the Supabase service_role key or the Razorpay key_secret here.
// ==========================================================================
window.FOODGO_CONFIG = {
  // Your backend API base URL (the Express server started from backend.js)
  API_BASE_URL: "https://foodgo-1v2v.onrender.com/api",

  // Supabase project URL + anon (public) key — from Supabase dashboard > Settings > API
  SUPABASE_URL: "https://mxnggylszidpfvxjcjqn.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14bmdneWxzemlkcGZ2eGpjanFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNTQ5NDgsImV4cCI6MjEwMTkzMDk0OH0.8GqZzvscNRU-_R6fQ5fHr3b-52NnZIp1a08MAlGJL5I",

  // Razorpay publishable key id (starts with rzp_) — safe for the browser
  RAZORPAY_KEY_ID: "rzp_test_TOO6ejruo6BgRx",

  // Google Maps JavaScript API key, restricted to your domain in Google Cloud Console
  GOOGLE_MAPS_API_KEY: "YOUR_GOOGLE_MAPS_API_KEY",
};
