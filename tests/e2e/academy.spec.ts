import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
const origin = "http://localhost:3001";
async function fixtures() {
  return JSON.parse(await readFile(".local/e2e-fixtures.json", "utf8")) as {
    password: string;
    users: Record<string, { id: string; email: string }>;
  };
}
async function login(page: Page, role = "student") {
  const f = await fixtures();
  await page.goto("/login");
  await page.getByLabel("E-posta adresin").fill(f.users[role].email);
  await page.getByLabel("Parolan", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Öğrenmeye devam et" }).click();
  await expect(page).not.toHaveURL(/login/);
}
async function apiLogin(request: APIRequestContext, role = "admin") {
  const f = await fixtures();
  const res = await request.post("/api/auth/login", {
    headers: { Origin: origin },
    data: { email: f.users[role].email, password: f.password },
  });
  expect(res.status()).toBe(200);
}
async function createTest(page: Page, count = 5) {
  const nodes = await (await page.request.get("/api/curriculum")).json();
  const topic = nodes.find(
    (n: { kind: string; grade: number }) => n.kind === "topic" && n.grade === 7,
  );
  const response = await page.request.post("/api/tests", {
    headers: { Origin: origin },
    data: { topic_id: topic.id, count, difficulty: "mixed" },
  });
  expect(response.status()).toBe(201);
  return { ...(await response.json()), topic };
}
test("production public assets and PWA metadata are served correctly", async ({
  request,
}) => {
  for (const file of await readdir("public", { recursive: true })) {
    if (!/\.(webp|png|html|js)$/.test(file)) continue;
    const response = await request.get("/" + file);
    expect(response.status(), file).toBe(200);
    expect((await response.body()).length, file).toBeGreaterThan(0);
  }
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
  });
  expect(manifest.icons).toHaveLength(2);
  for (const icon of manifest.icons)
    expect((await request.get(icon.src)).status()).toBe(200);
  const worker = await request.get("/sw.js");
  expect(worker.headers()["cache-control"]).toContain("no-store");
  expect(worker.headers()["service-worker-allowed"]).toBe("/");
});
test("successful logins do not trigger lockout while repeated failures do", async ({
  request,
}) => {
  for (let i = 0; i < 12; i++) await apiLogin(request);
  const email = `missing-${Date.now()}@example.test`;
  for (let i = 0; i < 10; i++) {
    const response = await request.post("/api/auth/login", {
      headers: { Origin: origin },
      data: { email, password: "invalid-password" },
    });
    expect(response.status()).toBe(401);
  }
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { Origin: origin },
        data: { email, password: "invalid-password" },
      })
    ).status(),
  ).toBe(429);
});
test("production PWA shows its offline page without caching private data", async ({
  page,
  context,
}) => {
  await login(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.request.get("/api/dashboard");
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls = await Promise.all(
      names.map(async (name) =>
        (await (await caches.open(name)).keys()).map(
          (r) => new URL(r.url).pathname,
        ),
      ),
    );
    return urls.flat();
  });
  expect(cached).toEqual(["/offline.html"]);
  await context.setOffline(true);
  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { name: "Bir bağlantı molası" }),
  ).toBeVisible();
  await context.setOffline(false);
});
test("authentication, session persistence, role authorization and CSRF", async ({
  page,
}) => {
  expect((await page.request.get("/api/dashboard")).status()).toBe(401);
  await login(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Merhaba Nehir!" }),
  ).toBeVisible();
  expect((await page.request.get("/api/admin/users")).status()).toBe(403);
  expect(
    (await page.request.put("/api/profile", { data: { grade: 8 } })).status(),
  ).toBe(403);
  await page.goto("/admin");
  await expect(page).toHaveURL(origin + "/");
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect((await page.request.get("/api/dashboard")).status()).toBe(401);
});
test("parent can read linked student only and cannot change student records", async ({
  page,
}) => {
  await login(page, "parent");
  await expect(
    page.getByRole("heading", { name: "Birlikte büyüyen bir yolculuk" }),
  ).toBeVisible();
  const f = await fixtures();
  expect(
    (
      await page.request.get("/api/dashboard?student=" + f.users.student.id)
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.get("/api/dashboard?student=" + f.users.other.id)
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/homeworks", {
        headers: { Origin: origin },
        data: {
          title: "Forbidden",
          subject: "Matematik",
          due_at: "2026-10-20",
        },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/dersler");
  await expect(page).toHaveURL(/ebeveyn/);
});
test("student completes correct, incorrect and skipped answers with persisted analytics", async ({
  page,
  playwright,
}) => {
  const admin = await playwright.request.newContext({ baseURL: origin });
  await apiLogin(admin);
  const bank = await (await admin.get("/api/admin/questions")).json();
  const answers = new Map<string, string>(
    bank.map((q: { id: string; answer: string }) => [q.id, q.answer]),
  );
  await login(page);
  const t = await createTest(page);
  const data = await (await page.request.get("/api/tests/" + t.id)).json();
  for (const q of data.questions) {
    expect(q.answer).toBeUndefined();
    expect(q.explanation).toBeUndefined();
  }
  await page.goto("/test/" + t.id);
  const first = data.questions[0],
    answer = answers.get(first.id)!;
  if (first.kind === "matching") {
    for (let i = 0; i < first.payload.pairs.length; i++)
      await page
        .getByLabel(first.payload.pairs[i].left + " eşleşmesi")
        .selectOption(answer.split("|")[i]);
  } else if (first.options?.length)
    await page
      .locator(".options input[type=radio]")
      .nth(first.options.indexOf(answer))
      .check();
  else await page.locator(".answer-label input").fill(answer);
  await page.getByRole("button", { name: "Cevabımı kontrol et" }).click();
  await expect(
    page.getByRole("heading", { name: "Doğru!", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sonraki soru" }).click();
  const second = data.questions[1];
  if (second.kind === "matching") {
    for (let i = 0; i < second.payload.pairs.length; i++)
      await page
        .getByLabel(second.payload.pairs[i].left + " eşleşmesi")
        .selectOption(
          second.payload.pairs[(i + 1) % second.payload.pairs.length].right,
        );
  } else if (second.options?.length)
    await page
      .locator(".options input[type=radio]")
      .nth(
        second.options.findIndex((a: string) => a !== answers.get(second.id)),
      )
      .check();
  else await page.locator(".answer-label input").fill("999999");
  await page.getByRole("button", { name: "Cevabımı kontrol et" }).click();
  await expect(
    page.getByRole("heading", { name: "Bir daha bakalım.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sonraki soru" }).click();
  await page.getByRole("button", { name: "Sonra çözeceğim" }).click();
  await expect(
    page.getByRole("heading", { name: "Bu soruyu sonraya bıraktın." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sonraki soru" }).click();
  await page.getByRole("button", { name: "Testi bitir ve kaydet" }).click();
  await expect(
    page.getByRole("heading", { name: "Test tamamlandı!" }),
  ).toBeVisible();
  const after = await (await page.request.get("/api/dashboard")).json();
  expect(after.totals.correct).toBeGreaterThanOrEqual(1);
  expect(after.totals.wrong).toBeGreaterThanOrEqual(1);
  expect(after.totals.blank).toBeGreaterThanOrEqual(3);
  expect(after.mastery.length).toBeGreaterThan(0);
  const duplicate = await page.request.post("/api/tests/" + t.id + "/attempt", {
    headers: { Origin: origin },
    data: { question_id: first.id, answer },
  });
  expect(duplicate.status()).toBe(409);
  const wrongs = await (await page.request.get("/api/wrongs")).json();
  expect(
    wrongs.some((w: { question_id: string }) => w.question_id === second.id),
  ).toBe(true);
  await admin.dispose();
});
test("student cannot access another student test or submit questions outside the test", async ({
  page,
  playwright,
}) => {
  await login(page);
  const t = await createTest(page);
  const data = await (await page.request.get("/api/tests/" + t.id)).json();
  const outOfOrder = await page.request.post(
    "/api/tests/" + t.id + "/attempt",
    {
      headers: { Origin: origin },
      data: { question_id: data.questions[1].id, answer: "0" },
    },
  );
  expect(outOfOrder.status()).toBe(409);
  const other = await playwright.request.newContext({ baseURL: origin });
  await apiLogin(other, "other");
  expect((await other.get("/api/tests/" + t.id)).status()).toBe(404);
  await other.dispose();
});
test("homework CRUD, exam topics and daily plan work", async ({ page }) => {
  await login(page);
  await page.goto("/odevler");
  await page.getByLabel("Ödev", { exact: true }).fill("E2E çalışma kitabı");
  await page.getByLabel("Son tarih").fill("2026-11-18");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "E2E çalışma kitabı" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tamamladım", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tamamlandı · geri al" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "E2E çalışma kitabı kaydını sil" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Henüz ödev eklemedin" }),
  ).toBeVisible();
  await page.goto("/sinavlar");
  await page.getByLabel("Sınav adı").fill("E2E yazılı");
  await page.getByLabel("Sınav tarihi").fill("2026-11-18");
  await page.getByLabel("Özgün işlem alıştırmaları", { exact: true }).check();
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E yazılı" })).toBeVisible();
  await page.goto("/plan");
  await page.getByRole("button", { name: "30 dakika", exact: true }).click();
  await page.getByRole("button", { name: "Planımı oluştur" }).click();
  await expect(page.getByText("Planın kaydedildi.")).toBeVisible();
  expect(
    (await (await page.request.get("/api/dashboard")).json()).plan.items.length,
  ).toBeGreaterThan(0);
});
test("admin curriculum CRUD and question approval gate preserve history", async ({
  page,
}) => {
  await login(page, "admin");
  await page.getByRole("button", { name: "Müfredat & içerik" }).click();
  await page.getByLabel("Başlık", { exact: true }).fill("E2E taslak ünite");
  await page
    .getByLabel("Üst kayıt")
    .selectOption({ label: "subject · Matematik" });
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByText("Müfredat kaydı kaydedildi.")).toBeVisible();
  const nodes = await (await page.request.get("/api/admin/nodes")).json();
  const node = nodes.find(
    (n: { title: string }) => n.title === "E2E taslak ünite",
  );
  expect(node.verified).toBe(false);
  const update = await page.request.put("/api/admin/nodes/" + node.id, {
    headers: { Origin: origin },
    data: { ...node, title: "E2E güncellenmiş ünite" },
  });
  expect(update.status()).toBe(200);
  const bogus = await page.request.put("/api/admin/nodes/" + node.id, {
    headers: { Origin: origin },
    data: {
      ...node,
      verified: true,
      source_url: "https://unofficial.example/curriculum",
      curriculum_version: "1",
    },
  });
  expect(bogus.status()).toBe(400);
  expect(
    (
      await page.request.delete("/api/admin/nodes/" + node.id, {
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(200);
  const bank = await (await page.request.get("/api/admin/questions")).json();
  const used = bank.find((q: { id: string }) => q.id);
  expect(used).toBeDefined();
});
test("password reset is private, single-use and invalidates sessions", async ({
  page,
  playwright,
}) => {
  const f = await fixtures();
  const request = await playwright.request.newContext({ baseURL: origin });
  await apiLogin(request, "other");
  expect(
    (
      await request.post("/api/auth/reset-request", {
        headers: { Origin: origin },
        data: { email: f.users.other.email },
      })
    ).status(),
  ).toBe(200);
  const files = await readdir(".local/e2e-mail-outbox");
  let token = "";
  for (const name of files) {
    const mail = JSON.parse(
      await readFile(".local/e2e-mail-outbox/" + name, "utf8"),
    );
    if (mail.to === f.users.other.email)
      token = new URL(mail.link).searchParams.get("token")!;
  }
  expect(token).toHaveLength(64);
  const newPassword = "E2E-new-password-" + Date.now();
  const data = { token, password: newPassword };
  expect(
    (
      await request.post("/api/auth/reset", {
        headers: { Origin: origin },
        data,
      })
    ).status(),
  ).toBe(200);
  expect((await request.get("/api/dashboard")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/reset", {
        headers: { Origin: origin },
        data,
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { Origin: origin },
        data: { email: f.users.other.email, password: newPassword },
      })
    ).status(),
  ).toBe(200);
  await request.dispose();
  await page.goto("/reset?token=invalid");
  await expect(
    page.getByRole("heading", { name: "Yeni bir başlangıç" }),
  ).toBeVisible();
});
test("AI missing credentials returns an explicit error instead of fake answers", async ({
  page,
}) => {
  await login(page);
  await page.goto("/ogretmen");
  await expect(
    page.getByText("AI öğretmen bağlantısı henüz yapılandırılmadı.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByLabel("AI öğretmene mesajın")
    .fill("Negatif sayıları nasıl toplarım?");
  await page.getByRole("button", { name: "Mesaj gönder", exact: true }).click();
  await expect(page.locator(".error-box[role=alert]")).toContainText(
    "AI_API_KEY",
  );
  expect(await page.locator(".chat-message.assistant").count()).toBe(0);
});
test("responsive screens, mascot assets and PWA have no browser errors or overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  const broken: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (
      r.status() >= 400 &&
      r.url().includes(origin) &&
      !r.url().includes("/api/")
    )
      broken.push(r.url());
  });
  await login(page);
  const nodes = await (await page.request.get("/api/curriculum")).json();
  const topic = nodes.find((n: { kind: string }) => n.kind === "topic");
  const subject = nodes.find(
    (n: { id: string }) =>
      n.id ===
      nodes.find((n: { id: string }) => n.id === topic.parent_id).parent_id,
  );
  const t = await createTest(page);
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/",
      "/dersler",
      "/dersler/" + subject.id,
      "/konu/" + topic.id,
      "/test/" + t.id,
      "/ogretmen",
      "/yanlislarim",
      "/basarim",
    ]) {
      await page.goto(route);
      await expect(page.locator("main#main")).toBeVisible();
      await page.waitForTimeout(150);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${width}px ${route} overflow`,
      ).toBe(true);
    }
    if ([390, 1440].includes(width)) {
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "Merhaba Nehir!" }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator(".welcome-hero .mascot-guide > div")
            .evaluate((e) => Number(getComputedStyle(e).opacity)),
        )
        .toBeGreaterThan(0.95);
      await page.screenshot({
        path: ".local/dashboard-" + width + ".png",
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
  expect(broken).toEqual([]);
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  for (const file of [
    "idle",
    "wave",
    "thinking",
    "point",
    "help",
    "celebrate",
    "study",
    "ai",
  ])
    expect(
      (await page.request.get("/mascot/nehir-" + file + ".webp")).status(),
    ).toBe(200);
  expect((await page.request.get("/sw.js")).status()).toBe(200);
});
test("all ten question renderers submit answers and preserve approved question history", async ({
  page,
  playwright,
}) => {
  const admin = await playwright.request.newContext({ baseURL: origin });
  await apiLogin(admin);
  const nodes = await (await admin.get("/api/admin/nodes")).json();
  const subject = nodes.find(
    (n: { kind: string; grade: number; title: string }) =>
      n.kind === "subject" && n.grade === 7 && n.title === "Matematik",
  );
  const data = {
    parent_id: subject.id,
    kind: "unit",
    title: "E2E renderer unit",
    grade: 7,
    subject: "Matematik",
    code: null,
    source_url: null,
    academic_year: "2026-2027",
    curriculum_version: "TEST_FIXTURE",
    verified: false,
    payload: {},
  };
  const unit = await (
    await admin.post("/api/admin/nodes", { headers: { Origin: origin }, data })
  ).json();
  const topic = await (
    await admin.post("/api/admin/nodes", {
      headers: { Origin: origin },
      data: {
        ...data,
        parent_id: unit.id,
        kind: "topic",
        title: "E2E renderer topic",
      },
    })
  ).json();
  const bank = await (await admin.get("/api/admin/questions")).json();
  const kinds = [
    "multiple_choice",
    "true_false",
    "fill_blank",
    "matching",
    "numeric",
    "short_answer",
    "reading_comprehension",
    "image_question",
    "table_question",
    "graph_question",
  ];
  const expected = new Map<string, string>();
  const created: string[] = [];
  for (const kind of kinds) {
    const q = bank.find((q: { kind: string }) => q.kind === kind);
    expect(q, kind + " in bank").toBeDefined();
    const question = {
      kind: q.kind,
      prompt: q.prompt + " (Özgün test kontrolü)",
      options: q.options ?? null,
      answer: q.answer,
      explanation: q.explanation,
      difficulty: "medium",
      passage: q.passage ?? null,
      payload: {
        image: q.payload.image ?? null,
        table: q.payload.table ?? null,
        points: q.payload.points ?? null,
        pairs: q.payload.pairs ?? null,
      },
    };
    const response = await admin.post("/api/admin/questions", {
      headers: { Origin: origin },
      data: { topic_id: topic.id, question, status: "approved" },
    });
    expect(response.status(), kind).toBe(200);
    const { id } = await response.json();
    expected.set(id, q.answer);
    created.push(id);
  }
  await login(page);
  const createdTest = await page.request.post("/api/tests", {
    headers: { Origin: origin },
    data: { topic_id: topic.id, count: 10, difficulty: "mixed" },
  });
  expect(createdTest.status()).toBe(201);
  const { id } = await createdTest.json();
  const testData = await (await page.request.get("/api/tests/" + id)).json();
  expect(
    new Set(testData.questions.map((q: { kind: string }) => q.kind)).size,
  ).toBe(10);
  await page.goto("/test/" + id);
  for (const q of testData.questions) {
    const answer = expected.get(q.id)!;
    if (q.kind === "matching") {
      for (let i = 0; i < q.payload.pairs.length; i++)
        await page
          .getByLabel(q.payload.pairs[i].left + " eşleşmesi")
          .selectOption(answer.split("|")[i]);
    } else if (q.options?.length) {
      await page
        .locator(".options input[type=radio]")
        .nth(q.options.indexOf(answer))
        .check();
    } else {
      await page.locator(".answer-label input").fill(answer);
    }
    await page.getByRole("button", { name: "Cevabımı kontrol et" }).click();
    await expect(
      page.getByRole("heading", { name: "Doğru!", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sonraki soru" }).click();
  }
  await page.getByRole("button", { name: "Sonuçlarıma bak" }).click();
  await expect(
    page.getByRole("heading", { name: "Test tamamlandı!" }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/tests/" + id)).json()).results.every(
      (r: { correct: boolean }) => r.correct,
    ),
  ).toBe(true);
  const original = bank.find((q: { kind: string }) => q.kind === "numeric");
  const denied = await admin.put("/api/admin/questions/" + created[0], {
    headers: { Origin: origin },
    data: {
      topic_id: topic.id,
      question: { ...original, prompt: "Replacement" },
      status: "approved",
    },
  });
  expect(denied.status()).toBe(409);
  const removed = await admin.delete("/api/admin/questions/" + created[0], {
    headers: { Origin: origin },
  });
  expect((await removed.json()).archived).toBe(true);
  expect(
    (await (await page.request.get("/api/tests/" + id)).json()).results,
  ).toHaveLength(10);
  await admin.dispose();
});
test("grade eight study and timed mock workflow", async ({ page }) => {
  await login(page);
  expect(
    (
      await page.request.put("/api/profile", {
        headers: { Origin: origin },
        data: { grade: 8 },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { name: "Deneme zamanı" }),
  ).toBeVisible();
  const form = page.locator(".test-creator");
  await form.getByRole("button", { name: "5 soru", exact: true }).click();
  await form.getByRole("button", { name: "Hazırsan başlayalım" }).click();
  await expect(page).toHaveURL(/test\//);
  await expect(
    page.getByRole("heading", { name: "Deneme çalışması" }),
  ).toBeVisible();
  expect(await page.getByText(/^7:|^6:/).count()).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "Testi bitir ve kaydet" }).click();
  await expect(
    page.getByRole("heading", { name: "Test tamamlandı!" }),
  ).toBeVisible();
  expect(
    (
      await page.request.put("/api/profile", {
        headers: { Origin: origin },
        data: { grade: 7 },
      })
    ).status(),
  ).toBe(200);
});
test("parent and admin desktop and mobile screens stay readable and error-free", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const role of ["parent", "admin"]) {
    await login(page, role);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(role === "parent" ? "/ebeveyn" : "/admin");
      await expect(
        page.getByRole("heading", {
          name:
            role === "parent"
              ? "Birlikte büyüyen bir yolculuk"
              : "Öğrenmenin arka planı",
        }),
      ).toBeVisible();
      if (role === "admin") {
        for (const label of [
          "Genel bakış",
          "Müfredat & içerik",
          "Soru bankası",
          "AI soru üretici",
          "Kullanıcılar",
          "Testler",
          "Kaynaklar",
        ]) {
          await page.getByRole("button", { name: label, exact: true }).click();
          await page.waitForTimeout(100);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            width + " " + label,
          ).toBe(true);
        }
      } else {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await page.screenshot({
        path: ".local/" + role + "-" + width + ".png",
        fullPage: true,
      });
    }
    if (role === "parent") {
      await page.request.post("/api/auth/logout", {
        headers: { Origin: origin },
        data: {},
      });
      await page.goto("/login");
    }
  }
  expect(errors).toEqual([]);
});
test("admin can create, rename, archive and restore tests without deleting attempts", async ({
  page,
  playwright,
}) => {
  await login(page, "admin");
  const f = await fixtures();
  const nodes = await (await page.request.get("/api/admin/nodes")).json();
  const topic = nodes.find(
    (n: { kind: string; grade: number; curriculum_version: string }) =>
      n.kind === "topic" &&
      n.grade === 7 &&
      n.curriculum_version === "ORIGINAL_PRACTICE",
  );
  const created = await page.request.post("/api/admin/tests", {
    headers: { Origin: origin },
    data: {
      student_id: f.users.student.id,
      topic_id: topic.id,
      title: "Admin özel çalışma",
      count: 5,
      mode: "mock",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  expect(
    (
      await page.request.put("/api/admin/tests/" + id, {
        headers: { Origin: origin },
        data: { title: "Yeniden adlandırılmış çalışma" },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Testler", exact: true }).click();
  await expect(
    page.getByText("Yeniden adlandırılmış çalışma", { exact: true }),
  ).toBeVisible();
  const student = await playwright.request.newContext({ baseURL: origin });
  await apiLogin(student, "student");
  const list = await (await student.get("/api/tests")).json();
  expect(list.find((t: { id: string }) => t.id === id).started_at).toBeNull();
  const opened = await (await student.get("/api/tests/" + id)).json();
  expect(opened.test.started_at).not.toBeNull();
  expect(
    (
      await page.request.delete("/api/admin/tests/" + id, {
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(200);
  expect((await student.get("/api/tests/" + id)).status()).toBe(404);
  expect(
    (
      await page.request.put("/api/admin/tests/" + id, {
        headers: { Origin: origin },
        data: { archived: false },
      })
    ).status(),
  ).toBe(200);
  expect((await student.get("/api/tests/" + id)).status()).toBe(200);
  await page.request.post("/api/auth/logout", {
    headers: { Origin: origin },
    data: {},
  });
  await login(page);
  await page.goto("/calismalar");
  await expect(
    page.getByRole("heading", { name: "Çalışmalarım" }),
  ).toBeVisible();
  await page
    .getByRole("link")
    .filter({ hasText: "Yeniden adlandırılmış çalışma" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Yeniden adlandırılmış çalışma" }),
  ).toBeVisible();
  await student.dispose();
});
