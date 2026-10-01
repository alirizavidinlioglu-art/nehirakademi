import type { Store } from "../lib/db";
import { randomUUID } from "node:crypto";
const subjects = [
  "Matematik",
  "Türkçe",
  "Fen Bilimleri",
  "Sosyal Bilgiler",
  "İngilizce",
  "Din Kültürü ve Ahlak Bilgisi",
];
export async function seed(db: Store) {
  await db.transaction(async (tx) => {
    for (const grade of [7, 8]) {
      await tx.query(
        "INSERT INTO grades(id,number) VALUES($1,$2) ON CONFLICT(number) DO NOTHING",
        [randomUUID(), grade],
      );
      for (const base of subjects) {
        const title =
          grade === 8 && base === "Sosyal Bilgiler"
            ? "T.C. İnkılap Tarihi ve Atatürkçülük"
            : base;
        const rows = await tx.query(
          "SELECT id FROM curriculum_nodes WHERE grade=$1 AND kind=$2 AND title=$3",
          [grade, "subject", title],
        );
        if (!rows.length)
          await tx.query(
            "INSERT INTO curriculum_nodes(id,kind,title,grade,subject,payload) VALUES($1,$2,$3,$4,$3,$5)",
            [
              randomUUID(),
              "subject",
              title,
              grade,
              JSON.stringify({
                description: "Resmî program doğrulaması bekleniyor.",
              }),
            ],
          );
      }
    }
    await seedPractice(tx);
    await tx.query(
      "INSERT INTO academic_years(id,title) VALUES($1,$2) ON CONFLICT(title) DO NOTHING",
      [randomUUID(), "2026-2027"],
    );
    for (const [code, title, threshold, kind] of [
      ["first100", "İlk 100 Soru", 100, "questions"],
      ["fivehundred", "500 Soru", 500, "questions"],
      ["thousand", "1000 Soru", 1000, "questions"],
      ["week", "7 Günlük Seri", 7, "streak"],
      ["month", "30 Günlük Seri", 30, "streak"],
      ["perfect", "10/10", 10, "perfect"],
    ] as const)
      await tx.query(
        "INSERT INTO badges(id,code,title,threshold,kind) VALUES($1,$2,$3,$4,$5) ON CONFLICT(code) DO NOTHING",
        [randomUUID(), code, title, threshold, kind],
      );
  });
}

