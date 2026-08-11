// Requires the Supabase JS CDN script to be loaded before this file:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
const supabaseClient = window.supabase.createClient(
  window.FOODGO_CONFIG.SUPABASE_URL,
  window.FOODGO_CONFIG.SUPABASE_ANON_KEY
);

// Returns the current session's access token, or null if logged out.
async function getAccessToken() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session ? data.session.access_token : null;
}

async function getCurrentUser() {
  const { data } = await supabaseClient.auth.getUser();
  return data.user || null;
}
