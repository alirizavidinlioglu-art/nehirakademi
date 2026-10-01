import { query } from "@/lib/db";
import { localDay } from "@/lib/learning";
export async function dashboard(studentId: string) {
  const [
    totals,
    daily,
    weekly,
    mastery,
    review,
    homeworks,
    exams,
    badges,
    streak,
    subjects,
    plans,
    errors,
  ] = await Promise.all([
    query(
      `SELECT count(*)::int AS total,count(*) FILTER(WHERE correct)::int AS correct,count(*) FILTER(WHERE NOT correct AND NOT skipped)::int AS wrong,count(*) FILTER(WHERE skipped)::int AS blank,coalesce(sum(response_ms),0)::float AS duration FROM question_attempts WHERE student_id=$1`,
      [studentId],
    ),
    query(
      `SELECT count(*)::int AS total,count(*) FILTER(WHERE correct)::int AS correct,coalesce(sum(response_ms),0)::float AS duration FROM question_attempts WHERE student_id=$1 AND (created_at AT TIME ZONE 'Europe/Istanbul')::date=$2::date`,
      [studentId, localDay()],
    ),
    query(
      `SELECT (created_at AT TIME ZONE 'Europe/Istanbul')::date::text AS day,count(*)::int AS total,count(*) FILTER(WHERE correct)::int AS correct FROM question_attempts WHERE student_id=$1 AND created_at>now()-interval '30 days' GROUP BY day ORDER BY day`,
      [studentId],
    ),
    query(
      `SELECT m.*,n.title,n.subject FROM student_topic_mastery m JOIN curriculum_nodes n ON n.id=m.topic_id WHERE student_id=$1 ORDER BY score DESC`,
      [studentId],
    ),
    query(
      `SELECT r.*,n.title,n.subject FROM review_queue r JOIN curriculum_nodes n ON n.id=r.topic_id WHERE student_id=$1 AND due_at<=now() ORDER BY due_at`,
      [studentId],
    ),
    query(
      `SELECT * FROM homeworks WHERE student_id=$1 ORDER BY completed,due_at`,
      [studentId],
    ),
    query(`SELECT * FROM exams WHERE student_id=$1 ORDER BY due_at`, [
      studentId,
    ]),
    query(
      `SELECT b.*,sb.earned_at FROM badges b LEFT JOIN student_badges sb ON sb.badge_id=b.id AND sb.student_id=$1 ORDER BY b.threshold`,
      [studentId],
    ),
    query(`SELECT * FROM streaks WHERE student_id=$1`, [studentId]),
    query(
      `SELECT n.*,coalesce(s.solved,0)::int AS solved,coalesce(s.correct,0)::int AS correct,coalesce(m.score,0)::float AS mastery FROM curriculum_nodes n LEFT JOIN (SELECT t.subject,count(*) AS solved,count(*) FILTER(WHERE a.correct) AS correct FROM question_attempts a JOIN questions q ON q.id=a.question_id JOIN curriculum_nodes t ON t.id=q.topic_id WHERE a.student_id=$1 AND t.grade=(SELECT grade FROM users WHERE id=$1) GROUP BY t.subject)s ON s.subject=n.subject LEFT JOIN (SELECT t.subject,avg(m.score) AS score FROM student_topic_mastery m JOIN curriculum_nodes t ON t.id=m.topic_id WHERE m.student_id=$1 AND t.grade=(SELECT grade FROM users WHERE id=$1) GROUP BY t.subject)m ON m.subject=n.subject WHERE n.kind='subject' AND n.grade=(SELECT grade FROM users WHERE id=$1) ORDER BY n.created_at`,
      [studentId],
    ),
    query(`SELECT * FROM study_plans WHERE student_id=$1 AND day=$2::date`, [
      studentId,
      localDay(),
    ]),
    query(
      `SELECT e.*,n.title FROM student_error_patterns e JOIN curriculum_nodes n ON n.id=e.topic_id WHERE student_id=$1 ORDER BY count DESC`,
      [studentId],
    ),
  ]);
  return {
    totals: totals[0],
    daily: daily[0],
    weekly,
    mastery,
    review,
    homeworks,
    exams,
    badges,
    streak: streak[0]
      ? {
          ...streak[0],
          current_days:
            streak[0].last_day &&
            new Date(localDay()).getTime() -
              new Date(String(streak[0].last_day).slice(0, 10)).getTime() >
              86400000
              ? 0
              : streak[0].current_days,
        }
      : { current_days: 0, best_days: 0 },
    subjects,
    plan: plans[0] ?? null,
    errors,
  };
}
