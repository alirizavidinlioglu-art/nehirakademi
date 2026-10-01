import type { Node } from "./domain";
export type Totals = {
  total: number;
  correct: number;
  wrong: number;
  blank: number;
  duration: number;
};
export type Mastery = {
  topic_id: string;
  title: string;
  subject: string;
  score: number;
  attempt_count: number;
};
export type Task = {
  id: string;
  subject: string;
  title: string;
  due_at: string;
  completed: boolean;
  topic_ids?: string[];
};
export type PlanItem = {
  topic_id: string;
  title: string;
  subject: string;
  minutes: number;
  count: number;
  review: boolean;
  exam: boolean;
};
export type Badge = {
  id: string;
  title: string;
  threshold: number;
  kind: string;
  earned_at: string | null;
};
export type DashboardData = {
  totals: Totals;
  daily: { total: number; correct: number; duration: number };
  weekly: { day: string; total: number; correct: number }[];
  mastery: Mastery[];
  review: {
    topic_id: string;
    title: string;
    subject: string;
    due_at: string;
  }[];
  homeworks: Task[];
  exams: Task[];
  badges: Badge[];
  streak: { current_days: number; best_days: number; last_day?: string };
  subjects: (Node & { solved: number; correct: number; mastery: number })[];
  plan: { minutes: number; items: PlanItem[] } | null;
  errors: { title: string; error_type: string; count: number }[];
};
