"use client";
import { useState } from "react";
import {
  Trash2,
  Link2,
  Pencil,
  ShieldCheck,
  Sparkles,
  Database,
  Users,
  FileCheck,
  ClipboardList,
} from "lucide-react";
import type { Node, User } from "@/types/domain";
import { api } from "@/lib/client";
import { useResource } from "@/hooks/useResource";
import { Loading, Empty, ErrorBox, useAction, ActionStatus } from "./ui";
import { AchievementPage, PageTitle } from "./StudentPages";
import { QuestionRenderer } from "./tests/QuestionRenderer";
import type { Question } from "@/types/domain";
export function ParentPage() {
  const { data, error, loading } =
    useResource<{ id: string; name: string; grade: number }[]>("students");
  const [selected, setSelected] = useState("");
  const id = selected || data?.[0]?.id;
  return (
    <>
      <div className="parent-heading">
        <PageTitle
          eyebrow="EBEVEYN ALANI"
          title="Birlikte büyüyen bir yolculuk"
          text="Çalışma alışkanlıklarını ve öğrenme gelişimini takip edin."
        />
        {data?.length ? (
          <label>
            Öğrenci
            <select value={id} onChange={(e) => setSelected(e.target.value)}>
              {data.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.name} · {u.grade}. sınıf
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <ErrorBox message={error} />
      {loading && !data ? (
        <Loading />
      ) : id ? (
        <AchievementPage key={id} studentId={id} parent />
      ) : (
        <Empty title="Henüz bağlı öğrenci yok">
          Admin, hesabınız ile öğrenci arasında bağlantı oluşturduğunda rapor
          burada görünür.
        </Empty>
      )}
    </>
  );
}
type AdminUser = Pick<User, "id" | "name" | "email" | "role" | "grade">;
type BankQuestion = Question & {
  status: string;
  topic: string;
  grade: number;
  subject: string;
  origin: string;
};
const blankNode = {
  parent_id: null as string | null,
  kind: "unit",
  title: "",
  grade: 7 as 7 | 8,
  subject: "Matematik",
  code: null as string | null,
  source_url: null as string | null,
  academic_year: "2026-2027",
  curriculum_version: "DRAFT",
  verified: false,
  payload: {},
};
const blankQuestion = {
  kind: "multiple_choice",
  prompt: "",
  options: ["", "", "", ""],
  answer: "",
  explanation: "",
  difficulty: "medium",
  passage: null,
  payload: { image: null, table: null, points: null, pairs: null },
};
export function AdminPage() {
  const [section, setSection] = useState("overview");
  return (
    <>
      <PageTitle
        eyebrow="YÖNETİM ALANI"
        title="Öğrenmenin arka planı"
        text="Müfredat, içerik, soru bankası ve kullanıcıları yönet."
      />
      <div className="color-tabs admin-tabs">
        {[
          ["overview", "Genel bakış"],
          ["nodes", "Müfredat & içerik"],
          ["questions", "Soru bankası"],
          ["generate", "AI soru üretici"],
          ["users", "Kullanıcılar"],
          ["tests", "Testler"],
          ["sources", "Kaynaklar"],
        ].map(([v, l]) => (
          <button
            className={section === v ? "active" : ""}
            key={v}
            onClick={() => setSection(v)}
          >
            {l}
          </button>
        ))}
      </div>
      {section === "overview" ? (
        <AdminOverview />
      ) : section === "nodes" ? (
        <NodeManager />
      ) : section === "questions" ? (
        <QuestionManager />
      ) : section === "generate" ? (
        <AIGenerator />
      ) : section === "users" ? (
        <UserManager />
      ) : section === "tests" ? (
        <TestManager />
      ) : (
        <AdminReadTable resource={section} />
      )}
    </>
  );
}
function AdminOverview() {
  const { data, error, loading } = useResource<{
    counts: {
      users: number;
      questions: number;
      verified_nodes: number;
      tests: number;
    }[];
    usage: {
      feature: string;
      model: string;
      calls: number;
      input_tokens: number;
      output_tokens: number;
      estimated_cost: number | null;
      pricing_known: boolean;
    }[];
    dailyUsage: { day: string; calls: number }[];
  }>("admin/overview");
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error} />;
  return (
    <>
      <div className="stats-row">
        {[
          [data.counts[0].users, "Kullanıcı", Users],
          [data.counts[0].questions, "Soru", Database],
          [data.counts[0].verified_nodes, "Doğrulanmış kayıt", FileCheck],
          [data.counts[0].tests, "Test", ClipboardList],
        ].map(([value, label, Icon]) => {
          const C = Icon as typeof Users;
          return (
            <div className="stat" key={String(label)}>
              <span className="stat-icon lilac">
                <C size={20} />
              </span>
              <div>
                <strong>{String(value)}</strong>
                <span>{String(label)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <section className="panel">
        <h2>AI kullanımı · Son 30 gün</h2>
        {data.usage.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>İşlem / model</th>
                  <th>Çağrı</th>
                  <th>Girdi / çıktı token</th>
                  <th>Tahmini maliyet</th>
                </tr>
              </thead>
              <tbody>
                {data.usage.map((u, i) => (
                  <tr key={i}>
                    <td>
                      {u.feature}
                      <small>{u.model}</small>
                    </td>
                    <td>{u.calls}</td>
                    <td>
                      {u.input_tokens} / {u.output_tokens}
                    </td>
                    <td>
                      {u.pricing_known && u.estimated_cost !== null
                        ? "$" + u.estimated_cost.toFixed(4)
                        : "Fiyatlandırma yapılandırılmadı"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Henüz AI çağrısı yapılmadı">
            Gerçek sağlayıcı yanıtlarından token kullanımı kaydedilir. Fiyatlar
            tanımlanmadan maliyet uydurulmaz.
          </Empty>
        )}
        {data.dailyUsage.map((d) => (
          <p key={d.day}>
            {d.day} · {d.calls} çağrı
          </p>
        ))}
      </section>
      <div className="source-notice">
        <ShieldCheck size={22} />
        <p>
          Doğrulanmamış müfredat kayıtları açıkça işaretlenir. AI soruları
          ikinci kalite denetimi tamamlanmadan öğrenciye gösterilmez.
        </p>
      </div>
    </>
  );
}
function NodeManager() {
  const { data, error, loading, reload } = useResource<Node[]>("admin/nodes");
  const [form, setForm] = useState({ ...blankNode });
  const [editing, setEditing] = useState<string | null>(null);
  const [payload, setPayload] = useState("{}");
  const [filter, setFilter] = useState("");
  const action = useAction();
  const options =
    data?.filter(
      (n) =>
        n.grade === form.grade &&
        n.subject === form.subject &&
        n.id !== editing,
    ) ?? [];
  const reset = () => {
    setForm({ ...blankNode });
    setEditing(null);
    setPayload("{}");
  };
  return (
    <div className="admin-editor-layout">
      <section className="panel">
        <h2>{editing ? "Kaydı düzenle" : "Müfredat kaydı ekle"}</h2>
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await api(
                "admin/nodes" + (editing ? "/" + editing : ""),
                editing ? "PUT" : "POST",
                { ...form, payload: JSON.parse(payload) },
              );
              reset();
              reload();
            }, "Müfredat kaydı kaydedildi.");
          }}
        >
          <div className="form-pair">
            <label>
              Sınıf
              <select
                disabled={Boolean(editing)}
                value={form.grade}
                onChange={(e) =>
                  setForm({
                    ...form,
                    grade: Number(e.target.value) as 7 | 8,
                    parent_id: null,
                  })
                }
              >
                <option value={7}>7. sınıf</option>
                <option value={8}>8. sınıf</option>
              </select>
            </label>
            <label>
              Tür
              <select
                disabled={Boolean(editing)}
                value={form.kind}
                onChange={(e) =>
                  setForm({ ...form, kind: e.target.value, parent_id: null })
                }
              >
                {[
                  ["subject", "Ders"],
                  ["unit", "Tema / Ünite"],
                  ["topic", "Konu"],
                  ["subtopic", "Alt konu"],
                  ["outcome", "Öğrenme çıktısı"],
                  ["skill", "Beceri"],
                  ["content", "İçerik"],
                ].map(([v, l]) => (
                  <option value={v} key={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Ders
            <input
              disabled={Boolean(editing)}
              required
              value={form.subject}
              onChange={(e) =>
                setForm({ ...form, subject: e.target.value, parent_id: null })
              }
            />
          </label>
          <label>
            Üst kayıt
            <select
              value={form.parent_id ?? ""}
              onChange={(e) =>
                setForm({ ...form, parent_id: e.target.value || null })
              }
            >
              <option value="">Yok (yalnızca ders)</option>
              {options.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.kind} · {n.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Başlık
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Öğrenme çıktısı kodu
            <input
              value={form.code ?? ""}
              onChange={(e) =>
                setForm({ ...form, code: e.target.value || null })
              }
            />
          </label>
          <div className="form-pair">
            <label>
              Akademik yıl
              <input
                value={form.academic_year}
                onChange={(e) =>
                  setForm({ ...form, academic_year: e.target.value })
                }
              />
            </label>
            <label>
              Müfredat sürümü
              <input
                value={form.curriculum_version}
                onChange={(e) =>
                  setForm({ ...form, curriculum_version: e.target.value })
                }
              />
            </label>
          </div>
          <label>
            Resmî kaynak URL
            <input
              type="url"
              value={form.source_url ?? ""}
              onChange={(e) =>
                setForm({ ...form, source_url: e.target.value || null })
              }
              placeholder="https://tymm.meb.gov.tr/…"
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.verified}
              onChange={(e) => setForm({ ...form, verified: e.target.checked })}
            />
            Kaynağı ve kapsamı inceleyerek doğruladım
          </label>
          <label>
            Öğretim içeriği (JSON)
            <textarea
              rows={8}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
          </label>
          <small>
            sections: [&#123;heading, text&#125;], mini: &#123;prompt,
            answer&#125;. Kaynak metinlerini telif ve kullanım koşullarıyla
            birlikte değerlendirin.
          </small>
          <ActionStatus {...action} />
          <div className="form-actions">
            <button className="button primary" disabled={action.busy}>
              Kaydet
            </button>
            {editing && (
              <button type="button" className="button subtle" onClick={reset}>
                Yeni kayıt
              </button>
            )}
          </div>
        </form>
      </section>
      <section className="panel">
        <h2>Müfredat ağacı</h2>
        <label>
          Kaydı bul
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Başlık, ders, tür…"
          />
        </label>
        <ErrorBox message={error} />
        {loading && !data ? (
          <Loading />
        ) : (
          <div className="admin-record-list">
            {data
              ?.filter((n) =>
                (n.title + " " + n.subject + " " + n.kind)
                  .toLocaleLowerCase("tr")
                  .includes(filter.toLocaleLowerCase("tr")),
              )
              .map((n) => (
                <div className="admin-record" key={n.id}>
                  <div>
                    <small>
                      {n.grade}. sınıf · {n.subject} · {n.kind}
                    </small>
                    <strong>{n.title}</strong>
                    <span
                      className={"badge " + (n.verified ? "verified" : "draft")}
                    >
                      {n.verified ? "Doğrulandı" : "Doğrulanmadı"}
                    </span>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={n.title + " düzenle"}
                    onClick={() => {
                      setEditing(n.id);
                      setForm({
                        parent_id: n.parent_id,
                        kind: n.kind,
                        title: n.title,
                        grade: n.grade as 7 | 8,
                        subject: n.subject,
                        code: n.code,
                        source_url: n.source_url,
                        academic_year: n.academic_year,
                        curriculum_version: n.curriculum_version,
                        verified: n.verified,
                        payload: n.payload,
                      });
                      setPayload(JSON.stringify(n.payload, null, 2));
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={n.title + " sil"}
                    disabled={action.busy}
                    onClick={() =>
                      action.run(async () => {
                        await api("admin/nodes/" + n.id, "DELETE", {});
                        reload();
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
function QuestionManager() {
  const { data, error, loading, reload } =
    useResource<BankQuestion[]>("admin/questions");
  const { data: nodes } = useResource<Node[]>("admin/nodes");
  const [editing, setEditing] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("draft");
  const [question, setQuestion] = useState(
    JSON.stringify(blankQuestion, null, 2),
  );
  const [preview, setPreview] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const action = useAction();
  return (
    <div className="admin-editor-layout">
      <section className="panel">
        <h2>{editing ? "Soruyu düzenle" : "Özgün soru ekle"}</h2>
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await api(
                "admin/questions" + (editing ? "/" + editing : ""),
                editing ? "PUT" : "POST",
                { topic_id: topic, question: JSON.parse(question), status },
              );
              setEditing(null);
              setQuestion(JSON.stringify(blankQuestion, null, 2));
              setPreview(null);
              reload();
            }, "Soru kaydedildi.");
          }}
        >
          <label>
            Konu
            <select
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              <option value="">Konu seç</option>
              {nodes
                ?.filter((n) => n.kind === "topic")
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.grade} · {n.subject} · {n.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Soru verisi (JSON)
            <textarea
              rows={16}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <label>
            Durum
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">Taslak</option>
              <option value="approved">İnceledim · Onayla</option>
              <option value="rejected">Reddet</option>
            </select>
          </label>
          <small>
            Onaylanan sorular öğrencilerin testlerinde kullanılabilir.
            Düzenlenen sorunun cevap ve çözümünü yeniden inceleyin.
          </small>
          <ActionStatus {...action} />
          <div className="form-actions">
            <button
              className="button subtle"
              type="button"
              onClick={() =>
                action.run(async () => {
                  const q = JSON.parse(question);
                  setPreview({
                    ...q,
                    id: editing ?? "preview",
                    topic_id: topic,
                  });
                  setAnswer("");
                })
              }
            >
              Önizle
            </button>
            <button className="button primary" disabled={action.busy}>
              Kaydet
            </button>
          </div>
        </form>
        {preview && (
          <div className="question-preview">
            <QuestionRenderer
              question={preview}
              value={answer}
              onChange={setAnswer}
            />
            <p>Doğru cevap: {preview.answer}</p>
            <p>{preview.explanation}</p>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Soru bankası</h2>
        <ErrorBox message={error} />
        {loading && !data ? (
          <Loading />
        ) : (
          <div className="admin-record-list">
            {data?.map((q) => (
              <div className="admin-record" key={q.id}>
                <div>
                  <small>
                    {q.grade} · {q.topic} · {q.kind}
                  </small>
                  <strong>{q.prompt}</strong>
                  <span className="badge">
                    {q.status} · {q.origin}
                  </span>
                </div>
                <button
                  className="icon-button"
                  aria-label="Soruyu düzenle"
                  onClick={() => {
                    setEditing(q.id);
                    setTopic(q.topic_id);
                    setStatus(q.status === "validated" ? "draft" : q.status);
                    setQuestion(
                      JSON.stringify(
                        {
                          kind: q.kind,
                          prompt: q.prompt,
                          options: q.options ?? null,
                          answer: q.answer,
                          explanation: q.explanation,
                          difficulty: q.difficulty,
                          passage: q.passage ?? null,
                          payload: {
                            image: q.payload.image ?? null,
                            table: q.payload.table ?? null,
                            points: q.payload.points ?? null,
                            pairs: q.payload.pairs ?? null,
                          },
                        },
                        null,
                        2,
                      ),
                    );
                  }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label="Soruyu sil"
                  disabled={action.busy}
                  onClick={() =>
                    action.run(async () => {
                      await api("admin/questions/" + q.id, "DELETE", {});
                      reload();
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
function AIGenerator() {
  const { data: nodes } = useResource<Node[]>("admin/nodes");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("mixed");
  const [kind, setKind] = useState("multiple_choice");
  const [count, setCount] = useState(5);
  const action = useAction();
  return (
    <section className="panel max-form">
      <h2>AI soru üretici</h2>
      <p className="muted">
        Üretim ve bağımsız doğrulama iki ayrı AI çağrısıyla yapılır. Başarısız
        sorular öğrenciye sunulmaz.
      </p>
      <form
        className="stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            const result = await api<{ ids: string[] }>(
              "admin/generate",
              "POST",
              { topic_id: topic, difficulty, kind, count },
            );
            if (!result.ids.length) throw new Error("Soru üretilmedi.");
          }, "Doğrulanan sorular bankaya kaydedildi. Önizleme ve düzenleme için Soru bankası sekmesini aç.");
        }}
      >
        <label>
          Sınıf / ders / konu / kazanım
          <select
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            <option value="">Doğrulanmış konu seç</option>
            {nodes
              ?.filter((n) => n.kind === "topic" && n.verified)
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.grade} · {n.subject} · {n.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          Zorluk
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            {[
              ["easy", "Kolay"],
              ["medium", "Orta"],
              ["hard", "Zor"],
              ["mixed", "Karışık"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Soru tipi
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {[
              "multiple_choice",
              "true_false",
              "fill_blank",
              "matching",
              "numeric",
              "short_answer",
              "reading_comprehension",
              "table_question",
              "graph_question",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Soru sayısı
          <input
            type="number"
            value={count}
            min={1}
            max={20}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        <ActionStatus {...action} />
        <button className="button primary" disabled={action.busy}>
          <Sparkles size={17} />
          {action.busy ? "Üretiliyor ve doğrulanıyor…" : "Üret ve doğrula"}
        </button>
      </form>
    </section>
  );
}
function UserManager() {
  const { data, error, reload } = useResource<AdminUser[]>("admin/users");
  const { data: links, reload: reloadLinks } =
    useResource<{ parent_id: string; student_id: string }[]>("admin/links");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [grade, setGrade] = useState(7);
  const [parent, setParent] = useState("");
  const [student, setStudent] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const action = useAction();
  return (
    <div className="admin-editor-layout">
      <div>
        <section className="panel">
          <h2>{edit ? "Kullanıcıyı düzenle" : "Hesap oluştur"}</h2>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                if (edit)
                  await api("admin/users/" + edit, "PUT", { name, grade });
                else
                  await api("admin/users", "POST", {
                    name,
                    email,
                    password,
                    role,
                    grade,
                  });
                setName("");
                setEmail("");
                setPassword("");
                setEdit(null);
                reload();
              }, "Hesap kaydedildi.");
            }}
          >
            <label>
              Ad
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {!edit && (
              <>
                <label>
                  E-posta
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Başlangıç parolası
                  <input
                    required
                    minLength={12}
                    maxLength={128}
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  Rol
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option>STUDENT</option>
                    <option>PARENT</option>
                    <option>ADMIN</option>
                  </select>
                </label>
              </>
            )}
            <label>
              Sınıf
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
              >
                <option value={7}>7. sınıf</option>
                <option value={8}>8. sınıf</option>
              </select>
            </label>
            <ActionStatus {...action} />
            <div className="form-actions">
              <button className="button primary" disabled={action.busy}>
                Kaydet
              </button>
              {edit && (
                <button
                  type="button"
                  className="button subtle"
                  onClick={() => {
                    setEdit(null);
                    setName("");
                  }}
                >
                  Yeni hesap
                </button>
              )}
            </div>
          </form>
        </section>
        <section className="panel">
          <h2>Ebeveyn bağlantısı</h2>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                await api("admin/links", "POST", {
                  parent_id: parent,
                  student_id: student,
                });
                reloadLinks();
              }, "Bağlantı oluşturuldu.");
            }}
          >
            <label>
              Ebeveyn
              <select
                required
                value={parent}
                onChange={(e) => setParent(e.target.value)}
              >
                <option value="">Seç</option>
                {data
                  ?.filter((u) => u.role === "PARENT")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Öğrenci
              <select
                required
                value={student}
                onChange={(e) => setStudent(e.target.value)}
              >
                <option value="">Seç</option>
                {data
                  ?.filter((u) => u.role === "STUDENT")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </label>
            <button className="button subtle" disabled={action.busy}>
              <Link2 size={17} /> Bağla
            </button>
          </form>
          {links?.map((l) => (
            <div className="admin-record" key={l.parent_id + l.student_id}>
              <span>
                {data?.find((u) => u.id === l.parent_id)?.name} →{" "}
                {data?.find((u) => u.id === l.student_id)?.name}
              </span>
              <button
                className="icon-button danger"
                aria-label="Bağlantıyı kaldır"
                disabled={action.busy}
                onClick={() =>
                  action.run(async () => {
                    await api("admin/links", "DELETE", l);
                    reloadLinks();
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </section>
      </div>
      <section className="panel">
        <h2>Kullanıcılar</h2>
        <ErrorBox message={error} />
        {data?.map((u) => (
          <div className="admin-record" key={u.id}>
            <div>
              <strong>{u.name}</strong>
              <small>{u.email}</small>
              <span className="badge">
                {u.role} · {u.grade}
              </span>
            </div>
            <button
              className="icon-button"
              aria-label={u.name + " düzenle"}
              onClick={() => {
                setEdit(u.id);
                setName(u.name);
                setGrade(u.grade);
              }}
            >
              <Pencil size={16} />
            </button>
            <button
              className="icon-button danger"
              aria-label={u.name + " sil"}
              disabled={action.busy}
              onClick={() =>
                action.run(async () => {
                  await api("admin/users/" + u.id, "DELETE", {});
                  reload();
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
function AdminReadTable({ resource }: { resource: string }) {
  const { data, error, loading } = useResource<Record<string, unknown>[]>(
    "admin/" + resource,
  );
  return (
    <section className="panel">
      <h2>{resource === "tests" ? "Test kayıtları" : "Müfredat kaynakları"}</h2>
      <ErrorBox message={error} />
      {loading && !data ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="Henüz kayıt yok" />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {Object.keys(data[0]).map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  {Object.entries(row).map(([k, v]) => (
                    <td key={k}>
                      {typeof v === "object"
                        ? JSON.stringify(v)
                        : String(v ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TestManager() {
  const [archived, setArchived] = useState(false);
  const { data, error, reload } = useResource<
    {
      id: string;
      name: string;
      title: string;
      mode: string;
      answered: number;
      archived: boolean;
    }[]
  >("admin/tests" + (archived ? "?include_archived=true" : ""));
  const { data: users } = useResource<AdminUser[]>("admin/users");
  const { data: nodes } = useResource<Node[]>("admin/nodes");
  const [student, setStudent] = useState("");
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState("practice");
  const [edit, setEdit] = useState<string | null>(null);
  const action = useAction();
  const grade = users?.find((u) => u.id === student)?.grade;
  return (
    <div className="admin-editor-layout">
      <section className="panel">
        <h2>{edit ? "Test başlığını düzenle" : "Öğrenciye test hazırla"}</h2>
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await api(
                "admin/tests" + (edit ? "/" + edit : ""),
                edit ? "PUT" : "POST",
                edit
                  ? { title }
                  : {
                      student_id: student,
                      topic_id: topic,
                      title,
                      count,
                      mode,
                    },
              );
              setEdit(null);
              setTitle("");
              reload();
            }, "Test kaydedildi.");
          }}
        >
          <label>
            Başlık
            <input
              required
              minLength={2}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          {!edit && (
            <>
              <label>
                Öğrenci
                <select
                  required
                  value={student}
                  onChange={(e) => {
                    setStudent(e.target.value);
                    setTopic("");
                  }}
                >
                  <option value="">Seç</option>
                  {users
                    ?.filter((u) => u.role === "STUDENT")
                    .map((u) => (
                      <option value={u.id} key={u.id}>
                        {u.name} · {u.grade}. sınıf
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Konu
                <select
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                >
                  <option value="">Seç</option>
                  {nodes
                    ?.filter((n) => n.kind === "topic" && n.grade === grade)
                    .map((n) => (
                      <option value={n.id} key={n.id}>
                        {n.subject} · {n.title}
                      </option>
                    ))}
                </select>
              </label>
              <div className="form-pair">
                <label>
                  Soru sayısı
                  <select
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                  >
                    {[5, 10, 15, 20].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Mod
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="practice">Konu çalışması</option>
                    <option value="mock">Süreli deneme</option>
                  </select>
                </label>
              </div>
            </>
          )}
          <ActionStatus {...action} />
          <div className="form-actions">
            <button className="button primary" disabled={action.busy}>
              Kaydet
            </button>
            {edit && (
              <button
                className="button subtle"
                type="button"
                onClick={() => {
                  setEdit(null);
                  setTitle("");
                }}
              >
                Yeni test
              </button>
            )}
          </div>
        </form>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Test kayıtları</h2>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Arşivleri göster
        </label>
        <ErrorBox message={error} />
        {data?.map((t) => (
          <div className="admin-record" key={t.id}>
            <div>
              <strong>{t.title}</strong>
              <small>
                {t.name} · {t.mode} · {t.answered} cevap
              </small>
              <span className="badge">{t.archived ? "Arşivde" : "Aktif"}</span>
            </div>
            <button
              className="icon-button"
              aria-label={t.title + " düzenle"}
              onClick={() => {
                setEdit(t.id);
                setTitle(t.title);
              }}
            >
              <Pencil size={16} />
            </button>
            {t.archived ? (
              <button
                className="button subtle"
                disabled={action.busy}
                onClick={() =>
                  action.run(async () => {
                    await api("admin/tests/" + t.id, "PUT", {
                      archived: false,
                    });
                    reload();
                  })
                }
              >
                Geri al
              </button>
            ) : (
              <button
                className="icon-button danger"
                aria-label={t.title + " arşivle"}
                disabled={action.busy}
                onClick={() =>
                  action.run(async () => {
                    await api("admin/tests/" + t.id, "DELETE", {});
                    reload();
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
        {data?.length === 0 && <Empty title="Henüz test yok" />}
        <p className="muted">
          Arşivleme girişim ve performans kayıtlarını silmez.
        </p>
      </section>
    </div>
  );
}
