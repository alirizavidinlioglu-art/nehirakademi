import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { appOrigin } from "@/lib/environment";
import { outboundFetch } from "@/lib/outbound";
import { query, database, uuid } from "@/lib/db";
import {
  requireUser,
  currentUser,
  createSession,
  hashToken,
  studentScope,
  checkOrigin,
  HttpError,
} from "@/lib/auth";
import { dashboard } from "@/services/analytics";
import {
  generateQuestion,
  generatedQuestionSchema,
  teach,
  validateQuestionShape,
} from "@/services/ai";
import {
  gradeAnswer,
  masteryUpdate,
  nextReview,
  localDay,
} from "@/lib/learning";
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
const idSchema = z.uuid();
const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});
const nodeSchema = z.object({
  parent_id: z.uuid().nullable(),
  kind: z.enum([
    "subject",
    "unit",
    "topic",
    "subtopic",
    "outcome",
    "skill",
    "content",
  ]),
  title: z.string().min(2).max(500),
  grade: z.union([z.literal(7), z.literal(8)]),
  subject: z.string().min(2).max(100),
  code: z.string().max(80).nullable(),
  source_url: z.url().nullable(),
  academic_year: z.string().regex(/^\d{4}-\d{4}$/),
  curriculum_version: z.string().min(1).max(100),
  verified: z.boolean(),
  payload: z.record(z.string(), z.unknown()),
});
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function body(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) return {};
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 3 * 1024 * 1024) {
      await reader.cancel();
      throw new HttpError(413, "Gönderilen veri çok büyük.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Geçerli JSON gerekli.");
  }
}
async function limited(identifier: string, max = 10) {
  const rows = await query(
    "SELECT count(*)::int AS n FROM auth_events WHERE identifier=$1 AND created_at>now()-interval '15 minutes'",
    [identifier],
  );
  if (Number(rows[0].n) >= max)
    throw new HttpError(429, "Çok fazla deneme. 15 dakika sonra tekrar dene.");
  await query("INSERT INTO auth_events(id,identifier) VALUES($1,$2)", [
    uuid(),
    identifier,
  ]);
}
async function ownTest(id: string, studentId: string) {
  idSchema.parse(id);
  const rows = await query(
    "SELECT t.*,s.started_at,s.completed_at FROM tests t JOIN test_sessions s ON s.test_id=t.id WHERE t.id=$1 AND t.student_id=$2 AND s.student_id=$2 AND t.archived=false",
    [id, studentId],
  );
  if (!rows.length) throw new HttpError(404, "Test bulunamadı.");
  if (!rows[0].started_at) {
    const started = await query(
      "UPDATE test_sessions SET started_at=coalesce(started_at,now()),updated_at=now() WHERE test_id=$1 AND student_id=$2 RETURNING started_at",
      [id, studentId],
    );
    rows[0].started_at = started[0].started_at;
  }
  return rows[0];
}
async function completeTest(testId: string, studentId: string) {
  const db = await database();
  return db.transaction(async (tx) => {
    const session = (
      await tx.query(
        "SELECT * FROM test_sessions WHERE test_id=$1 AND student_id=$2 FOR UPDATE",
        [testId, studentId],
      )
    )[0];
    if (!session) throw new HttpError(404, "Test bulunamadı.");
    if (!session.completed_at) {
      await tx.query(
        "INSERT INTO question_attempts(id,test_id,question_id,student_id,correct,skipped,response_ms) SELECT gen_random_uuid(),tq.test_id,tq.question_id,$2,false,true,0 FROM test_questions tq WHERE tq.test_id=$1 AND NOT EXISTS (SELECT 1 FROM question_attempts a WHERE a.test_id=tq.test_id AND a.question_id=tq.question_id AND a.student_id=$2)",
        [testId, studentId],
      );
      await tx.query(
        "UPDATE test_sessions SET completed_at=now(),updated_at=now() WHERE test_id=$1 AND student_id=$2",
        [testId, studentId],
      );
      await tx.query(
        "INSERT INTO study_sessions(id,student_id,test_id,duration_ms) SELECT $1,$2,$3,coalesce(sum(response_ms),0) FROM question_attempts WHERE test_id=$3 AND student_id=$2",
        [uuid(), studentId, testId],
      );
      const perfect = await tx.query(
        "SELECT count(*)::int n,bool_and(correct) perfect FROM question_attempts WHERE test_id=$1 AND student_id=$2",
        [testId, studentId],
      );
      if (Number(perfect[0].n) >= 10 && perfect[0].perfect)
        await tx.query(
          "INSERT INTO student_badges(student_id,badge_id) SELECT $1,id FROM badges WHERE kind=$2 ON CONFLICT DO NOTHING",
          [studentId, "perfect"],
        );
    }
    return { completed: true };
  });
}
async function handle(req: Request, segments: string[]) {
  const route = segments.join("/"),
    method = req.method,
    url = new URL(req.url);
  if (method !== "GET") checkOrigin(req);
  if (route === "auth/login" && method === "POST") {
    const data = loginSchema.parse(await body(req));
    const email = data.email.toLowerCase();
    await limited("login:" + email);
    const user = (
      await query("SELECT * FROM users WHERE email=$1", [email])
    )[0];
    if (
      !user ||
      !(await bcrypt.compare(data.password, String(user.password_hash)))
    )
      throw new HttpError(401, "E-posta veya parola doğru değil.");
    await createSession(String(user.id));
    // Only failed login attempts should accumulate toward the lockout limit.
    await query("DELETE FROM auth_events WHERE identifier=$1", [
      "login:" + email,
    ]);
    return json({ ok: true });
  }
  if (route === "auth/logout" && method === "POST") {
    const token = (await cookies()).get("nehir_session")?.value;
    if (token)
      await query("DELETE FROM sessions WHERE token_hash=$1", [
        hashToken(token),
      ]);
    (await cookies()).delete("nehir_session");
    return json({ ok: true });
  }
  if (route === "auth/reset-request" && method === "POST") {
    const { email } = z.object({ email: z.email() }).parse(await body(req));
    await limited("reset:" + email.toLowerCase(), 3);
    const user = (
      await query("SELECT id FROM users WHERE email=$1", [email.toLowerCase()])
    )[0];
    if (user) {
      const token = randomBytes(32).toString("hex");
      await query(
        "INSERT INTO password_resets(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",
        [uuid(), user.id, hashToken(token)],
      );
      const link = appOrigin(req.url) + "/reset?token=" + token;
      if (process.env.EMAIL_API_KEY && process.env.EMAIL_FROM) {
        const sent = await outboundFetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + process.env.EMAIL_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: email,
            subject: "Nehir Akademi · Parola yenileme",
            text:
              "Parolanı yenilemek için: " +
              link +
              "\nBu bağlantı 30 dakika geçerlidir.",
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!sent.ok) console.error("Password reset email delivery failed");
      } else if (
        process.env.NODE_ENV !== "production" ||
        (process.env.DEV_MAIL_OUTBOX === "true" && !process.env.VERCEL)
      ) {
        const dir = path.resolve(
          process.env.DEV_MAIL_OUTBOX_PATH || ".local/mail-outbox",
        );
        await mkdir(dir, { recursive: true });
        await writeFile(
          path.join(dir, uuid() + ".json"),
          JSON.stringify({ to: email, link }),
          { mode: 0o600 },
        );
      }
    }
    return json({
      message: "Hesap varsa parola yenileme bağlantısı gönderilir.",
    });
  }
  if (route === "auth/reset" && method === "POST") {
    const { token, password } = z
      .object({
        token: z.string().length(64),
        password: z.string().min(12).max(128),
      })
      .parse(await body(req));
    const passwordHash = await bcrypt.hash(password, 12);
    await (
      await database()
    ).transaction(async (tx) => {
      const reset = (
        await tx.query(
          "SELECT * FROM password_resets WHERE token_hash=$1 AND expires_at>now() AND used=false FOR UPDATE",
          [hashToken(token)],
        )
      )[0];
      if (!reset)
        throw new HttpError(400, "Bağlantı geçersiz veya süresi dolmuş.");
      await tx.query(
        "UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2",
        [passwordHash, reset.user_id],
      );
      await tx.query("UPDATE password_resets SET used=true WHERE user_id=$1", [
        reset.user_id,
      ]);
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [reset.user_id]);
    });
    return json({ ok: true });
  }
  if (route === "auth/me" && method === "GET")
    return json({
      user: await currentUser(),
      aiReady: Boolean(process.env.AI_API_KEY),
    });
  const user = await requireUser();
  if (route === "profile" && method === "GET") {
    const p = (
      await query("SELECT preferences FROM users WHERE id=$1", [user.id])
    )[0];
    return json(p);
  }
  if (route === "profile" && method === "PUT") {
    const data = z
      .object({
        daily_minutes: z
          .union([z.literal(20), z.literal(30), z.literal(45), z.literal(60)])
          .optional(),
        grade: z.union([z.literal(7), z.literal(8)]).optional(),
        preferences: z
          .object({
            mascotMinimized: z.boolean().optional(),
            onboarded: z.boolean().optional(),
          })
          .optional(),
      })
      .parse(await body(req));
    await query(
      "UPDATE users SET daily_minutes=coalesce($1,daily_minutes),grade=coalesce($2,grade),preferences=preferences||$3::jsonb,updated_at=now() WHERE id=$4",
      [
        data.daily_minutes ?? null,
        data.grade ?? null,
        JSON.stringify(data.preferences ?? {}),
        user.id,
      ],
    );
    return json({ ok: true });
  }
  if (route === "students" && method === "GET") {
    return json(
      user.role === "STUDENT"
        ? [user]
        : user.role === "PARENT"
          ? await query(
              "SELECT u.id,u.name,u.grade FROM users u JOIN parent_student_links l ON l.student_id=u.id WHERE l.parent_id=$1",
              [user.id],
            )
          : await query("SELECT id,name,grade FROM users WHERE role=$1", [
              "STUDENT",
            ]),
    );
  }
  if (route === "dashboard" && method === "GET") {
    const sid = await studentScope(
      user,
      url.searchParams.get("student") ?? undefined,
    );
    return json(await dashboard(sid));
  }
  if (route === "curriculum" && method === "GET") {
    const grade = z.coerce
      .number()
      .int()
      .min(7)
      .max(8)
      .parse(url.searchParams.get("grade") ?? user.grade);
    const parent = url.searchParams.get("parent");
    if (parent) idSchema.parse(parent);
    return json(
      await query(
        "SELECT * FROM curriculum_nodes WHERE grade=$1 AND ($2::uuid IS NULL OR parent_id=$2) ORDER BY created_at,title",
        [grade, parent],
      ),
    );
  }
  if (route === "topic" && method === "GET") {
    const id = idSchema.parse(url.searchParams.get("id"));
    const topic = (
      await query("SELECT * FROM curriculum_nodes WHERE id=$1", [id])
    )[0];
    if (!topic) throw new HttpError(404, "Konu bulunamadı.");
    return json({
      topic,
      children: await query(
        "SELECT * FROM curriculum_nodes WHERE parent_id=$1",
        [id],
      ),
      mastery:
        user.role === "STUDENT"
          ? ((
              await query(
                "SELECT * FROM student_topic_mastery WHERE student_id=$1 AND topic_id=$2",
                [user.id, id],
              )
            )[0] ?? null)
          : null,
    });
  }
  if (route === "wrongs" && method === "GET") {
    const sid = await studentScope(
      user,
      url.searchParams.get("student") ?? undefined,
    );
    const subject = url.searchParams.get("subject");
    const topic = url.searchParams.get("topic");
    const from = url.searchParams.get("from");
    if (topic) idSchema.parse(topic);
    if (from)
      z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .parse(from);
    return json(
      await query(
        "SELECT a.*,q.prompt,q.explanation,q.answer AS expected,n.title AS topic,n.subject,q.topic_id FROM question_attempts a JOIN questions q ON q.id=a.question_id JOIN curriculum_nodes n ON n.id=q.topic_id WHERE a.student_id=$1 AND NOT a.correct AND NOT a.skipped AND ($2::text IS NULL OR n.subject=$2) AND ($3::uuid IS NULL OR n.id=$3) AND ($4::date IS NULL OR a.created_at>=$4::date) ORDER BY a.created_at DESC LIMIT 200",
        [sid, subject || null, topic || null, from || null],
      ),
    );
  }
  if (route === "tests" && method === "GET") {
    await requireUser(["STUDENT"]);
    return json(
      await query(
        "SELECT t.id,t.title,t.mode,t.created_at,t.time_limit,s.started_at,s.completed_at,(SELECT count(*)::int FROM test_questions tq WHERE tq.test_id=t.id) AS count,(SELECT count(*)::int FROM question_attempts a WHERE a.test_id=t.id AND a.student_id=$1) AS answered FROM tests t JOIN test_sessions s ON s.test_id=t.id WHERE t.student_id=$1 AND s.student_id=$1 AND NOT t.archived ORDER BY t.created_at DESC LIMIT 100",
        [user.id],
      ),
    );
  }
  if (route === "tests" && method === "POST") {
    await requireUser(["STUDENT"]);
    const data = z
      .object({
        topic_id: z.uuid().optional(),
        subject: z.string().max(100).optional(),
        count: z
          .union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)])
          .default(10),
        difficulty: z
          .enum(["easy", "medium", "hard", "mixed"])
          .default("mixed"),
        mode: z
          .enum(["practice", "wrongs", "review", "mock"])
          .default("practice"),
      })
      .parse(await body(req));
    const grade = user.grade;
    if (data.topic_id) {
      const node = (
        await query(
          "SELECT grade FROM curriculum_nodes WHERE id=$1 AND kind=$2",
          [data.topic_id, "topic"],
        )
      )[0];
      if (!node || Number(node.grade) !== grade)
        throw new HttpError(400, "Bu sınıfta konu bulunamadı.");
    }
    const bank = await query(
      "SELECT q.id,q.topic_id FROM questions q JOIN curriculum_nodes n ON n.id=q.topic_id WHERE n.grade=$1 AND q.status IN('approved','validated') AND ($2::uuid IS NULL OR q.topic_id=$2) AND ($3::text IS NULL OR n.subject=$3) AND ($4='mixed' OR q.difficulty=$4) AND ($5<>'wrongs' OR EXISTS(SELECT 1 FROM question_attempts a JOIN questions old ON old.id=a.question_id WHERE a.student_id=$6 AND NOT a.correct AND NOT a.skipped AND old.topic_id=q.topic_id) AND NOT EXISTS(SELECT 1 FROM question_attempts a WHERE a.student_id=$6 AND a.question_id=q.id)) ORDER BY random() LIMIT $7",
      [
        grade,
        data.topic_id ?? null,
        data.subject ?? null,
        data.difficulty,
        data.mode,
        user.id,
        data.count,
      ],
    );
    if (bank.length < data.count && data.topic_id && !process.env.VERCEL) {
      for (let i = bank.length; i < data.count; i++) {
        const id = await generateQuestion(
          user.id,
          data.topic_id,
          data.difficulty,
          "multiple_choice",
          await database(),
        );
        bank.push({ id, topic_id: data.topic_id });
      }
    }
    if (bank.length < data.count)
      throw new HttpError(
        409,
        "Bu seçim için yeterli doğrulanmış soru yok. Admin soru bankasını tamamlamalı.",
      );
    const id = uuid();
    await (
      await database()
    ).transaction(async (tx) => {
      await tx.query(
        "INSERT INTO tests(id,student_id,title,topic_id,mode,time_limit) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id,
          user.id,
          data.mode === "mock" ? "Deneme çalışması" : "Konu testi",
          data.topic_id ?? null,
          data.mode,
          data.mode === "mock" ? data.count * 90 : null,
        ],
      );
      await tx.query(
        "INSERT INTO test_sessions(id,test_id,student_id) VALUES($1,$2,$3)",
        [uuid(), id, user.id],
      );
      for (let i = 0; i < bank.length; i++)
        await tx.query(
          "INSERT INTO test_questions(test_id,question_id,position) VALUES($1,$2,$3)",
          [id, bank[i].id, i],
        );
    });
    return json({ id }, 201);
  }
  if (segments[0] === "tests" && segments[1]) {
    await requireUser(["STUDENT"]);
    const id = segments[1];
    const test = await ownTest(id, user.id);
    if (segments.length === 2 && method === "GET") {
      if (
        test.time_limit &&
        !test.completed_at &&
        Date.now() - new Date(String(test.started_at)).getTime() >
          Number(test.time_limit) * 1000
      ) {
        await completeTest(id, user.id);
        test.completed_at = new Date().toISOString();
      }
      const questions = await query(
        "SELECT q.id,q.topic_id,q.kind,q.prompt,q.options,q.difficulty,q.passage,q.payload,tq.position,a.id AS attempt_id,a.correct,a.skipped,a.answer AS given_answer,a.help_level,a.response_ms FROM test_questions tq JOIN questions q ON q.id=tq.question_id LEFT JOIN question_attempts a ON a.question_id=q.id AND a.test_id=tq.test_id AND a.student_id=$2 WHERE tq.test_id=$1 ORDER BY tq.position",
        [id, user.id],
      );
      return json({
        test,
        questions,
        results: test.completed_at
          ? await query(
              "SELECT a.*,q.prompt,q.answer AS expected,q.explanation FROM question_attempts a JOIN questions q ON q.id=a.question_id WHERE a.test_id=$1 AND a.student_id=$2",
              [id, user.id],
            )
          : null,
      });
    }
    if (segments[2] === "complete" && method === "POST")
      return json(await completeTest(id, user.id));
    if (segments[2] === "attempt" && method === "POST") {
      const data = z
        .object({
          question_id: z.uuid(),
          answer: z.string().max(3000).default(""),
          skip: z.boolean().default(false),
        })
        .parse(await body(req));
      const result = await (
        await database()
      ).transaction(async (tx) => {
        await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
          user.id,
        ]);
        const session = (
          await tx.query(
            "SELECT * FROM test_sessions WHERE test_id=$1 AND student_id=$2 FOR UPDATE",
            [id, user.id],
          )
        )[0];
        if (session.completed_at)
          throw new HttpError(409, "Test zaten tamamlandı.");
        if (
          test.time_limit &&
          Date.now() - new Date(String(session.started_at)).getTime() >
            Number(test.time_limit) * 1000
        )
          throw new HttpError(
            409,
            "Deneme süresi doldu. Testi bitirerek sonuçlarını görebilirsin.",
          );
        const q = (
          await tx.query(
            "SELECT q.* FROM questions q JOIN test_questions tq ON tq.question_id=q.id WHERE tq.test_id=$1 AND q.id=$2",
            [id, data.question_id],
          )
        )[0];
        if (!q) throw new HttpError(404, "Soru bu testte bulunamadı.");
        const old = await tx.query(
          "SELECT id FROM question_attempts WHERE test_id=$1 AND question_id=$2 AND student_id=$3",
          [id, q.id, user.id],
        );
        if (old.length) throw new HttpError(409, "Bu soru zaten cevaplandı.");
        const firstUnanswered = (
          await tx.query(
            "SELECT tq.question_id FROM test_questions tq WHERE tq.test_id=$1 AND NOT EXISTS(SELECT 1 FROM question_attempts a WHERE a.test_id=tq.test_id AND a.question_id=tq.question_id AND a.student_id=$2) ORDER BY tq.position LIMIT 1",
            [id, user.id],
          )
        )[0];
        if (firstUnanswered?.question_id !== q.id)
          throw new HttpError(409, "Önce sıradaki soruyu cevapla.");
        const previous = (
          await tx.query(
            "SELECT max(created_at) AS last FROM question_attempts WHERE test_id=$1 AND student_id=$2",
            [id, user.id],
          )
        )[0];
        const responseMs = Math.max(
          0,
          Math.min(
            3600000,
            Date.now() -
              new Date(String(previous.last ?? session.started_at)).getTime(),
          ),
        );
        const hints = (
          await tx.query(
            "SELECT coalesce(max(help_level),0)::int AS level FROM ai_messages m JOIN ai_conversations c ON c.id=m.conversation_id WHERE c.student_id=$1 AND c.question_id=$2 AND c.test_id=$3 AND m.role=$4",
            [user.id, q.id, id, "assistant"],
          )
        )[0];
        const help = Number(hints.level);
        const correct =
          !data.skip &&
          gradeAnswer(String(q.kind), data.answer, String(q.answer));
        const errorType = correct || data.skip ? null : "unclassified";
        await tx.query(
          "INSERT INTO question_attempts(id,test_id,question_id,student_id,answer,correct,skipped,help_level,response_ms,error_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [
            uuid(),
            id,
            q.id,
            user.id,
            data.answer,
            correct,
            data.skip,
            help,
            responseMs,
            errorType,
          ],
        );
        const current = (
          await tx.query(
            "SELECT * FROM student_topic_mastery WHERE student_id=$1 AND topic_id=$2 FOR UPDATE",
            [user.id, q.topic_id],
          )
        )[0];
        const repeated = (
          await tx.query(
            "SELECT count FROM student_error_patterns WHERE student_id=$1 AND topic_id=$2 AND error_type=$3",
            [user.id, q.topic_id, errorType ?? "unclassified"],
          )
        )[0];
        const score = masteryUpdate(Number(current?.score ?? 0), {
          correct,
          skipped: data.skip,
          difficulty: String(q.difficulty),
          help,
          responseMs,
          repeatedError: Number(repeated?.count ?? 0) > 1,
        });
        await tx.query(
          "INSERT INTO student_topic_mastery(student_id,topic_id,score,attempt_count) VALUES($1,$2,$3,1) ON CONFLICT(student_id,topic_id) DO UPDATE SET score=$3,attempt_count=student_topic_mastery.attempt_count+1,updated_at=now()",
          [user.id, q.topic_id, score],
        );
        if (errorType)
          await tx.query(
            "INSERT INTO student_error_patterns(student_id,topic_id,error_type,count) VALUES($1,$2,$3,1) ON CONFLICT(student_id,topic_id,error_type) DO UPDATE SET count=student_error_patterns.count+1,updated_at=now()",
            [user.id, q.topic_id, errorType],
          );
        const review = (
          await tx.query(
            "SELECT * FROM review_queue WHERE student_id=$1 AND topic_id=$2",
            [user.id, q.topic_id],
          )
        )[0];
        if (!correct || review) {
          const next = nextReview(
            Number(review?.interval_index ?? -1),
            correct,
            help,
          );
          await tx.query(
            "INSERT INTO review_queue(student_id,topic_id,interval_index,due_at) VALUES($1,$2,$3,now()+$4::int*interval '1 day') ON CONFLICT(student_id,topic_id) DO UPDATE SET interval_index=$3,due_at=now()+$4::int*interval '1 day',last_review_at=now(),updated_at=now()",
            [user.id, q.topic_id, next.index, next.days],
          );
        }
        const day = localDay();
        await tx.query(
          "INSERT INTO streaks(student_id,current_days,best_days,last_day) VALUES($1,1,1,$2::date) ON CONFLICT(student_id) DO UPDATE SET current_days=CASE WHEN streaks.last_day=$2::date THEN streaks.current_days WHEN streaks.last_day=$2::date-1 THEN streaks.current_days+1 ELSE 1 END,best_days=greatest(streaks.best_days,CASE WHEN streaks.last_day=$2::date THEN streaks.current_days WHEN streaks.last_day=$2::date-1 THEN streaks.current_days+1 ELSE 1 END),last_day=$2::date,updated_at=now()",
          [user.id, day],
        );
        await tx.query(
          "INSERT INTO student_badges(student_id,badge_id) SELECT $1,b.id FROM badges b WHERE (b.kind='questions' AND b.threshold<=(SELECT count(*) FROM question_attempts WHERE student_id=$1)) OR (b.kind='streak' AND b.threshold<=(SELECT current_days FROM streaks WHERE student_id=$1)) ON CONFLICT DO NOTHING",
          [user.id],
        );
        return {
          correct,
          skipped: data.skip,
          expected: q.answer,
          explanation: q.explanation,
          mastery: score,
          help_level: help,
        };
      });
      return json(result);
    }
  }
  if (route === "plan" && method === "POST") {
    await requireUser(["STUDENT"]);
    const { minutes } = z
      .object({
        minutes: z.union([
          z.literal(20),
          z.literal(30),
          z.literal(45),
          z.literal(60),
        ]),
      })
      .parse(await body(req));
    const topics = await query(
      "SELECT n.id,n.title,n.subject,coalesce(m.score,0) AS score,r.due_at FROM curriculum_nodes n LEFT JOIN student_topic_mastery m ON m.topic_id=n.id AND m.student_id=$1 LEFT JOIN review_queue r ON r.topic_id=n.id AND r.student_id=$1 WHERE n.kind=$2 AND n.grade=$3 AND EXISTS(SELECT 1 FROM questions q WHERE q.topic_id=n.id AND q.status IN('approved','validated')) ORDER BY r.due_at NULLS LAST,m.score NULLS FIRST LIMIT 4",
      [user.id, "topic", user.grade],
    );
    const exams = await query(
      "SELECT topic_ids,due_at FROM exams WHERE student_id=$1 AND due_at>=current_date ORDER BY due_at LIMIT 1",
      [user.id],
    );
    const examTopics = (exams[0]?.topic_ids ?? []) as string[];
    topics.sort(
      (a, b) =>
        Number(examTopics.includes(String(b.id))) -
        Number(examTopics.includes(String(a.id))),
    );
    const items = topics
      .slice(0, Math.max(1, Math.floor(minutes / 10)))
      .map((t) => ({
        topic_id: t.id,
        title: t.title,
        subject: t.subject,
        minutes: Math.floor(
          minutes /
            Math.min(topics.length, Math.max(1, Math.floor(minutes / 10))),
        ),
        count: 5,
        review: Boolean(t.due_at),
        exam: examTopics.includes(String(t.id)),
      }));
    await query(
      "INSERT INTO study_plans(id,student_id,day,minutes,items) VALUES($1,$2,$3,$4,$5) ON CONFLICT(student_id,day) DO UPDATE SET minutes=$4,items=$5,updated_at=now()",
      [uuid(), user.id, localDay(), minutes, JSON.stringify(items)],
    );
    await query("UPDATE users SET daily_minutes=$1 WHERE id=$2", [
      minutes,
      user.id,
    ]);
    return json({ minutes, items });
  }
  if (["homeworks", "exams"].includes(segments[0])) {
    const table = segments[0];
    if (method === "GET") {
      const sid = await studentScope(
        user,
        url.searchParams.get("student") ?? undefined,
      );
      return json(
        await query(
          `SELECT * FROM ${table} WHERE student_id=$1 ORDER BY due_at`,
          [sid],
        ),
      );
    }
    await requireUser(["STUDENT"]);
    if (method === "POST") {
      const d = z
        .object({
          title: z.string().min(2).max(250),
          subject: z.string().min(2).max(100),
          due_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          topic_ids: z.array(z.uuid()).max(100).default([]),
        })
        .parse(await body(req));
      const id = uuid();
      if (table === "homeworks")
        await query(
          "INSERT INTO homeworks(id,student_id,title,subject,due_at) VALUES($1,$2,$3,$4,$5)",
          [id, user.id, d.title, d.subject, d.due_at],
        );
      else {
        if (d.topic_ids.length) {
          const valid = await query(
            "SELECT id FROM curriculum_nodes WHERE id=ANY($1::uuid[]) AND grade=$2 AND subject=$3 AND kind=$4",
            [d.topic_ids, user.grade, d.subject, "topic"],
          );
          if (valid.length !== d.topic_ids.length)
            throw new HttpError(
              400,
              "Sınav konuları seçilen derse ve sınıfa ait olmalı.",
            );
        }
        await query(
          "INSERT INTO exams(id,student_id,title,subject,due_at,topic_ids) VALUES($1,$2,$3,$4,$5,$6)",
          [
            id,
            user.id,
            d.title,
            d.subject,
            d.due_at,
            JSON.stringify(d.topic_ids),
          ],
        );
      }
      return json({ id }, 201);
    }
    const id = idSchema.parse(segments[1]);
    if (method === "DELETE") {
      const deleted = await query(
        `DELETE FROM ${table} WHERE id=$1 AND student_id=$2 RETURNING id`,
        [id, user.id],
      );
      if (!deleted.length) throw new HttpError(404, "Kayıt bulunamadı.");
      return json({ ok: true });
    }
    if (method === "PUT" && table === "homeworks") {
      const { completed } = z
        .object({ completed: z.boolean() })
        .parse(await body(req));
      const updated = await query(
        "UPDATE homeworks SET completed=$1,updated_at=now() WHERE id=$2 AND student_id=$3 RETURNING id",
        [completed, id, user.id],
      );
      if (!updated.length) throw new HttpError(404, "Ödev bulunamadı.");
      return json({ ok: true });
    }
  }
  if (route === "teacher" && method === "POST") {
    await requireUser(["STUDENT"]);
    const d = z
      .object({
        message: z.string().min(1).max(2000),
        conversation_id: z.uuid().optional(),
        topic_id: z.uuid().optional(),
        image: z.string().max(2800000).optional(),
        test_id: z.uuid().optional(),
        question_id: z.uuid().optional(),
      })
      .parse(await body(req));
    await limited("teacher:" + user.id, 20);
    let questionContext: unknown;
    if (d.question_id || d.test_id) {
      if (!d.question_id || !d.test_id)
        throw new HttpError(400, "Test ve soru birlikte seçilmeli.");
      await ownTest(d.test_id, user.id);
      const q = (
        await query(
          "SELECT q.* FROM questions q JOIN test_questions tq ON tq.question_id=q.id WHERE tq.test_id=$1 AND q.id=$2",
          [d.test_id, d.question_id],
        )
      )[0];
      if (!q) throw new HttpError(404, "Soru bulunamadı.");
      d.topic_id = String(q.topic_id);
      questionContext = {
        prompt: q.prompt,
        answer: q.answer,
        explanation: q.explanation,
      };
    }
    let conv = d.conversation_id;
    if (conv) {
      const c = (
        await query(
          "SELECT * FROM ai_conversations WHERE id=$1 AND student_id=$2",
          [conv, user.id],
        )
      )[0];
      if (!c) throw new HttpError(404, "Konuşma bulunamadı.");
      if (
        (c.test_id ?? null) !== (d.test_id ?? null) ||
        (c.question_id ?? null) !== (d.question_id ?? null)
      )
        throw new HttpError(400, "Konuşmanın sorusu değiştirilemez.");
      if (d.topic_id && c.topic_id !== d.topic_id)
        throw new HttpError(400, "Konuşmanın konusu değiştirilemez.");
      d.topic_id = c.topic_id ? String(c.topic_id) : undefined;
    }
    if (d.topic_id) {
      const n = (
        await query("SELECT grade FROM curriculum_nodes WHERE id=$1", [
          d.topic_id,
        ])
      )[0];
      if (!n || n.grade !== user.grade)
        throw new HttpError(400, "Konu bulunamadı.");
    }
    if (d.image) {
      const match =
        /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(d.image);
      if (!match)
        throw new HttpError(400, "PNG, JPEG veya WebP fotoğraf yükle.");
      const buf = Buffer.from(match[2], "base64");
      const valid =
        match[1] === "png"
          ? buf
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : match[1] === "jpeg"
            ? buf[0] === 255 && buf[1] === 216 && buf[2] === 255
            : buf.toString("ascii", 0, 4) === "RIFF" &&
              buf.toString("ascii", 8, 12) === "WEBP";
      if (!valid || buf.length > 2 * 1024 * 1024)
        throw new HttpError(400, "Geçerli, en fazla 2 MB bir fotoğraf seç.");
    }
    const history = conv
      ? await query(
          "SELECT role,content,help_level FROM ai_messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 6",
          [conv],
        )
      : [];
    const level = Math.min(
      5,
      Math.max(0, ...history.map((h) => Number(h.help_level))) + 1,
    );
    const result = await teach(
      user.id,
      d.message,
      level,
      d.topic_id,
      d.image,
      history.reverse(),
      questionContext,
    );
    if (!conv) {
      conv = uuid();
      await query(
        "INSERT INTO ai_conversations(id,student_id,topic_id,test_id,question_id) VALUES($1,$2,$3,$4,$5)",
        [
          conv,
          user.id,
          d.topic_id ?? null,
          d.test_id ?? null,
          d.question_id ?? null,
        ],
      );
    }
    await (
      await database()
    ).transaction(async (tx) => {
      await tx.query(
        "INSERT INTO ai_messages(id,conversation_id,role,content,help_level) VALUES($1,$2,$3,$4,$5)",
        [uuid(), conv, "user", d.message, level],
      );
      await tx.query(
        "INSERT INTO ai_messages(id,conversation_id,role,content,help_level) VALUES($1,$2,$3,$4,$5)",
        [uuid(), conv, "assistant", result.message, level],
      );
    });
    return json({ ...result, conversation_id: conv, level });
  }
  if (route === "teacher" && method === "GET") {
    const sid = await studentScope(
      user,
      url.searchParams.get("student") ?? undefined,
    );
    return json(
      await query(
        "SELECT c.id,c.created_at,n.title AS topic FROM ai_conversations c LEFT JOIN curriculum_nodes n ON n.id=c.topic_id WHERE c.student_id=$1 ORDER BY c.created_at DESC LIMIT 20",
        [sid],
      ),
    );
  }
  if (segments[0] === "admin") {
    await requireUser(["ADMIN"]);
    const resource = segments[1];
    if (resource === "overview" && method === "GET") {
      return json({
        counts: await query(
          "SELECT (SELECT count(*)::int FROM users) AS users,(SELECT count(*)::int FROM questions) AS questions,(SELECT count(*)::int FROM curriculum_nodes WHERE verified) AS verified_nodes,(SELECT count(*)::int FROM tests) AS tests",
        ),
        usage: await query(
          "SELECT feature,model,count(*)::int AS calls,sum(input_tokens)::int AS input_tokens,sum(output_tokens)::int AS output_tokens,sum(estimated_cost)::float AS estimated_cost,bool_and(estimated_cost IS NOT NULL) AS pricing_known FROM ai_usage WHERE created_at>now()-interval '30 days' GROUP BY feature,model",
        ),
        dailyUsage: await query(
          "SELECT created_at::date::text AS day,count(*)::int AS calls FROM ai_usage WHERE created_at>now()-interval '30 days' GROUP BY day ORDER BY day",
        ),
      });
    }
    if (resource === "nodes") {
      if (method === "GET")
        return json(
          await query(
            "SELECT * FROM curriculum_nodes ORDER BY grade,created_at",
          ),
        );
      if (method === "DELETE") {
        const id = idSchema.parse(segments[2]);
        const used = await query(
          "SELECT tq.test_id FROM test_questions tq JOIN questions q ON q.id=tq.question_id JOIN curriculum_nodes n ON n.id=q.topic_id WHERE n.id IN (WITH RECURSIVE tree AS (SELECT id FROM curriculum_nodes WHERE id=$1 UNION ALL SELECT c.id FROM curriculum_nodes c JOIN tree t ON c.parent_id=t.id) SELECT id FROM tree) LIMIT 1",
          [id],
        );
        if (used.length)
          throw new HttpError(
            409,
            "Bu kaydın test geçmişi var; silmek yerine yeni müfredat sürümü oluştur.",
          );
        await query("DELETE FROM curriculum_nodes WHERE id=$1", [id]);
        return json({ ok: true });
      }
      if (method === "POST" || method === "PUT") {
        const d = nodeSchema.parse(await body(req));
        if (d.verified) {
          if (
            !d.source_url ||
            ![
              "tymm.meb.gov.tr",
              "mufredat.meb.gov.tr",
              "www.meb.gov.tr",
              "meb.gov.tr",
            ].includes(new URL(d.source_url).hostname) ||
            !d.source_url.startsWith("https://") ||
            d.curriculum_version === "DRAFT"
          )
            throw new HttpError(
              400,
              "Doğrulama için HTTPS resmî MEB kaynağı ve müfredat sürümü gerekli.",
            );
        }
        if (d.kind === "subject" && d.parent_id)
          throw new HttpError(400, "Dersin üst kaydı olamaz.");
        if (d.kind !== "subject" && !d.parent_id)
          throw new HttpError(400, "Üst kayıt gerekli.");
        if (d.parent_id) {
          const parent = (
            await query("SELECT * FROM curriculum_nodes WHERE id=$1", [
              d.parent_id,
            ])
          )[0];
          const expected: { [key: string]: string[] } = {
            unit: ["subject"],
            topic: ["unit"],
            subtopic: ["topic"],
            outcome: ["topic", "subtopic"],
            skill: ["outcome"],
            content: ["topic", "subtopic", "outcome"],
          };
          if (
            !parent ||
            parent.grade !== d.grade ||
            parent.subject !== d.subject ||
            !expected[d.kind]?.includes(String(parent.kind))
          )
            throw new HttpError(
              400,
              "Üst kayıt hiyerarşi, sınıf ve dersle uyuşmalı.",
            );
          if (segments[2] === d.parent_id)
            throw new HttpError(400, "Kayıt kendi üst kaydı olamaz.");
        }
        const id = method === "POST" ? uuid() : idSchema.parse(segments[2]);
        const params = [
          id,
          d.parent_id,
          d.kind,
          d.title,
          d.grade,
          d.subject,
          d.code,
          d.source_url,
          d.academic_year,
          d.curriculum_version,
          d.verified,
          JSON.stringify(d.payload),
        ];
        if (method === "POST")
          await query(
            "INSERT INTO curriculum_nodes(id,parent_id,kind,title,grade,subject,code,source_url,academic_year,curriculum_version,verified,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
            params,
          );
        else {
          const old = (
            await query(
              "SELECT kind,grade,subject FROM curriculum_nodes WHERE id=$1",
              [id],
            )
          )[0];
          if (!old) throw new HttpError(404, "Kayıt bulunamadı.");
          if (
            old.kind !== d.kind ||
            old.grade !== d.grade ||
            old.subject !== d.subject
          )
            throw new HttpError(
              400,
              "Tür, sınıf ve ders değişikliği için yeni kayıt oluştur.",
            );
          await query(
            "UPDATE curriculum_nodes SET parent_id=$2,title=$3,code=$4,source_url=$5,academic_year=$6,curriculum_version=$7,verified=$8,payload=$9,updated_at=now() WHERE id=$1",
            [
              id,
              d.parent_id,
              d.title,
              d.code,
              d.source_url,
              d.academic_year,
              d.curriculum_version,
              d.verified,
              JSON.stringify(d.payload),
            ],
          );
        }
        if (d.verified && d.source_url)
          await query(
            "INSERT INTO curriculum_sources(id,url,title,version,verified_at) VALUES($1,$2,$3,$4,now()) ON CONFLICT(url) DO UPDATE SET version=$4,verified_at=now(),updated_at=now()",
            [uuid(), d.source_url, d.title, d.curriculum_version],
          );
        return json({ id });
      }
    }
    if (resource === "questions") {
      if (method === "GET")
        return json(
          await query(
            "SELECT q.*,n.title AS topic,n.grade,n.subject FROM questions q JOIN curriculum_nodes n ON n.id=q.topic_id ORDER BY q.created_at DESC LIMIT 500",
          ),
        );
      if (method === "DELETE") {
        const id = idSchema.parse(segments[2]);
        const used = await query(
          "SELECT test_id FROM test_questions WHERE question_id=$1 LIMIT 1",
          [id],
        );
        if (used.length)
          await query(
            "UPDATE questions SET status=$1,updated_at=now() WHERE id=$2",
            ["rejected", id],
          );
        else await query("DELETE FROM questions WHERE id=$1", [id]);
        return json({ ok: true, archived: Boolean(used.length) });
      }
      if (method === "POST" || method === "PUT") {
        if (method === "PUT") {
          const used = await query(
            "SELECT test_id FROM test_questions WHERE question_id=$1 LIMIT 1",
            [idSchema.parse(segments[2])],
          );
          if (used.length)
            throw new HttpError(
              409,
              "Testte kullanılmış soru değiştirilemez. Düzeltilmiş soruyu yeni kayıt olarak ekle.",
            );
        }
        const d = z
          .object({
            topic_id: z.uuid(),
            question: generatedQuestionSchema,
            status: z.enum(["draft", "approved", "rejected"]).default("draft"),
          })
          .parse(await body(req));
        if (!validateQuestionShape(d.question))
          throw new HttpError(
            400,
            "Soru tipi, seçenekler veya cevap tutarsız.",
          );
        const topic = (
          await query(
            "SELECT id FROM curriculum_nodes WHERE id=$1 AND kind=$2",
            [d.topic_id, "topic"],
          )
        )[0];
        if (!topic) throw new HttpError(400, "Konu bulunamadı.");
        const q = d.question;
        const id = method === "POST" ? uuid() : idSchema.parse(segments[2]);
        if (method === "POST")
          await query(
            "INSERT INTO questions(id,topic_id,kind,prompt,options,answer,explanation,difficulty,passage,payload,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
            [
              id,
              d.topic_id,
              q.kind,
              q.prompt,
              JSON.stringify(q.options),
              q.answer,
              q.explanation,
              q.difficulty,
              q.passage,
              JSON.stringify(q.payload),
              d.status,
            ],
          );
        else
          await query(
            "UPDATE questions SET topic_id=$2,kind=$3,prompt=$4,options=$5,answer=$6,explanation=$7,difficulty=$8,passage=$9,payload=$10,status=$11,updated_at=now() WHERE id=$1",
            [
              id,
              d.topic_id,
              q.kind,
              q.prompt,
              JSON.stringify(q.options),
              q.answer,
              q.explanation,
              q.difficulty,
              q.passage,
              JSON.stringify(q.payload),
              d.status,
            ],
          );
        if (d.status === "approved")
          await query(
            "INSERT INTO question_validations(id,question_id,valid,report) VALUES($1,$2,true,$3)",
            [
              uuid(),
              id,
              JSON.stringify({
                reviewer: user.id,
                type: "manual_admin_approval",
              }),
            ],
          );
        return json({ id });
      }
    }
    if (resource === "generate" && method === "POST") {
      const d = z
        .object({
          topic_id: z.uuid(),
          difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
          kind: z.enum([
            "multiple_choice",
            "true_false",
            "fill_blank",
            "matching",
            "numeric",
            "short_answer",
            "reading_comprehension",
            "table_question",
            "graph_question",
          ]),
          count: z.number().int().min(1).max(20),
        })
        .parse(await body(req));
      const ids = [];
      for (let i = 0; i < d.count; i++)
        ids.push(
          await generateQuestion(
            user.id,
            d.topic_id,
            d.difficulty,
            d.kind,
            await database(),
          ),
        );
      return json({ ids });
    }
    if (resource === "users") {
      if (method === "GET")
        return json(
          await query(
            "SELECT id,name,email,role,grade,created_at FROM users ORDER BY created_at",
          ),
        );
      if (method === "POST") {
        const d = z
          .object({
            name: z.string().min(2).max(80),
            email: z.email(),
            role: z.enum(["STUDENT", "PARENT", "ADMIN"]),
            password: z.string().min(12).max(128),
            grade: z.union([z.literal(7), z.literal(8)]).default(7),
          })
          .parse(await body(req));
        const id = uuid();
        const hashed = await bcrypt.hash(d.password, 12);
        await (
          await database()
        ).transaction(async (tx) => {
          await tx.query(
            "INSERT INTO users(id,name,email,role,password_hash,grade) VALUES($1,$2,$3,$4,$5,$6)",
            [id, d.name, d.email.toLowerCase(), d.role, hashed, d.grade],
          );
          if (d.role === "STUDENT")
            await tx.query("INSERT INTO student_profiles(user_id) VALUES($1)", [
              id,
            ]);
          if (d.role === "PARENT")
            await tx.query("INSERT INTO parent_profiles(user_id) VALUES($1)", [
              id,
            ]);
        });
        return json({ id }, 201);
      }
      if (method === "PUT") {
        const d = z
          .object({
            name: z.string().min(2).max(80),
            grade: z.union([z.literal(7), z.literal(8)]),
          })
          .parse(await body(req));
        await query(
          "UPDATE users SET name=$1,grade=$2,updated_at=now() WHERE id=$3",
          [d.name, d.grade, idSchema.parse(segments[2])],
        );
        return json({ ok: true });
      }
      if (method === "DELETE") {
        const id = idSchema.parse(segments[2]);
        if (id === user.id)
          throw new HttpError(400, "Kendi hesabını bu ekrandan silemezsin.");
        await query("DELETE FROM users WHERE id=$1", [id]);
        return json({ ok: true });
      }
    }
    if (resource === "links") {
      if (method === "GET")
        return json(await query("SELECT * FROM parent_student_links"));
      const d = z
        .object({ parent_id: z.uuid(), student_id: z.uuid() })
        .parse(await body(req));
      if (method === "DELETE") {
        await query(
          "DELETE FROM parent_student_links WHERE parent_id=$1 AND student_id=$2",
          [d.parent_id, d.student_id],
        );
        return json({ ok: true });
      }
      const roles = await query(
        "SELECT id,role FROM users WHERE id=ANY($1::uuid[])",
        [[d.parent_id, d.student_id]],
      );
      if (
        !roles.some((r) => r.id === d.parent_id && r.role === "PARENT") ||
        !roles.some((r) => r.id === d.student_id && r.role === "STUDENT")
      )
        throw new HttpError(400, "Öğrenci ve ebeveyn rolleri doğrulanamadı.");
      await query(
        "INSERT INTO parent_student_links(parent_id,student_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [d.parent_id, d.student_id],
      );
      return json({ ok: true });
    }
    if (resource === "tests") {
      if (method === "GET")
        return json(
          await query(
            "SELECT t.*,u.name,(SELECT count(*)::int FROM question_attempts a WHERE a.test_id=t.id) AS answered FROM tests t JOIN users u ON u.id=t.student_id WHERE ($1::boolean OR NOT t.archived) ORDER BY t.created_at DESC LIMIT 200",
            [url.searchParams.get("include_archived") === "true"],
          ),
        );
      if (method === "POST") {
        const d = z
          .object({
            student_id: z.uuid(),
            topic_id: z.uuid(),
            title: z.string().min(2).max(200),
            count: z.union([
              z.literal(5),
              z.literal(10),
              z.literal(15),
              z.literal(20),
            ]),
            mode: z.enum(["practice", "mock"]).default("practice"),
          })
          .parse(await body(req));
        const student = (
          await query("SELECT grade FROM users WHERE id=$1 AND role=$2", [
            d.student_id,
            "STUDENT",
          ])
        )[0];
        const topic = (
          await query(
            "SELECT grade FROM curriculum_nodes WHERE id=$1 AND kind=$2",
            [d.topic_id, "topic"],
          )
        )[0];
        if (!student || !topic || student.grade !== topic.grade)
          throw new HttpError(400, "Öğrenci sınıfı ve konu uyuşmalı.");
        const bank = await query(
          "SELECT id FROM questions WHERE topic_id=$1 AND status IN('approved','validated') ORDER BY random() LIMIT $2",
          [d.topic_id, d.count],
        );
        if (bank.length < d.count)
          throw new HttpError(409, "Yeterli doğrulanmış soru yok.");
        const id = uuid();
        await (
          await database()
        ).transaction(async (tx) => {
          await tx.query(
            "INSERT INTO tests(id,student_id,title,topic_id,mode,time_limit) VALUES($1,$2,$3,$4,$5,$6)",
            [
              id,
              d.student_id,
              d.title,
              d.topic_id,
              d.mode,
              d.mode === "mock" ? d.count * 90 : null,
            ],
          );
          await tx.query(
            "INSERT INTO test_sessions(id,test_id,student_id,started_at) VALUES($1,$2,$3,NULL)",
            [uuid(), id, d.student_id],
          );
          for (let i = 0; i < bank.length; i++)
            await tx.query(
              "INSERT INTO test_questions(test_id,question_id,position) VALUES($1,$2,$3)",
              [id, bank[i].id, i],
            );
        });
        return json({ id }, 201);
      }
      if (method === "PUT") {
        const d = z
          .object({
            title: z.string().min(2).max(200).optional(),
            archived: z.boolean().optional(),
          })
          .parse(await body(req));
        const updated = await query(
          "UPDATE tests SET title=coalesce($1,title),archived=coalesce($2,archived),updated_at=now() WHERE id=$3 RETURNING id",
          [d.title ?? null, d.archived ?? null, idSchema.parse(segments[2])],
        );
        if (!updated.length) throw new HttpError(404, "Test bulunamadı.");
        return json({ ok: true });
      }
      if (method === "DELETE") {
        const updated = await query(
          "UPDATE tests SET archived=true,updated_at=now() WHERE id=$1 RETURNING id",
          [idSchema.parse(segments[2])],
        );
        if (!updated.length) throw new HttpError(404, "Test bulunamadı.");
        return json({ ok: true, archived: true });
      }
    }
    if (resource === "sources" && method === "GET")
      return json(
        await query(
          "SELECT * FROM curriculum_sources ORDER BY created_at DESC",
        ),
      );
  }
  throw new HttpError(404, "İşlem bulunamadı.");
}
async function dispatch(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    return await handle(req, (await ctx.params).path);
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        {
          error: "Alanları kontrol et.",
          details: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        400,
      );
    const code = (error as { code?: string }).code;
    if (code === "23505") return json({ error: "Bu kayıt zaten mevcut." }, 409);
    if (code === "23503")
      return json({ error: "İlişkili kayıt bulunamadı." }, 400);
    console.error(
      "API request failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return json({ error: "İşlem tamamlanamadı." }, 500);
  }
}
export {
  dispatch as GET,
  dispatch as POST,
  dispatch as PUT,
  dispatch as DELETE,
};
