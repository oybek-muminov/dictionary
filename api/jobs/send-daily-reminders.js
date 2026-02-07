import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const REMINDER_BODY = "Bugungi quizni bajarish vaqti keldi.";
const REMINDER_TITLE = "LugatLab";
const REMINDER_URL = "/";
const WINDOW_MINUTES = 15;

function readBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return "";
  }

  return authHeader.slice("Bearer ".length).trim();
}

function parseLocalParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return map;
}

function dateKeyForTimezone(date, timeZone) {
  const parts = parseLocalParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function minutesForTimezone(date, timeZone) {
  const parts = parseLocalParts(date, timeZone);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function parseClockToMinutes(clock) {
  if (!/^\d{2}:\d{2}$/.test(clock || "")) {
    return 20 * 60;
  }

  const [hourRaw, minuteRaw] = clock.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return 20 * 60;
  }

  return Math.max(0, Math.min(23 * 60 + 59, hour * 60 + minute));
}

function shouldSendToday(setting, now) {
  const timeZone = setting.timezone || "Asia/Tashkent";
  const targetMinutes = parseClockToMinutes(setting.daily_time_local || "20:00");
  const nowMinutes = minutesForTimezone(now, timeZone);
  const distance = Math.abs(nowMinutes - targetMinutes);

  if (distance >= WINDOW_MINUTES) {
    return false;
  }

  const todayKey = dateKeyForTimezone(now, timeZone);
  if (!setting.last_sent_at) {
    return true;
  }

  const lastSent = new Date(setting.last_sent_at);
  if (Number.isNaN(lastSent.getTime())) {
    return true;
  }

  const lastSentKey = dateKeyForTimezone(lastSent, timeZone);
  return todayKey !== lastSentKey;
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const authToken = readBearerToken(req.headers.authorization);

  if (!cronSecret || authToken !== cronSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    res.status(500).json({ error: "Required envlar topilmadi." });
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const settingsResult = await adminClient
    .from("reminder_settings")
    .select("user_id, enabled, daily_time_local, timezone, last_sent_at")
    .eq("enabled", true);

  if (settingsResult.error) {
    res.status(500).json({ error: settingsResult.error.message });
    return;
  }

  const settings = settingsResult.data || [];
  if (!settings.length) {
    res.status(200).json({ sentCount: 0, skippedCount: 0 });
    return;
  }

  const userIds = settings.map((row) => row.user_id);
  const subsResult = await adminClient
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, enabled")
    .in("user_id", userIds)
    .eq("enabled", true);

  if (subsResult.error) {
    res.status(500).json({ error: subsResult.error.message });
    return;
  }

  const subscriptionsByUser = new Map();
  for (const row of subsResult.data || []) {
    if (!subscriptionsByUser.has(row.user_id)) {
      subscriptionsByUser.set(row.user_id, []);
    }

    subscriptionsByUser.get(row.user_id).push(row);
  }

  const now = new Date();
  let sentCount = 0;
  let skippedCount = 0;
  const staleSubIds = [];

  for (const setting of settings) {
    if (!shouldSendToday(setting, now)) {
      skippedCount += 1;
      continue;
    }

    const userSubs = subscriptionsByUser.get(setting.user_id) || [];
    if (!userSubs.length) {
      skippedCount += 1;
      continue;
    }

    let sentForUser = 0;

    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          JSON.stringify({
            title: REMINDER_TITLE,
            body: REMINDER_BODY,
            url: REMINDER_URL
          })
        );

        sentCount += 1;
        sentForUser += 1;
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          staleSubIds.push(sub.id);
        }
      }
    }

    if (sentForUser > 0) {
      await adminClient
        .from("reminder_settings")
        .update({
          last_sent_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq("user_id", setting.user_id);
    } else {
      skippedCount += 1;
    }
  }

  if (staleSubIds.length) {
    await adminClient
      .from("push_subscriptions")
      .update({ enabled: false, updated_at: now.toISOString() })
      .in("id", staleSubIds);
  }

  res.status(200).json({ sentCount, skippedCount });
}
