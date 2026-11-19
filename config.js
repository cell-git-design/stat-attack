// Replace these with your Supabase Project URL and Anon Public Key
export const SUPABASE_CONFIG = {
  URL: "YOUR_SUPABASE_URL", // e.g., "https://xyzcompany.supabase.co"
  ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
};

// Automatically enables offline/demo simulation if Supabase credentials aren't configured yet
export const IS_DEMO_MODE =
  !SUPABASE_CONFIG.URL || SUPABASE_CONFIG.URL === "YOUR_SUPABASE_URL";
