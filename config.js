// Replace these with your Supabase Project URL and Anon Public Key
export const SUPABASE_CONFIG = {
  URL: "https://mwfjzzkidrlpckkogmif.supabase.co", // e.g., "https://xyzcompany.supabase.co"
  ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13Zmp6emtpZHJscGNra29nbWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwNzIwNzYsImV4cCI6MjExMDY0ODA3Nn0.AQOz3GMJeOGhDRgrBxB20_xi4MtpQdjygyKa6PaNKzA",
};

// Automatically enables offline/demo simulation if Supabase credentials aren't configured yet
export const IS_DEMO_MODE =
  !SUPABASE_CONFIG.URL || SUPABASE_CONFIG.URL === "YOUR_SUPABASE_URL";
