function shuffle(list) {
  const arr = [...list];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function weightedPickIndex(pool) {
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let ticket = Math.random() * totalWeight;

  for (let i = 0; i < pool.length; i += 1) {
    ticket -= pool[i].weight;
    if (ticket <= 0) {
      return i;
    }
  }

  return pool.length - 1;
}

function pickWordsByMastery(words, progressMap, count) {
  const weightedPool = words.map((word) => {
    const progress = progressMap.get(String(word.id));
    const mastery = progress ? Number(progress.mastery_score || 0) : 0;

    return {
      word,
      weight: clamp(1.2 - mastery, 0.2, 1.2)
    };
  });

  const picked = [];
  while (picked.length < count && weightedPool.length > 0) {
    const index = weightedPickIndex(weightedPool);
    picked.push(weightedPool[index].word);
    weightedPool.splice(index, 1);
  }

  return picked;
}

export function buildQuiz(words, progressMap, questionCount = 10) {
  if (!Array.isArray(words) || words.length < 4) {
    throw new Error("Quiz uchun kamida 4 ta soz kerak.");
  }

  const total = Math.min(questionCount, words.length);
  const selectedWords = pickWordsByMastery(words, progressMap, total);

  const questions = selectedWords.map((word) => {
    const wrongChoices = shuffle(
      words
        .filter((item) => String(item.id) !== String(word.id))
        .map((item) => item.translation_uz)
        .filter((translation) => translation !== word.translation_uz)
    )
      .filter((translation, index, list) => list.indexOf(translation) === index)
      .slice(0, 3);

    while (wrongChoices.length < 3) {
      wrongChoices.push("Noma'lum");
    }

    return {
      wordId: String(word.id),
      word: word.word,
      example: word.example || "",
      correctAnswer: word.translation_uz,
      options: shuffle([word.translation_uz, ...wrongChoices])
    };
  });

  return {
    total: questions.length,
    questions
  };
}

export function getResultLabel(score, total) {
  if (!total) {
    return "Natija yo'q";
  }

  if (score <= 4) {
    return "Boshlang'ich";
  }

  if (score <= 7) {
    return "Yaxshi";
  }

  return "Zo'r";
}
