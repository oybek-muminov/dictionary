import { getSupabaseClient } from "./supabaseClient.js";
import { hasSupabaseConfig } from "./config.js";

const LOCAL_ATTEMPTS_KEY = "lugatlab_attempts";
const LOCAL_PROGRESS_KEY = "lugatlab_progress";
const LOCAL_SETTINGS_KEY = "lugatlab_settings";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function loadLocalWords() {
  const response = await fetch("./data/a1a2-words.json");
  if (!response.ok) {
    throw new Error("Lokal sozlar fayli yuklanmadi.");
  }

  return response.json();
}

function normalizeWords(words) {
  return words.map((item) => ({
    id: String(item.id),
    word: item.word,
    translation_uz: item.translation_uz,
    example: item.example || "",
    level: item.level || "A1",
    category: item.category || "general",
    is_active: item.is_active !== false
  }));
}

export async function loadWords() {
  const client = getSupabaseClient();

  if (hasSupabaseConfig() && client) {
    const { data, error } = await client
      .from("words")
      .select("id, word, translation_uz, example, level, category, is_active")
      .eq("is_active", true)
      .in("level", ["A1", "A2"])
      .order("id", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return normalizeWords(data);
    }
  }

  const localWords = await loadLocalWords();
  return normalizeWords(localWords);
}

export async function loadUserProgress(userId) {
  const progressMap = new Map();
  const client = getSupabaseClient();

  if (hasSupabaseConfig() && client && userId) {
    const { data, error } = await client
      .from("user_word_progress")
      .select("word_id, correct_count, wrong_count, mastery_score, last_seen_at")
      .eq("user_id", userId);

    if (!error && Array.isArray(data)) {
      data.forEach((row) => {
        progressMap.set(String(row.word_id), row);
      });
      return progressMap;
    }
  }

  const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
  if (!raw) {
    return progressMap;
  }

  const parsed = JSON.parse(raw);
  Object.entries(parsed).forEach(([wordId, value]) => {
    progressMap.set(String(wordId), value);
  });

  return progressMap;
}

export async function saveQuizAttempt({ userId, score, total, durationSec, answers }) {
  const client = getSupabaseClient();

  if (hasSupabaseConfig() && client && userId) {
    const attemptResult = await client.from("quiz_attempts").insert({
      user_id: userId,
      score,
      total,
      duration_sec: durationSec
    });
    if (attemptResult.error) {
      throw attemptResult.error;
    }

    const wordIds = [...new Set(answers.map((item) => Number(item.wordId)).filter((item) => !Number.isNaN(item)))];

    const existingMap = new Map();
    if (wordIds.length > 0) {
      const { data: existingRows, error: existingRowsError } = await client
        .from("user_word_progress")
        .select("word_id, correct_count, wrong_count, mastery_score")
        .eq("user_id", userId)
        .in("word_id", wordIds);
      if (existingRowsError) {
        throw existingRowsError;
      }

      (existingRows || []).forEach((row) => {
        existingMap.set(String(row.word_id), row);
      });
    }

    const updates = answers.map((answer) => {
      const wordId = String(answer.wordId);
      const current = existingMap.get(wordId) || {
        correct_count: 0,
        wrong_count: 0,
        mastery_score: 0
      };

      const isCorrect = answer.isCorrect;
      const masteryDelta = isCorrect ? 0.1 : -0.08;
      const parsedWordId = Number(wordId);

      return {
        user_id: userId,
        word_id: Number.isNaN(parsedWordId) ? wordId : parsedWordId,
        correct_count: Number(current.correct_count) + (isCorrect ? 1 : 0),
        wrong_count: Number(current.wrong_count) + (isCorrect ? 0 : 1),
        mastery_score: clamp(Number(current.mastery_score || 0) + masteryDelta, 0, 1),
        last_seen_at: new Date().toISOString()
      };
    });

    if (updates.length > 0) {
      const upsertResult = await client.from("user_word_progress").upsert(updates, {
        onConflict: "user_id,word_id"
      });
      if (upsertResult.error) {
        throw upsertResult.error;
      }
    }

    return;
  }

  const attempts = JSON.parse(localStorage.getItem(LOCAL_ATTEMPTS_KEY) || "[]");
  attempts.unshift({
    score,
    total,
    duration_sec: durationSec,
    created_at: new Date().toISOString()
  });
  localStorage.setItem(LOCAL_ATTEMPTS_KEY, JSON.stringify(attempts.slice(0, 30)));

  const progress = JSON.parse(localStorage.getItem(LOCAL_PROGRESS_KEY) || "{}");
  answers.forEach((answer) => {
    const key = String(answer.wordId);
    const current = progress[key] || {
      correct_count: 0,
      wrong_count: 0,
      mastery_score: 0
    };

    const delta = answer.isCorrect ? 0.1 : -0.08;

    progress[key] = {
      correct_count: current.correct_count + (answer.isCorrect ? 1 : 0),
      wrong_count: current.wrong_count + (answer.isCorrect ? 0 : 1),
      mastery_score: clamp(current.mastery_score + delta, 0, 1),
      last_seen_at: new Date().toISOString()
    };
  });

  localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(progress));
}

export async function loadStats(userId) {
  const client = getSupabaseClient();
  let rows = [];

  if (hasSupabaseConfig() && client && userId) {
    const { data, error } = await client
      .from("quiz_attempts")
      .select("score, total, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error) {
      rows = data || [];
    }
  } else {
    rows = JSON.parse(localStorage.getItem(LOCAL_ATTEMPTS_KEY) || "[]");
  }

  const attempts = rows.length;
  const totalPercent = rows.reduce((sum, row) => sum + (row.total ? (row.score / row.total) * 100 : 0), 0);
  const averagePercent = attempts ? Math.round(totalPercent / attempts) : 0;

  let bestScore = 0;
  let bestTotal = 10;
  rows.forEach((row) => {
    if (row.score > bestScore) {
      bestScore = row.score;
      bestTotal = row.total || 10;
    }
  });

  return {
    attempts,
    averagePercent,
    bestScore,
    bestTotal,
    recent: rows.slice(0, 5)
  };
}

export async function loadReminderSettings(userId) {
  const client = getSupabaseClient();

  if (hasSupabaseConfig() && client && userId) {
    const { data, error } = await client
      .from("reminder_settings")
      .select("enabled, daily_time_local, timezone")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      return data;
    }
  }

  const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
  if (raw) {
    try {
      const local = JSON.parse(raw);
      return {
        enabled: Boolean(local.enabled),
        daily_time_local: local.daily_time_local || "20:00",
        timezone: local.timezone || "Asia/Tashkent"
      };
    } catch (_error) {
      // fallback default qaytariladi
    }
  }

  return {
    enabled: false,
    daily_time_local: "20:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tashkent"
  };
}

export async function saveReminderSettings(userId, payload) {
  const client = getSupabaseClient();

  if (hasSupabaseConfig() && client && userId) {
    const { error } = await client.from("reminder_settings").upsert(
      {
        user_id: userId,
        enabled: payload.enabled,
        daily_time_local: payload.daily_time_local,
        timezone: payload.timezone
      },
      { onConflict: "user_id" }
    );

    if (error) {
      throw error;
    }

    return;
  }

  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(payload));
}
