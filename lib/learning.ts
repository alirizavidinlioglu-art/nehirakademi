export type Evidence = {
  correct: boolean;
  skipped: boolean;
  difficulty: string;
  help: number;
  responseMs: number;
  repeatedError: boolean;
};
export function masteryUpdate(previous: number, e: Evidence): number {
  const difficulty =
    e.difficulty === "hard" ? 1.25 : e.difficulty === "easy" ? 0.85 : 1;
  const independent = 1 - e.help * 0.13;
  const considered = e.responseMs < 1500 ? 0.65 : 1;
  const evidence = e.skipped
    ? 0
    : e.correct
      ? 100 * difficulty * independent * considered
      : e.repeatedError
        ? 0
        : 12;
  return Math.round(
    Math.min(
      100,
      Math.max(0, previous * 0.75 + Math.min(100, evidence) * 0.25),
    ),
  );
}
export const reviewIntervals = [1, 3, 7, 14, 30];
export function nextReview(previous: number, correct: boolean, help: number) {
  const index =
    correct && help < 3
      ? Math.min(previous + 1, reviewIntervals.length - 1)
      : 0;
  return { index, days: reviewIntervals[index] };
}
export function masteryLabel(score: number) {
  return score < 20
    ? "Başlangıç"
    : score < 40
      ? "Gelişiyor"
      : score < 65
        ? "İyi"
        : score < 85
          ? "Çok İyi"
          : "Hakim";
}
export function normalizeAnswer(answer: string) {
  return answer
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");
}
export function gradeAnswer(kind: string, answer: string, expected: string) {
  if (kind === "numeric") {
    const a = Number(answer.replace(",", "."));
    const b = Number(expected.replace(",", "."));
    return answer.trim() !== "" && Number.isFinite(a) && Math.abs(a - b) < 1e-8;
  }
  return normalizeAnswer(answer) === normalizeAnswer(expected);
}
export function localDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
  }).format(date);
}
