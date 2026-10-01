import { describe, it, expect } from "vitest";
import {
  gradeAnswer,
  masteryUpdate,
  nextReview,
  masteryLabel,
  localDay,
} from "../lib/learning";
import { generatedQuestionSchema, validateQuestionShape } from "../services/ai";
describe("learning evidence", () => {
  const evidence = {
    correct: true,
    skipped: false,
    difficulty: "medium",
    help: 0,
    responseMs: 12000,
    repeatedError: false,
  };
  it("independent solutions weigh more than fully assisted solutions", () => {
    expect(masteryUpdate(30, evidence)).toBeGreaterThan(
      masteryUpdate(30, { ...evidence, help: 5 }),
    );
  });
  it("instant guesses weigh less than considered answers", () => {
    expect(masteryUpdate(30, evidence)).toBeGreaterThan(
      masteryUpdate(30, { ...evidence, responseMs: 100 }),
    );
  });
  it("never exceeds mastery bounds and lowers mastery after repeated errors", () => {
    expect(
      masteryUpdate(100, { ...evidence, difficulty: "hard" }),
    ).toBeLessThanOrEqual(100);
    expect(
      masteryUpdate(70, { ...evidence, correct: false, repeatedError: true }),
    ).toBeLessThan(70);
    expect(
      masteryUpdate(0, { ...evidence, correct: false }),
    ).toBeGreaterThanOrEqual(0);
  });
  it("resets review spacing after errors and progresses to capped intervals", () => {
    expect(nextReview(4, false, 0)).toEqual({ index: 0, days: 1 });
    expect(nextReview(1, true, 0)).toEqual({ index: 2, days: 7 });
    expect(nextReview(4, true, 0)).toEqual({ index: 4, days: 30 });
    expect(nextReview(4, true, 5)).toEqual({ index: 0, days: 1 });
  });
  it("recognizes decimal commas without accepting empty numeric answers", () => {
    expect(gradeAnswer("numeric", "1,5", "1.5")).toBe(true);
    expect(gradeAnswer("numeric", "", "0")).toBe(false);
    expect(gradeAnswer("numeric", "2", "1.5")).toBe(false);
    expect(gradeAnswer("fill_blank", "  NEHİR  ", "nehir")).toBe(true);
  });
  it("uses Istanbul day boundaries for streaks", () => {
    expect(localDay(new Date("2026-10-01T22:00:00Z"))).toBe("2026-10-02");
    expect(masteryLabel(90)).toBe("Hakim");
  });
});
describe("AI structural gate", () => {
  const question = {
    kind: "multiple_choice" as const,
    prompt: "3 + 5 kaçtır?",
    options: ["8", "6", "7", "9"],
    answer: "8",
    explanation: "3 + 5 = 8",
    difficulty: "easy" as const,
    passage: null,
    payload: { image: null, table: null, points: null, pairs: null },
  };
  it("accepts a complete question", () => {
    expect(generatedQuestionSchema.safeParse(question).success).toBe(true);
    expect(validateQuestionShape(question)).toBe(true);
  });
  it("rejects missing and duplicate choices, guessed image URLs, and inconsistent tables", () => {
    expect(validateQuestionShape({ ...question, answer: "12" })).toBe(false);
    expect(validateQuestionShape({ ...question, options: ["8", "8"] })).toBe(
      false,
    );
    expect(
      validateQuestionShape({
        ...question,
        kind: "image_question",
        payload: { ...question.payload, image: "https://fake.example/a.png" },
      }),
    ).toBe(false);
    expect(
      validateQuestionShape({
        ...question,
        kind: "table_question",
        payload: { ...question.payload, table: [["A", "B"], ["C"]] },
      }),
    ).toBe(false);
  });
  it("rejects nonnumeric numeric answers and comprehension without a passage", () => {
    expect(
      validateQuestionShape({ ...question, kind: "numeric", answer: "abc" }),
    ).toBe(false);
    expect(
      validateQuestionShape({ ...question, kind: "reading_comprehension" }),
    ).toBe(false);
  });
});
