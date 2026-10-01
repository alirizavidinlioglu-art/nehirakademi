"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock,
  Target,
  Flame,
  Check,
  BookOpen,
  Sparkles,
  CalendarDays,
  Plus,
  Trash2,
  Trophy,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Minus,
  FlaskConical,
  ClipboardList,
} from "lucide-react";
import { api } from "@/lib/client";
import { localDay, masteryLabel } from "@/lib/learning";
import { useResource } from "@/hooks/useResource";
import { tokenFor } from "@/config/design";
import type { User, Node, Question } from "@/types/domain";
import type { DashboardData, Task } from "@/types/ui";
import { MascotGuide } from "./mascot/MascotGuide";
import { useMascot } from "./mascot/MascotProvider";
import {
  Loading,
  ErrorBox,
  Empty,
  Progress,
  useAction,
  ActionStatus,
  dateLabel,
  percent,
} from "./ui";
import { MathText } from "./MathText";
import { QuestionRenderer } from "./tests/QuestionRenderer";
import { TeacherPage } from "./TeacherPage";
export function SubjectCard({
  node,
}: {
  node: Node & { solved?: number; correct?: number; mastery?: number };
}) {
  const t = tokenFor(node.subject);
  return (
    <Link
      href={"/dersler/" + node.id}
      className="subject-card"
      style={
        {
          "--subject": t.color,
          "--subject-bg": t.background,
        } as React.CSSProperties
      }
    >
      <div className="subject-card-top">
        <span className="subject-symbol">
          {node.subject === "Fen Bilimleri" ? (
            <FlaskConical size={23} />
          ) : (
            t.symbol
          )}
        </span>
        <ChevronRight size={19} />
      </div>
      <h3>{node.title}</h3>
      <p>
        {node.solved ?? 0} soru çözüldü <span>·</span>{" "}
        {node.solved
          ? `%${percent(node.correct ?? 0, node.solved)} başarı`
          : "İlk adımını at"}
      </p>
      <Progress value={node.mastery ?? 0} label="Konu hâkimiyeti" />
    </Link>
  );
}
export function DashboardPage({ user }: { user: User }) {
  const { data, error, loading } = useResource<DashboardData>("dashboard");
  const action = useAction();
  const router = useRouter();
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const streak =
    data.streak.last_day &&
    new Date(localDay()).getTime() -
      new Date(data.streak.last_day.slice(0, 10)).getTime() >
      86400000
      ? 0
      : data.streak.current_days;
  return (
    <>
      <div className="page-eyebrow">
        SANA ÖZEL ÖĞRENME ALANI <span>{user.grade}. sınıf</span>
      </div>
      <section className="welcome-hero">
        <div className="hero-copy">
          <div className="pill">
            <span className="tiny-star">✦</span> Küçük adımlar, büyük keşifler
          </div>
          <h1>
            Merhaba {user.name.split(" ")[0]}
            <span className="greeting-dot">!</span>
          </h1>
          <p>
            Bugün ne çalışmak istersin?
            <br />
            Birlikte öğrenmek için güzel bir gün.
          </p>
          <Link href="/plan" className="button primary">
            Çalışma planıma bak <ArrowRight size={17} />
          </Link>
          <span className="hero-doodle doodle-one">✧</span>
          <span className="hero-doodle doodle-two">✦</span>
        </div>
        <MascotGuide
          state="welcome"
          size={210}
          position="hero"
          showBubble={false}
          priority
        />
        <div className="hero-note">
          <BookOpen size={16} /> Her gün biraz daha ileri.
        </div>
      </section>
      <div className="stats-row">
        <div className="stat">
          <span className="stat-icon lilac">
            <BookOpen size={20} />
          </span>
          <div>
            <strong>{data.daily.total}</strong>
            <span>Bugün çözülen soru</span>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon mint">
            <Check size={20} />
          </span>
          <div>
            <strong>
              {data.daily.total
                ? "%" + percent(data.daily.correct, data.daily.total)
                : "—"}
            </strong>
            <span>Bugünkü başarı</span>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon peach">
            <Clock size={20} />
          </span>
          <div>
            <strong>
              {Math.round(data.daily.duration / 60000)} <small>dk</small>
            </strong>
            <span>Bugünkü çalışma</span>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon pink">
            <Flame size={20} />
          </span>
          <div>
            <strong>
              {streak} <small>gün</small>
            </strong>
            <span>Çalışma serisi</span>
          </div>
        </div>
      </div>
      <div className="dashboard-columns">
        <div>
          <RecentStudies />
          <div className="section-heading">
            <h2>
              Derslerin{" "}
              <span className="count-chip">{data.subjects.length}</span>
            </h2>
            <Link href="/dersler">
              Tümünü gör <ArrowRight size={15} />
            </Link>
          </div>
          <div className="subject-grid">
            {data.subjects.map((n) => (
              <SubjectCard key={n.id} node={n} />
            ))}
          </div>
          <div className="teacher-banner">
            <span className="teacher-banner-icon">
              <Sparkles size={25} />
            </span>
            <div>
              <h3>Bir soruda takıldın mı?</h3>
              <p>AI öğretmeninle adım adım, kendi hızında öğren.</p>
            </div>
            <Link className="button subtle" href="/ogretmen">
              Beraber çözelim <ArrowRight size={16} />
            </Link>
          </div>
          <section className="panel weekly-panel">
            <div className="section-heading">
              <h2>Haftalık ritmin</h2>
              <Link href="/basarim">
                Gelişimimi gör <ArrowRight size={15} />
              </Link>
            </div>
            <WeeklyChart data={data} />
          </section>
        </div>
        <aside className="dashboard-rail">
          <section className="panel goal-panel">
            <div className="section-heading">
              <h2>
                <Target size={19} /> Günlük hedefin
              </h2>
              <span className="muted">{user.daily_minutes} dk</span>
            </div>
            <div className="goal-number">
              {Math.round(data.daily.duration / 60000)}
              <span> / {user.daily_minutes} dakika</span>
            </div>
            <Progress
              value={(data.daily.duration / 60000 / user.daily_minutes) * 100}
            />
            <p>
              Hızlı olmak zorunda değilsin.
              <br />
              Düzenli olmak yeterli.
            </p>
            <Link href="/plan" className="button full subtle">
              Bugünkü planı aç <ChevronRight size={16} />
            </Link>
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>
                <RefreshCw size={18} /> Bugünkü tekrarlar
              </h2>
              <span className="count-chip">{data.review.length}</span>
            </div>
            {data.review.length ? (
              data.review.map((r) => (
                <Link
                  key={r.topic_id}
                  className="list-link"
                  href={"/konu/" + r.topic_id}
                >
                  <span
                    className="list-dot"
                    style={{ background: tokenFor(r.subject).color }}
                  />
                  <div>
                    <strong>{r.title}</strong>
                    <small>{r.subject}</small>
                  </div>
                  <ChevronRight size={16} />
                </Link>
              ))
            ) : (
              <p className="muted quiet-note">
                Tekrarların burada seni bekleyecek. İlk testinden sonra öğrenme
                ritmini birlikte oluşturacağız.
              </p>
            )}
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>
                <CalendarDays size={18} /> Yaklaşanlar
              </h2>
              <Link href="/odevler">
                <Plus size={17} />
                <span className="sr-only">Ödev ekle</span>
              </Link>
            </div>
            {[
              ...data.exams.map((t) => ({ ...t, exam: true })),
              ...data.homeworks
                .filter((t) => !t.completed)
                .map((t) => ({ ...t, exam: false })),
            ]
              .filter((t) => t.due_at.slice(0, 10) >= localDay())
              .sort((a, b) => a.due_at.localeCompare(b.due_at))
              .slice(0, 3)
              .map((t) => (
                <Link
                  href={t.exam ? "/sinavlar" : "/odevler"}
                  className="upcoming"
                  key={t.id}
                >
                  <div className="date-square">
                    {new Date(t.due_at.slice(0, 10) + "T12:00:00").getDate()}
                    <small>
                      {new Date(
                        t.due_at.slice(0, 10) + "T12:00:00",
                      ).toLocaleDateString("tr-TR", { month: "short" })}
                    </small>
                  </div>
                  <div>
                    <strong>{t.title}</strong>
                    <small>
                      {t.subject} · {t.exam ? "Sınav" : "Ödev"}
                    </small>
                  </div>
                </Link>
              ))}
            {!data.exams.length && !data.homeworks.length && (
              <p className="muted quiet-note">
                Sınav ve ödevlerini ekleyerek haftanı kolayca düzenle.
              </p>
            )}
          </section>
        </aside>
      </div>
      <ActionStatus {...action} />
      <div className="grade-switch">
        <span>Gelecek dönem için hazırlık</span>
        <button
          onClick={() =>
            action.run(async () => {
              await api("profile", "PUT", { grade: user.grade === 7 ? 8 : 7 });
              router.refresh();
            })
          }
          disabled={action.busy}
        >
          {user.grade === 7 ? "8. sınıfa göz at" : "7. sınıfa dön"}{" "}
          <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}
export function WeeklyChart({ data }: { data: DashboardData }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const now = new Date();
    now.setDate(now.getDate() - 6 + i);
    const date = localDay(now);
    const found = data.weekly.find((d) => d.day === date);
    return {
      date,
      total: found?.total ?? 0,
      label: now.toLocaleDateString("tr-TR", { weekday: "short" }),
    };
  });
  const max = Math.max(10, ...days.map((d) => d.total));
  return (
    <div
      className="weekly-chart"
      role="img"
      aria-label={days
        .map((d) => d.label + ": " + d.total + " soru")
        .join(", ")}
    >
      {days.map((d, i) => (
        <div
          className={"chart-column " + (i === 6 ? "today" : "")}
          key={d.date}
        >
          <span className="chart-value">{d.total || ""}</span>
          <div className="chart-bar-track">
            <div
              className="chart-bar"
              style={{ height: Math.max(3, (d.total / max) * 100) + "%" }}
            />
          </div>
          <small>{d.label}</small>
        </div>
      ))}
    </div>
  );
}
export function LessonsPage({ user, id }: { user: User; id?: string }) {
  const { data, error, loading } = useResource<Node[]>(
    "curriculum?grade=" + user.grade,
  );
  const { point } = useMascot();
  useEffect(() => {
    point();
  }, [point]);
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  if (!id)
    return (
      <>
        <PageTitle
          eyebrow={user.grade + ". SINIF"}
          title="Bugün hangi dersten başlayalım?"
          text="Bir konu seç. Öğren, dene, yeniden keşfet."
        />
        <div className="subject-grid large">
          {data
            .filter((n) => n.kind === "subject")
            .map((n) => (
              <SubjectCard key={n.id} node={n} />
            ))}
        </div>
        <div className="source-notice">
          <BookOpen size={20} />
          <p>
            Resmî MEB programları kaynak doğrulaması tamamlandığında yayımlanır.
            Bağımsız çalışma atölyeleri müfredat olarak sunulmaz.
          </p>
        </div>
      </>
    );
  const subject = data.find((n) => n.id === id && n.kind === "subject");
  if (!subject)
    return (
      <Empty title="Ders bulunamadı">
        <Link href="/dersler">Derslere dön</Link>
      </Empty>
    );
  const units = data.filter((n) => n.parent_id === id);
  const t = tokenFor(subject.subject);
  return (
    <>
      <Link href="/dersler" className="back-link">
        ← Dersler
      </Link>
      <PageTitle
        eyebrow={user.grade + ". SINIF"}
        title={subject.title}
        text="Her keşif bir konuyla başlar."
      />
      {units.length ? (
        units.map((unit, i) => (
          <section
            className="unit-panel"
            key={unit.id}
            style={
              {
                "--subject": t.color,
                "--subject-bg": t.background,
              } as React.CSSProperties
            }
          >
            <div className="unit-heading">
              <span className="unit-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h2>{unit.title}</h2>
                <span
                  className={"badge " + (unit.verified ? "verified" : "draft")}
                >
                  {unit.verified
                    ? "Kaynağı doğrulandı"
                    : "Bağımsız çalışma · MEB programı değil"}
                </span>
              </div>
            </div>
            {data
              .filter((n) => n.parent_id === unit.id && n.kind === "topic")
              .map((topic) => (
                <Link
                  href={"/konu/" + topic.id}
                  className="topic-link"
                  key={topic.id}
                >
                  <BookOpen size={21} />
                  <div>
                    <strong>{topic.title}</strong>
                    <small>Öğren · Tekrar et · Test çöz</small>
                  </div>
                  <ArrowRight size={18} />
                </Link>
              ))}
          </section>
        ))
      ) : (
        <Empty title="Resmî program doğrulaması bekleniyor">
          Bu dersin konu ve öğrenme çıktıları, resmî MEB kaynağı incelendikten
          sonra eklenir.
        </Empty>
      )}
    </>
  );
}
export function PageTitle({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {action}
    </div>
  );
}
export function TestCreator({
  topicId,
  mode = "practice",
  subject,
}: {
  topicId?: string;
  mode?: "practice" | "review" | "wrongs" | "mock";
  subject?: string;
}) {
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState("mixed");
  const action = useAction();
  const router = useRouter();
  return (
    <form
      className="test-creator panel"
      onSubmit={(e) => {
        e.preventDefault();
        void action.run(async () => {
          const t = await api<{ id: string }>("tests", "POST", {
            topic_id: topicId,
            count,
            difficulty,
            mode,
            subject,
          });
          router.push("/test/" + t.id);
        });
      }}
    >
      <h2>{mode === "mock" ? "Deneme çalışması" : "Kendi testini oluştur"}</h2>
      <p className="muted">
        Kendi hızında ilerle. Her soru öğrenmek için bir fırsat.
      </p>
      <fieldset className="selection-group">
        <legend>Soru sayısı</legend>
        <div className="choice-buttons">
          {[5, 10, 15, 20].map((n) => (
            <button
              type="button"
              aria-pressed={count === n}
              className={count === n ? "active" : ""}
              key={n}
              onClick={() => setCount(n)}
            >
              {n} soru
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="selection-group">
        <legend>Zorluk</legend>
        <div className="choice-buttons">
          {[
            ["easy", "Kolay"],
            ["medium", "Orta"],
            ["hard", "Zor"],
            ["mixed", "Karışık"],
          ].map(([v, l]) => (
            <button
              type="button"
              key={v}
              aria-pressed={difficulty === v}
              className={difficulty === v ? "active" : ""}
              onClick={() => setDifficulty(v)}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      {mode === "mock" && (
        <p>
          Bu çalışma {count * 1.5} dakika sürer. Resmî LGS denemesi değildir.
        </p>
      )}
      <ActionStatus {...action} />
      <button className="button primary" disabled={action.busy}>
        {action.busy ? "Test hazırlanıyor…" : "Hazırsan başlayalım"}{" "}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
export function TopicPage({ id }: { id: string }) {
  const { data, error, loading } = useResource<{
    topic: Node;
    children: Node[];
    mastery: { score: number } | null;
  }>("topic?id=" + id);
  const [tab, setTab] = useState("learn");
  const [miniAnswer, setMiniAnswer] = useState("");
  const [miniResult, setMiniResult] = useState("");
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  const t = data.topic;
  const sections = Array.isArray(t.payload.sections)
    ? t.payload.sections.filter((s): s is { heading: string; text: string } =>
        Boolean(
          s &&
          typeof s === "object" &&
          "heading" in s &&
          "text" in s &&
          typeof s.heading === "string" &&
          typeof s.text === "string",
        ),
      )
    : [];
  const mini = t.payload.mini as
    | { prompt?: string; answer?: string }
    | undefined;
  return (
    <>
      <Link href="/dersler" className="back-link">
        ← Dersler
      </Link>
      <PageTitle
        eyebrow={t.subject + " · " + t.grade + ". SINIF"}
        title={t.title}
        text={
          t.verified
            ? "Resmî kaynakla eşleştirilmiş konu"
            : "Bağımsız alıştırma — resmî müfredat eşleştirmesi yapılmadı"
        }
      />
      <div className="color-tabs" role="tablist">
        {[
          ["learn", "Konuyu öğren"],
          ["quick", "Hızlı tekrar"],
          ["test", "Test çöz"],
          ["teacher", "AI öğretmen"],
          ["wrongs", "Yanlışlarım"],
        ].map(([v, l]) => (
          <button
            role="tab"
            aria-selected={tab === v}
            className={tab === v ? "active" : ""}
            key={v}
            onClick={() => setTab(v)}
          >
            {l}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {["learn", "quick"].includes(tab) && (
          <div className="learning-layout">
            <div className="panel lesson-content">
              {sections.length ? (
                sections
                  .filter((_, i) => tab === "learn" || i < 3)
                  .map((s, i) => (
                    <section key={i}>
                      <span className="lesson-step">{i + 1}</span>
                      <h2>{s.heading}</h2>
                      <p>
                        <MathText text={s.text} />
                      </p>
                    </section>
                  ))
              ) : (
                <Empty title="Öğrenme içeriği henüz eklenmedi">
                  Admin, bu konu için kaynakla uyumlu öğretim içeriği
                  ekleyebilir.
                </Empty>
              )}
              {tab === "learn" && mini?.prompt && (
                <form
                  className="mini-exercise"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setMiniResult(
                      miniAnswer.trim() === mini.answer
                        ? "Doğru! Hazırsan teste geçebilirsin."
                        : "Bir daha bakalım. Örnekteki adımları izleyebilirsin.",
                    );
                  }}
                >
                  <h3>Şimdi sıra sende</h3>
                  <p>
                    <MathText text={mini.prompt} />
                  </p>
                  <label>
                    Cevabın
                    <input
                      value={miniAnswer}
                      onChange={(e) => setMiniAnswer(e.target.value)}
                    />
                  </label>
                  <button className="button subtle">Kontrol et</button>
                  <p role="status">{miniResult}</p>
                </form>
              )}
              <button className="button primary" onClick={() => setTab("test")}>
                Teste geç <ArrowRight size={16} />
              </button>
            </div>
            <aside className="panel lesson-aside">
              <MascotGuide
                state="study"
                message="Önce kısa bir tekrar yapabiliriz."
                size={150}
              />
              <h3>Konu hâkimiyetin</h3>
              <Progress
                value={Number(data.mastery?.score ?? 0)}
                label={masteryLabel(Number(data.mastery?.score ?? 0))}
              />
              {t.source_url && (
                <a
                  href={t.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link"
                >
                  Resmî kaynak ↗
                </a>
              )}
              {data.children
                .filter((n) => n.kind === "outcome")
                .map((n) => (
                  <p key={n.id}>
                    <strong>{n.code}</strong> {n.title}
                  </p>
                ))}
            </aside>
          </div>
        )}
        {tab === "test" && <TestCreator topicId={id} />}{" "}
        {tab === "teacher" && <TeacherPage topicId={id} />}{" "}
        {tab === "wrongs" && <WrongsPage topicId={id} />}
      </div>
    </>
  );
}
type TestData = {
  test: {
    id: string;
    title: string;
    completed_at: string | null;
    started_at: string;
    time_limit: number | null;
  };
  questions: (Question & {
    attempt_id: string | null;
    correct: boolean;
    skipped: boolean;
    given_answer: string;
    help_level: number;
  })[];
  results:
    | {
        id: string;
        prompt: string;
        correct: boolean;
        skipped: boolean;
        expected: string;
        explanation: string;
        response_ms: number;
        help_level: number;
      }[]
    | null;
};
export function TestPage({ id }: { id: string }) {
  const { data, error, loading, reload } = useResource<TestData>("tests/" + id);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    skipped: boolean;
    expected: string;
    explanation: string;
    mastery: number;
  } | null>(null);
  const [showTeacher, setShowTeacher] = useState(false);
  const action = useAction();
  const mascot = useMascot();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const currentQuestionId = data?.questions.find((q) => !q.attempt_id)?.id;
  useEffect(() => {
    setValue("");
    setShowTeacher(false);
  }, [currentQuestionId]);
  const expired = Boolean(
    data?.test.time_limit &&
    now - new Date(data.test.started_at).getTime() >
      data.test.time_limit * 1000,
  );
  useEffect(() => {
    if (expired && !data?.test.completed_at) reload();
  }, [expired, data?.test.completed_at, reload]);
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  if (data.test.completed_at) {
    const results = data.results ?? [];
    const correct = results.filter((r) => r.correct).length,
      blank = results.filter((r) => r.skipped).length;
    return (
      <>
        <PageTitle
          eyebrow="BİR ADIM DAHA İLERİ"
          title="Test tamamlandı!"
          text="Şimdi ne öğrendiğine birlikte bakalım."
        />
        <section className="results-hero panel">
          <MascotGuide state="celebrate" size={150} showBubble={false} />
          <div>
            <h2>
              {correct} / {results.length}
            </h2>
            <p>
              {correct} doğru · {results.length - correct - blank} tekrar
              fırsatı · {blank} boş
            </p>
            <p>
              {Math.round(
                results.reduce((a, r) => a + r.response_ms, 0) / 60000,
              )}{" "}
              dakika çalışma · {results.filter((r) => r.help_level > 0).length}{" "}
              soruda yardım
            </p>
            <Link href="/yanlislarim" className="button primary">
              Tekrar fırsatlarıma bak <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <div className="result-list">
          {results.map((r, i) => (
            <details className="panel" key={r.id}>
              <summary>
                <span className={r.correct ? "result-correct" : "result-retry"}>
                  {r.correct ? (
                    <CheckCircle2 size={20} />
                  ) : r.skipped ? (
                    <Minus size={20} />
                  ) : (
                    <RefreshCw size={20} />
                  )}
                </span>
                <span>
                  {i + 1}. {r.prompt}
                </span>
                <span className="muted">
                  {r.correct ? "Doğru" : r.skipped ? "Boş" : "Bir daha bakalım"}
                </span>
              </summary>
              <p>
                <strong>Beklenen cevap:</strong> <MathText text={r.expected} />
              </p>
              <p>
                <MathText text={r.explanation} />
              </p>
            </details>
          ))}
        </div>
      </>
    );
  }
  const index = data.questions.findIndex((q) => !q.attempt_id);
  const q = data.questions[index];
  const completed = data.questions.filter((q) => q.attempt_id).length;
  const remaining = data.test.time_limit
    ? Math.max(
        0,
        Math.ceil(
          data.test.time_limit -
            (now - new Date(data.test.started_at).getTime()) / 1000,
        ),
      )
    : null;
  async function submit(skip = false) {
    if (!q) return;
    await action.run(async () => {
      const result = await api<NonNullable<typeof feedback>>(
        "tests/" + id + "/attempt",
        "POST",
        { question_id: q.id, answer: value, skip },
      );
      setFeedback(result);
      if (result.correct) mascot.say("Tam isabet!", "correct", "high");
      else if (!skip) mascot.encourage();
    });
  }
  return (
    <>
      <PageTitle
        eyebrow="ODAK ZAMANI"
        title={data.test.title}
        text="Acele etme. Soruyu dikkatle oku."
        action={
          <span className="pill">
            <Clock size={16} />
            {remaining !== null
              ? Math.floor(remaining / 60) +
                ":" +
                String(remaining % 60).padStart(2, "0")
              : "Kendi hızında"}
          </span>
        }
      />
      <div className="test-progress">
        <span>
          Soru{" "}
          {Math.min(
            index < 0 ? data.questions.length : index + 1,
            data.questions.length,
          )}{" "}
          / {data.questions.length}
        </span>
        <span>{completed} soru tamamlandı</span>
        <Progress value={(completed / data.questions.length) * 100} />
      </div>
      {q ? (
        <section className="panel test-sheet">
          <div className="question-number">
            {String(index + 1).padStart(2, "0")}
          </div>
          <QuestionRenderer
            question={q}
            value={value}
            onChange={setValue}
            disabled={Boolean(feedback) || action.busy}
          />
          <ActionStatus {...action} />
          {feedback ? (
            <div
              className={
                "answer-feedback " +
                (feedback.correct ? "is-correct" : "is-retry")
              }
              role="status"
            >
              <h3>
                {feedback.correct
                  ? "Doğru!"
                  : feedback.skipped
                    ? "Bu soruyu sonraya bıraktın."
                    : "Bir daha bakalım."}
              </h3>
              <p>
                <strong>Beklenen cevap: </strong>
                <MathText text={feedback.expected} />
              </p>
              <p>
                <MathText text={feedback.explanation} />
              </p>
              <button
                className="button primary"
                disabled={action.busy}
                onClick={() => {
                  setFeedback(null);
                  reload();
                }}
              >
                Sonraki soru <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <>
              <div className="test-actions">
                <button
                  className="button subtle"
                  type="button"
                  onClick={() => {
                    setShowTeacher((v) => !v);
                    mascot.help();
                  }}
                >
                  <Sparkles size={17} /> AI öğretmene sor
                </button>
                <button
                  className="button text"
                  disabled={action.busy}
                  onClick={() => submit(true)}
                >
                  Sonra çözeceğim
                </button>
                <button
                  className="button primary"
                  disabled={!value.trim() || action.busy}
                  onClick={() => submit()}
                >
                  {action.busy ? "Kaydediliyor…" : "Cevabımı kontrol et"}
                  <Check size={16} />
                </button>
              </div>
              {showTeacher && (
                <TeacherPage
                  topicId={q.topic_id}
                  testId={id}
                  questionId={q.id}
                  compact
                  initialMessage={
                    "Bu soruda bana doğrudan cevabı vermeden ipucu ver: " +
                    q.prompt
                  }
                />
              )}
            </>
          )}
        </section>
      ) : (
        <section className="panel center">
          <h2>Tüm soruları tamamladın.</h2>
          <button
            className="button primary"
            disabled={action.busy}
            onClick={() =>
              action.run(async () => {
                await api("tests/" + id + "/complete", "POST", {});
                mascot.celebrate();
                reload();
              })
            }
          >
            Sonuçlarıma bak <ArrowRight size={16} />
          </button>
        </section>
      )}
      <button
        className="button text"
        disabled={action.busy}
        onClick={() =>
          action.run(async () => {
            await api("tests/" + id + "/complete", "POST", {});
            reload();
          })
        }
      >
        Testi bitir ve kaydet
      </button>
    </>
  );
}
export function WrongsPage({ topicId }: { topicId?: string }) {
  const [subject, setSubject] = useState("");
  const [from, setFrom] = useState("");
  const { data, error, loading } = useResource<
    {
      id: string;
      prompt: string;
      topic: string;
      subject: string;
      topic_id: string;
      expected: string;
      explanation: string;
      created_at: string;
      error_type: string;
      answer: string;
    }[]
  >(
    "wrongs?" +
      new URLSearchParams({
        ...(topicId ? { topic: topicId } : {}),
        ...(subject ? { subject } : {}),
        ...(from ? { from } : {}),
      }),
  );
  const { data: subjects } = useResource<Node[]>("curriculum");
  return (
    <>
      <PageTitle
        eyebrow="ÖĞRENMENİN BİR PARÇASI"
        title="Tekrar fırsatlarım"
        text="Her yanlış, neyi tekrar çalışabileceğini gösterir."
      />
      <div className="filter-row">
        <label>
          Ders
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Tüm dersler</option>
            {subjects
              ?.filter((n) => n.kind === "subject")
              .map((n) => (
                <option key={n.id}>{n.title}</option>
              ))}
          </select>
        </label>
        <label>
          Başlangıç tarihi
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
      </div>
      <ErrorBox message={error} />
      {loading && !data ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="Burada henüz tekrar fırsatı yok">
          Çözdüğün testlerde tekrar çalışabileceğin sorular burada birikir.
        </Empty>
      ) : (
        <div className="wrong-list">
          {data.map((q) => (
            <details className="panel" key={q.id}>
              <summary>
                <span
                  className="small-subject"
                  style={{
                    background: tokenFor(q.subject).background,
                    color: tokenFor(q.subject).color,
                  }}
                >
                  <RefreshCw size={20} />
                </span>
                <div>
                  <small>
                    {q.subject} · {q.topic} · {dateLabel(q.created_at)}
                  </small>
                  <strong>{q.prompt}</strong>
                </div>
                <ChevronRight size={18} />
              </summary>
              <p>Senin cevabın: {q.answer || "—"}</p>
              <p>
                Beklenen cevap: <MathText text={q.expected} />
              </p>
              <p>
                <MathText text={q.explanation} />
              </p>
              <small>
                Hata tipi:{" "}
                {q.error_type === "unclassified"
                  ? "Henüz sınıflandırılmadı"
                  : q.error_type}
              </small>
              <Link className="button subtle" href={"/konu/" + q.topic_id}>
                Konuyu tekrar çalış
              </Link>
            </details>
          ))}
          <TestCreator
            topicId={topicId}
            mode="wrongs"
            subject={subject || undefined}
          />
        </div>
      )}
    </>
  );
}
export function AchievementPage({
  studentId,
  parent = false,
}: {
  studentId?: string;
  parent?: boolean;
}) {
  const { data, error, loading } = useResource<DashboardData>(
    "dashboard" + (studentId ? "?student=" + studentId : ""),
  );
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  return (
    <>
      <PageTitle
        eyebrow={parent ? "EBEVEYN RAPORU" : "KENDİNLE YARIŞ"}
        title={parent ? "Öğrenme yolculuğu" : "Her gün biraz daha ileri"}
        text="Yalnızca soru sayısı değil, öğrenme biçimin de önemli."
      />
      <div className="stats-row">
        {[
          [data.totals.total, "Toplam soru"],
          [data.totals.correct, "Doğru"],
          [data.totals.wrong, "Tekrar fırsatı"],
          [data.totals.blank, "Boş"],
        ].map(([v, l]) => (
          <div className="stat" key={l}>
            <span className="stat-icon lilac">
              <Trophy size={20} />
            </span>
            <div>
              <strong>{v}</strong>
              <span>{l}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="panel">
          <h2>Son 7 gün</h2>
          <WeeklyChart data={data} />
          <p className="muted">
            Toplam çalışma: {Math.round(data.totals.duration / 60000)} dakika ·
            Başarı: %{percent(data.totals.correct, data.totals.total)}
          </p>
        </section>
        <section className="panel">
          <h2>Konu hâkimiyeti</h2>
          {data.mastery.length ? (
            data.mastery.map((m) => (
              <div className="mastery-row" key={m.topic_id}>
                <div>
                  <strong>{m.title}</strong>
                  <small>
                    {m.subject} · {masteryLabel(Number(m.score))}
                  </small>
                </div>
                <Progress value={Number(m.score)} />
              </div>
            ))
          ) : (
            <Empty title="İlk testinle başlayacak">
              Bağımsız çözüm, yardım kullanımı ve son performans birlikte
              değerlendirilir.
            </Empty>
          )}
        </section>
        <section className="panel">
          <h2>En güçlü konular</h2>
          {data.mastery
            .filter((m) => Number(m.score) >= 65)
            .slice(0, 3)
            .map((m) => (
              <p key={m.topic_id}>
                {m.title} · %{Math.round(Number(m.score))}
              </p>
            ))}
          {!data.mastery.some((m) => Number(m.score) >= 65) && (
            <p className="muted">
              Çalışmalar biriktikçe güçlü yönlerin görünür olacak.
            </p>
          )}
          <h2>Geliştirebileceğin konular</h2>
          {data.mastery
            .filter((m) => Number(m.score) < 65)
            .slice(0, 5)
            .map((m) => (
              <p key={m.topic_id}>
                {m.title} · {masteryLabel(Number(m.score))}
              </p>
            ))}
        </section>
        <section className="panel">
          <h2>Tekrar eden hata örüntüleri</h2>
          {data.errors.length ? (
            data.errors.map((e, i) => (
              <p key={i}>
                {e.title} ·{" "}
                {e.error_type === "unclassified"
                  ? "Sınıflandırma bekleniyor"
                  : e.error_type}{" "}
                · {e.count} kez
              </p>
            ))
          ) : (
            <p className="muted">Henüz bir hata örüntüsü yok.</p>
          )}
        </section>
      </div>
      <div className="section-heading">
        <h2>Öğrenme rozetleri</h2>
        <span className="muted">
          {data.badges.filter((b) => b.earned_at).length} / {data.badges.length}
        </span>
      </div>
      <div className="badge-grid">
        {data.badges.map((b) => (
          <div
            className={"achievement-badge " + (b.earned_at ? "earned" : "")}
            key={b.id}
          >
            <Trophy size={28} />
            <h3>{b.title}</h3>
            <p>
              {b.earned_at
                ? "Kazanıldı · " + dateLabel(b.earned_at)
                : "Yolculuğun devam ediyor"}
            </p>
          </div>
        ))}
      </div>
      {parent && (
        <section className="panel">
          <h2>Yaklaşan sınav ve ödevler</h2>
          {[...data.exams, ...data.homeworks.filter((t) => !t.completed)].map(
            (t) => (
              <p key={t.id}>
                {t.subject} · {t.title} · {dateLabel(t.due_at)}
              </p>
            ),
          )}
          <h3>Bu haftanın özeti</h3>
          <p>
            Son yedi günde{" "}
            {data.weekly
              .filter(
                (d) => new Date(d.day).getTime() >= Date.now() - 7 * 86400000,
              )
              .reduce((s, d) => s + d.total, 0)}{" "}
            soru çözüldü. Bugün {Math.round(data.daily.duration / 60000)} dakika
            çalışıldı. Aktif çalışma serisi {data.streak.current_days} gün.
          </p>
        </section>
      )}
    </>
  );
}
export function PlanPage({ user }: { user: User }) {
  const { data, error, loading, reload } =
    useResource<DashboardData>("dashboard");
  const [minutes, setMinutes] = useState(user.daily_minutes);
  const action = useAction();
  return (
    <>
      <PageTitle
        eyebrow="KÜÇÜK ADIMLARLA"
        title="Bugünkü çalışma planım"
        text="Vaktini seç; tekrarlarını ve sınavlarını birlikte düşünelim."
      />
      <div className="learning-layout">
        <section className="panel">
          <h2>Bugün ne kadar vaktin var?</h2>
          <div className="choice-buttons">
            {[20, 30, 45, 60].map((n) => (
              <button
                key={n}
                onClick={() => setMinutes(n)}
                aria-pressed={minutes === n}
                className={minutes === n ? "active" : ""}
              >
                {n} dakika
              </button>
            ))}
          </div>
          <button
            className="button primary"
            disabled={action.busy}
            onClick={() =>
              action.run(async () => {
                await api("plan", "POST", { minutes });
                reload();
              }, "Planın kaydedildi.")
            }
          >
            Planımı oluştur <Sparkles size={16} />
          </button>
          <ActionStatus {...action} />
          <ErrorBox message={error} />
          {loading && !data ? (
            <Loading />
          ) : data?.plan?.items.length ? (
            <div className="plan-list">
              {data.plan.items.map((item, i) => (
                <Link
                  className="plan-item"
                  href={"/konu/" + item.topic_id}
                  key={item.topic_id}
                >
                  <span className="plan-number">{i + 1}</span>
                  <div>
                    <small>
                      {item.subject} {item.review ? "· Tekrar" : ""}{" "}
                      {item.exam ? "· Sınav hazırlığı" : ""}
                    </small>
                    <strong>{item.title}</strong>
                    <span>
                      {item.count} soru · yaklaşık {item.minutes} dakika
                    </span>
                  </div>
                  <ArrowRight size={18} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty title="Planını birlikte oluşturalım">
              Soru bankasında hazır olan konular, tekrarlar ve seçilmiş sınav
              konuları önceliklendirilir.
            </Empty>
          )}
        </section>
        <aside className="panel lesson-aside">
          <MascotGuide
            state="point"
            size={160}
            message="En zorundan başlamak zorunda değilsin. Bir küçük adım yeter."
          />
          <h3>Bugünkü tekrarlar</h3>
          {data?.review.map((r) => (
            <Link
              href={"/konu/" + r.topic_id}
              key={r.topic_id}
              className="list-link"
            >
              {r.title}
              <ArrowRight size={16} />
            </Link>
          ))}
          <Link className="button subtle" href="/sinavlar">
            Sınav takvimim <CalendarDays size={16} />
          </Link>
        </aside>
      </div>
      {user.grade === 8 && (
        <>
          <PageTitle
            title="Deneme zamanı"
            text="Süreli, ders bazlı veya genel çalışma. Sonuçlar öğrenme profiline kaydedilir."
          />
          <TestCreator mode="mock" />
        </>
      )}
    </>
  );
}
export function TasksPage({
  kind,
  user,
}: {
  kind: "homeworks" | "exams";
  user: User;
}) {
  const { data, error, loading, reload } = useResource<Task[]>(kind);
  const { data: nodes } = useResource<Node[]>("curriculum?grade=" + user.grade);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Matematik");
  const [due, setDue] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const action = useAction();
  const exam = kind === "exams";
  return (
    <>
      <PageTitle
        eyebrow="HAFTANI DÜZENLE"
        title={exam ? "Sınav takvimim" : "Ödevlerim"}
        text={
          exam
            ? "Konularını seç, kalan günlere göre çalışma planını hazırla."
            : "Aklında tutmak yerine buraya bırak."
        }
      />
      <div className="learning-layout">
        <section className="panel">
          <h2>{exam ? "Sınav ekle" : "Yeni ödev"}</h2>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                await api(kind, "POST", {
                  title,
                  subject,
                  due_at: due,
                  topic_ids: topics,
                });
                setTitle("");
                setTopics([]);
                reload();
              }, "Kaydedildi.");
            }}
          >
            <label>
              Ders
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setTopics([]);
                }}
              >
                {nodes
                  ?.filter((n) => n.kind === "subject")
                  .map((n) => (
                    <option key={n.id}>{n.title}</option>
                  ))}
              </select>
            </label>
            <label>
              {exam ? "Sınav adı" : "Ödev"}
              <input
                required
                minLength={2}
                maxLength={250}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  exam ? "Birinci dönem yazılısı" : "Çalışma kitabı, sayfa…"
                }
              />
            </label>
            <label>
              {exam ? "Sınav tarihi" : "Son tarih"}
              <input
                required
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            {exam && (
              <fieldset>
                <legend>Sınav konuları</legend>
                {nodes
                  ?.filter((n) => n.kind === "topic" && n.subject === subject)
                  .map((n) => (
                    <label className="checkbox-row" key={n.id}>
                      <input
                        type="checkbox"
                        checked={topics.includes(n.id)}
                        onChange={(e) =>
                          setTopics((t) =>
                            e.target.checked
                              ? [...t, n.id]
                              : t.filter((id) => id !== n.id),
                          )
                        }
                      />
                      {n.title}
                    </label>
                  ))}
              </fieldset>
            )}
            <ActionStatus {...action} />
            <button className="button primary" disabled={action.busy}>
              <Plus size={17} /> Kaydet
            </button>
          </form>
        </section>
        <div>
          <ErrorBox message={error} />
          {loading && !data ? (
            <Loading />
          ) : !data?.length ? (
            <Empty
              title={exam ? "Sınav takvimin henüz boş" : "Henüz ödev eklemedin"}
            >
              Yeni bir kayıt ekleyerek haftanı düzenleyebilirsin.
            </Empty>
          ) : (
            data.map((t) => (
              <section
                className={"panel task-card " + (t.completed ? "done" : "")}
                key={t.id}
              >
                <span className="task-subject">{t.subject}</span>
                <h3>{t.title}</h3>
                <p>
                  <CalendarDays size={16} /> {dateLabel(t.due_at)}
                </p>
                {exam && (
                  <p>
                    {Math.max(
                      0,
                      Math.ceil(
                        (new Date(t.due_at).getTime() -
                          new Date(localDay()).getTime()) /
                          86400000,
                      ),
                    )}{" "}
                    gün kaldı
                  </p>
                )}
                <div className="task-actions">
                  {!exam && (
                    <button
                      className="button subtle"
                      disabled={action.busy}
                      onClick={() =>
                        action.run(async () => {
                          await api(kind + "/" + t.id, "PUT", {
                            completed: !t.completed,
                          });
                          reload();
                        })
                      }
                    >
                      <Check size={16} />
                      {t.completed ? "Tamamlandı · geri al" : "Tamamladım"}
                    </button>
                  )}
                  {exam && (
                    <Link href="/plan" className="button subtle">
                      Çalışma planı oluştur
                    </Link>
                  )}
                  <button
                    className="icon-button danger"
                    disabled={action.busy}
                    aria-label={t.title + " kaydını sil"}
                    onClick={() =>
                      action.run(async () => {
                        await api(kind + "/" + t.id, "DELETE", {});
                        reload();
                      })
                    }
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </>
  );
}

type StudyRecord = {
  id: string;
  title: string;
  mode: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  count: number;
  answered: number;
};
export function StudiesPage() {
  const { data, error, loading } = useResource<StudyRecord[]>("tests");
  const [filter, setFilter] = useState("active");
  const records =
    data?.filter(
      (t) =>
        filter === "all" ||
        (filter === "active" ? !t.completed_at : Boolean(t.completed_at)),
    ) ?? [];
  return (
    <>
      <PageTitle
        eyebrow="KALDIĞIN YERDEN"
        title="Çalışmalarım"
        text="Hazırlanmış testlerin ve kaydedilmiş sonuçların burada."
      />
      <div className="color-tabs">
        {[
          ["active", "Devam eden"],
          ["completed", "Tamamlanan"],
          ["all", "Tümü"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorBox message={error} />
      {loading && !data ? (
        <Loading />
      ) : !records.length ? (
        <Empty title="Bu bölümde henüz çalışma yok">
          <Link href="/dersler">
            Derslerden kendi testini oluşturabilirsin.
          </Link>
        </Empty>
      ) : (
        records.map((t) => (
          <Link
            className="panel study-record"
            href={"/test/" + t.id}
            key={t.id}
          >
            <span className="small-subject lilac">
              <ClipboardList size={21} />
            </span>
            <div>
              <h3>{t.title}</h3>
              <p>
                {t.count} soru · {t.answered} cevap ·{" "}
                {t.mode === "mock" ? "Süreli deneme" : "Konu çalışması"}
              </p>
              <small>
                {t.completed_at
                  ? "Tamamlandı"
                  : t.started_at
                    ? "Kaldığın yerden devam et"
                    : "Henüz başlamadın"}{" "}
                · {dateLabel(t.created_at)}
              </small>
            </div>
            <ArrowRight size={18} />
          </Link>
        ))
      )}
    </>
  );
}
function RecentStudies() {
  const { data } = useResource<StudyRecord[]>("tests");
  const active = data?.filter((t) => !t.completed_at).slice(0, 2) ?? [];
  if (!active.length) return null;
  return (
    <section className="panel recent-studies">
      <div className="section-heading">
        <h2>Bir sonraki adımın</h2>
        <Link href="/calismalar">
          Çalışmalarım <ArrowRight size={15} />
        </Link>
      </div>
      {active.map((t) => (
        <Link href={"/test/" + t.id} className="list-link" key={t.id}>
          <ClipboardList size={19} />
          <div>
            <strong>{t.title}</strong>
            <small>
              {t.answered} / {t.count} soru ·{" "}
              {t.started_at ? "Devam et" : "Hazırsan başlayalım"}
            </small>
          </div>
          <ArrowRight size={15} />
        </Link>
      ))}
    </section>
  );
}