async function seedPractice(tx: Store) {
  // These are authored practice activities, NOT inferred MEB units or learning outcomes.
  for (const grade of [7, 8]) {
    const subject = (
      await tx.query(
        "SELECT id FROM curriculum_nodes WHERE kind=$1 AND grade=$2 AND title=$3",
        ["subject", grade, "Matematik"],
      )
    )[0];
    let unit = (
      await tx.query(
        "SELECT id FROM curriculum_nodes WHERE parent_id=$1 AND curriculum_version=$2",
        [subject.id, "ORIGINAL_PRACTICE"],
      )
    )[0];
    if (!unit) {
      const id = randomUUID();
      await tx.query(
        "INSERT INTO curriculum_nodes(id,parent_id,kind,title,grade,subject,curriculum_version) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          subject.id,
          "unit",
          "Bağımsız çalışma atölyesi",
          grade,
          "Matematik",
          "ORIGINAL_PRACTICE",
        ],
      );
      unit = { id };
    }
    let topic = (
      await tx.query(
        "SELECT id FROM curriculum_nodes WHERE parent_id=$1 AND kind=$2",
        [unit.id, "topic"],
      )
    )[0];
    if (!topic) {
      const id = randomUUID();
      const payload = {
        sections: [
          {
            heading: "Bu çalışma nedir?",
            text: "Bu bağımsız atölyede sayı işlemlerini gerekçeleriyle birlikte çalışıyoruz. Bu içerik, MEB programı veya resmî öğrenme çıktısı olarak sunulmaz.",
          },
          {
            heading: "Bilmen gerekenler",
            text: "Pozitif sayılar sıfırın sağında, negatif sayılar solundadır. Sayı doğrusunda sağa gitmek artırır, sola gitmek azaltır.",
          },
          {
            heading: "Temel kural",
            text: "Bir sayıya negatif sayı eklemek, sayı doğrusunda sola ilerlemektir. Örneğin $7 + (-3) = 4$.",
          },
          {
            heading: "Birlikte bir örnek",
            text: "$-4 + 9$ işleminde −4’ten başla. Sağa 9 birim ilerle. Sıfıra ulaşmak için 4 birim, geriye kalan 5 birim sağa ilerlersin. Sonuç 5 olur.",
          },
          {
            heading: "Çözümlü örnek",
            text: "$-6 + (-2) = -8$. −6’dan başlıyoruz. −2 eklemek, iki birim daha sola gitmek demektir.",
          },
          {
            heading: "Sık yapılan hata",
            text: "Eksi işaretini görmezden gelme. −4 + 9 işlemi 4 + 9 değildir. Sayı doğrusunu çizerek yönü kontrol edebilirsin.",
          },
        ],
        mini: { prompt: "$-3 + 8$ işleminin sonucu kaçtır?", answer: "5" },
      };
      await tx.query(
        "INSERT INTO curriculum_nodes(id,parent_id,kind,title,grade,subject,curriculum_version,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          unit.id,
          "topic",
          "Özgün işlem alıştırmaları",
          grade,
          "Matematik",
          "ORIGINAL_PRACTICE",
          JSON.stringify(payload),
        ],
      );
      topic = { id };
    }
    await seedVariety(tx, String(topic.id));
    const count = (
      await tx.query(
        "SELECT count(*)::int AS n FROM questions WHERE topic_id=$1 AND origin=$2",
        [topic.id, "original_seed"],
      )
    )[0];
    if (Number(count.n)) continue;
    for (const difficulty of ["easy", "medium", "hard"])
      for (let i = 0; i < 20; i++) {
        const offset =
          difficulty === "easy" ? 0 : difficulty === "medium" ? 10 : 30;
        const a = i + 3 + offset,
          b = (i % 7) + 2;
        const negative = i % 2 === 0;
        const result = negative ? -a + b : a - b;
        const prompt = negative
          ? `$-${a} + ${b}$ işleminin sonucu kaçtır?`
          : `$${a} + (-${b})$ işleminin sonucu kaçtır?`;
        const answer = String(result);
        const options = [
          answer,
          String(result + 1),
          String(result - 2),
          String(result + 3),
        ];
        const rotate = i % 4;
        const ordered = [...options.slice(rotate), ...options.slice(0, rotate)];
        const explanation = negative
          ? `−${a} sayısına ${b} eklemek, sayı doğrusunda ${b} birim sağa ilerlemektir. Sonuç ${result} olur.`
          : `${a} sayısına −${b} eklemek, sayı doğrusunda ${b} birim sola ilerlemektir. ${a} − ${b} = ${result}.`;
        const id = randomUUID();
        const kind =
          i % 5 === 0
            ? "numeric"
            : i % 5 === 1
              ? "fill_blank"
              : "multiple_choice";
        await tx.query(
          "INSERT INTO questions(id,topic_id,kind,prompt,options,answer,explanation,difficulty,payload,status,origin) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            id,
            topic.id,
            kind,
            prompt,
            kind === "multiple_choice" ? JSON.stringify(ordered) : null,
            answer,
            explanation,
            difficulty,
            JSON.stringify({}),
            "approved",
            "original_seed",
          ],
        );
        await tx.query(
          "INSERT INTO question_validations(id,question_id,valid,report) VALUES($1,$2,true,$3)",
          [
            randomUUID(),
            id,
            JSON.stringify({
              type: "authored_arithmetic",
              verifiedBy: "exact_integer_computation",
              curriculumClaim: false,
            }),
          ],
        );
      }
  }
}

