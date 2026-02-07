import { createClient } from "@supabase/supabase-js";

function readBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return "";
  }

  return authHeader.slice("Bearer ".length).trim();
}

function parseBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (_error) {
      return {};
    }
  }

  return req.body;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: "Supabase server envlar topilmadi." });
    return;
  }

  const token = readBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "Authorization bearer token talab qilinadi." });
    return;
  }

  const body = parseBody(req);
  const endpoint = body?.endpoint;
  const keys = body?.keys;
  const timezone = body?.timezone || "Asia/Tashkent";

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Invalid payload. endpoint va keys talab qilinadi." });
    return;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: "Token yaroqsiz yoki muddati tugagan." });
    return;
  }

  const userId = userData.user.id;

  const subResult = await adminClient.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      enabled: true,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "user_id,endpoint"
    }
  );

  if (subResult.error) {
    res.status(500).json({ error: subResult.error.message });
    return;
  }

  const settingsResult = await adminClient.from("reminder_settings").upsert(
    {
      user_id: userId,
      timezone,
      enabled: true,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "user_id"
    }
  );

  if (settingsResult.error) {
    res.status(500).json({ error: settingsResult.error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
