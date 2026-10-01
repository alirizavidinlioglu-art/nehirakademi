export type Role = "STUDENT" | "PARENT" | "ADMIN";
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  grade: number;
  daily_minutes: number;
};
export type Node = {
  id: string;
  parent_id: string | null;
  kind: string;
  title: string;
  grade: number;
  subject: string;
  code: string | null;
  source_url: string | null;
  verified: boolean;
  academic_year: string;
  curriculum_version: string;
  payload: Record<string, unknown>;
};
export type QuestionKind =
  | "multiple_choice"
  | "true_false"
  | "fill_blank"
  | "matching"
  | "numeric"
  | "short_answer"
  | "reading_comprehension"
  | "image_question"
  | "table_question"
  | "graph_question";
export type Question = {
  id: string;
  topic_id: string;
  kind: QuestionKind;
  prompt: string;
  passage?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  difficulty: "easy" | "medium" | "hard";
  payload: {
    image?: string;
    table?: string[][];
    points?: { x: number; y: number }[];
    pairs?: { left: string; right: string }[];
  };
};