async function seedVariety(tx: Store, topicId: string) {
  const count = (
    await tx.query(
      "SELECT count(*)::int n FROM questions WHERE topic_id=$1 AND origin=$2",
      [topicId, "original_variety"],
    )
  )[0];
  if (Number(count.n)) return;
  const variants = [
    {
      kind: "true_false",
      prompt: "$-3 + 8 = 5$ ifadesi doğru mudur?",
      options: ["Doğru", "Yanlış"],
      answer: "Doğru",
      explanation: "−3’ten sağa 8 birim ilerlediğimizde 5’e ulaşırız.",
      payload: {},
    },
    {
      kind: "matching",
      prompt: "İşlemleri sonuçlarıyla eşleştir.",
      options: null,
      answer: "4|6",
      explanation: "2 + 2 = 4 ve 3 + 3 = 6.",
      payload: {
        pairs: [
          { left: "2 + 2", right: "4" },
          { left: "3 + 3", right: "6" },
        ],
      },
    },
    {
      kind: "short_answer",
      prompt: "$-2 + 8$ işleminin sonucunu kısaca yaz.",
      options: null,
      answer: "6",
      explanation: "−2’den sağa 8 birim ilerleyince 6’ya ulaşılır.",
      payload: {},
    },
    {
      kind: "reading_comprehension",
      prompt: "Elif’in okumadığı kaç sayfa kalmıştır?",
      passage:
        "Elif, 12 sayfalık bir öykünün 5 sayfasını okudu. Geri kalan sayfaları yarın okuyacak.",
      options: ["7", "17", "5", "6"],
      answer: "7",
      explanation: "Toplam 12 sayfadan okunan 5 sayfayı çıkarırız: 12 − 5 = 7.",
      payload: {},
    },
    {
      kind: "image_question",
      prompt: "Görseldeki dikdörtgenin alanı kaç santimetrekaredir?",
      options: ["24", "11", "16", "6"],
      answer: "24",
      explanation: "Dikdörtgenin alanı iki kenarın çarpımıdır: 8 × 3 = 24 cm².",
      payload: { image: "/question-images/rectangle.svg" },
    },
    {
      kind: "table_question",
      prompt: "İki günde toplam kaç soru çözülmüştür?",
      options: ["11", "3", "10", "14"],
      answer: "11",
      explanation: "Pazartesi 4 ve salı 7 soru çözülmüştür. 4 + 7 = 11.",
      payload: {
        table: [
          ["Gün", "Soru sayısı"],
          ["Pazartesi", "4"],
          ["Salı", "7"],
        ],
      },
    },
    {
      kind: "graph_question",
      prompt: "Grafikte x = 3 iken y kaçtır?",
      options: ["9", "6", "3", "12"],
      answer: "9",
      explanation: "x ekseninde 3 noktasına karşılık gelen y değeri 9’dur.",
      payload: {
        points: [
          { x: 1, y: 3 },
          { x: 2, y: 6 },
          { x: 3, y: 9 },
        ],
      },
    },
  ];
  for (const q of variants) {
    const id = randomUUID();
    await tx.query(
      "INSERT INTO questions(id,topic_id,kind,prompt,options,answer,explanation,difficulty,passage,payload,status,origin) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [
        id,
        topicId,
        q.kind,
        q.prompt,
        q.options ? JSON.stringify(q.options) : null,
        q.answer,
        q.explanation,
        "medium",
        "passage" in q ? q.passage : null,
        JSON.stringify(q.payload),
        "approved",
        "original_variety",
      ],
    );
    await tx.query(
      "INSERT INTO question_validations(id,question_id,valid,report) VALUES($1,$2,true,$3)",
      [
        randomUUID(),
        id,
        JSON.stringify({ type: "authored_practice", curriculumClaim: false }),
      ],
    );
  }
}
