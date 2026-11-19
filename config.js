// Replace these with your Supabase Project URL and Anon Public Key
export const SUPABASE_CONFIG = {
  URL: "https://mwfjzzkidrlpckkogmif.supabase.co/rest/v1/", // e.g., "https://xyzcompany.supabase.co"
  ANON_KEY: "sb_publishable_1X54IJPnV_2HpdpE7SCh-w_ddVRzrf2",
};

// Automatically enables offline/demo simulation if Supabase credentials aren't configured yet
export const IS_DEMO_MODE =
  !SUPABASE_CONFIG.URL || SUPABASE_CONFIG.URL === "YOUR_SUPABASE_URL";
