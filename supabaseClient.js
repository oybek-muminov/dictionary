import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { hasSupabaseConfig, APP_CONFIG } from "./config.js";

let supabaseClient = null;

export function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  return supabaseClient;
}

export async function sendMagicLink(email) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("SUPABASE_URL yoki SUPABASE_ANON_KEY sozlanmagan.");
  }

  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin
    }
  });

  if (error) {
    throw error;
  }
}

export async function getSession() {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getSession();
  if (error) {
    throw error;
  }

  return data.session;
}

export function onAuthStateChange(listener) {
  const client = getSupabaseClient();
  if (!client) {
    return {
      data: {
        subscription: {
          unsubscribe() {}
        }
      }
    };
  }

  return client.auth.onAuthStateChange((_event, session) => {
    listener(session);
  });
}

export async function signOut() {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }

  const { error } = await client.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function ensureUserDefaults(user) {
  const client = getSupabaseClient();
  if (!client || !user) {
    return;
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tashkent";

  const profileResult = await client.from("profiles").upsert(
    {
      id: user.id,
      display_name: user.email || "Foydalanuvchi",
      timezone
    },
    {
      onConflict: "id"
    }
  );

  if (profileResult.error) {
    throw profileResult.error;
  }

  const reminderResult = await client.from("reminder_settings").upsert(
    {
      user_id: user.id,
      enabled: false,
      daily_time_local: "20:00",
      timezone
    },
    {
      onConflict: "user_id",
      ignoreDuplicates: true
    }
  );

  if (reminderResult.error) {
    throw reminderResult.error;
  }
}

export async function getAccessToken() {
  const session = await getSession();
  return session?.access_token || "";
}
