export const generateFlashcards = async (questions: any[]) => {
  const res = await fetch('/api/revision/flashcards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions })
  });
  return res.json();
};

export const generatePodcast = async (questions: any[]) => {
  const res = await fetch('/api/revision/podcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions })
  });
  return res.json();
};
