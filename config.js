const defaultConfig = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  VAPID_PUBLIC_KEY: ""
};

const appConfig = typeof window !== "undefined" ? window.APP_CONFIG || {} : {};

export const APP_CONFIG = {
  ...defaultConfig,
  ...appConfig
};

export function hasSupabaseConfig() {
  return Boolean(APP_CONFIG.SUPABASE_URL && APP_CONFIG.SUPABASE_ANON_KEY);
}

export function hasVapidKey() {
  return Boolean(APP_CONFIG.VAPID_PUBLIC_KEY);
}
