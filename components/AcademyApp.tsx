"use client";
import { useEffect, useState, useCallback } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Home,
  BookOpen,
  Sparkles,
  RefreshCw,
  ChartNoAxesCombined,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LogOut,
  Search,
  ArrowRight,
  Shield,
  Users,
  X,
  PanelBottomClose,
  Menu,
} from "lucide-react";
import type { User, Node } from "@/types/domain";
import { api } from "@/lib/client";
import { MascotProvider, useMascot } from "./mascot/MascotProvider";
import { MascotGuide } from "./mascot/MascotGuide";
import {
  DashboardPage,
  StudiesPage,
  LessonsPage,
  TopicPage,
  TestPage,
  WrongsPage,
  AchievementPage,
  PlanPage,
  TasksPage,
} from "./StudentPages";
import { TeacherPage } from "./TeacherPage";
import { AdminPage, ParentPage } from "./AdminPages";
import { useAction, ActionStatus, Empty } from "./ui";
const studentNav = [
  { path: "/", label: "Ana sayfa", icon: Home },
  { path: "/dersler", label: "Derslerim", icon: BookOpen },
  { path: "/plan", label: "Çalışma planım", icon: CalendarDays },
  { path: "/calismalar", label: "Çalışmalarım", icon: ClipboardList },
  { path: "/ogretmen", label: "AI öğretmen", icon: Sparkles },
  { path: "/yanlislarim", label: "Tekrar fırsatlarım", icon: RefreshCw },
  { path: "/basarim", label: "Başarım", icon: ChartNoAxesCombined },
  { path: "/odevler", label: "Ödevlerim", icon: ClipboardList },
  { path: "/sinavlar", label: "Sınav takvimim", icon: GraduationCap },
];
function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        n<span>✦</span>
      </span>
      <span>
        Nehir<span>Akademi</span>
      </span>
    </span>
  );
}
export function AcademyApp({
  user,
  segments,
  aiReady,
}: {
  user: User | null;
  segments: string[];
  aiReady: boolean;
}) {
  if (!user || ["login", "reset"].includes(segments[0]))
    return <AuthPage reset={segments[0] === "reset"} />;
  return (
    <MascotProvider>
      <Shell user={user} segments={segments} aiReady={aiReady} />
    </MascotProvider>
  );
}
function Shell({
  user,
  segments,
  aiReady,
}: {
  user: User;
  segments: string[];
  aiReady: boolean;
}) {
  const router = useRouter();
  const key = segments[0] ?? "";
  const path = "/" + segments.join("/");
  const mascot = useMascot();
  const action = useAction();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [onboard, setOnboard] = useState<number | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  useDialogFocus(searchOpen, closeSearch);
  useDialogFocus(onboard !== null);
  const roleNav =
    user.role === "STUDENT"
      ? studentNav
      : user.role === "ADMIN"
        ? [{ path: "/admin", label: "Sistem yönetimi", icon: Shield }]
        : [{ path: "/ebeveyn", label: "Öğrenme raporu", icon: Users }];
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    if (user.role !== "STUDENT") return;
    void api<{ preferences: { onboarded?: boolean } }>("profile")
      .then((p) => {
        if (!p.preferences.onboarded) setOnboard(0);
      })
      .catch(() => {});
  }, [user.id, user.role]);
  useEffect(() => {
    if (searchOpen)
      void api<Node[]>("curriculum?grade=" + user.grade)
        .then(setNodes)
        .catch(() => {});
  }, [searchOpen, user.grade]);
  async function finishOnboarding() {
    await api("profile", "PUT", { preferences: { onboarded: true } });
    setOnboard(null);
  }
  let content: React.ReactNode;
  switch (key) {
    case "":
      content = <DashboardPage key={user.grade} user={user} />;
      break;
    case "dersler":
      content = (
        <LessonsPage
          key={user.grade + ":" + segments[1]}
          user={user}
          id={segments[1]}
        />
      );
      break;
    case "konu":
      content = segments[1] ? (
        <TopicPage key={segments[1]} id={segments[1]} />
      ) : (
        <Empty title="Konu seç">
          <Link href="/dersler">Derslere git</Link>
        </Empty>
      );
      break;
    case "test":
      content = segments[1] ? (
        <TestPage key={segments[1]} id={segments[1]} />
      ) : (
        <Empty title="Test seç">
          <Link href="/dersler">Derslere git</Link>
        </Empty>
      );
      break;
    case "calismalar":
      content = <StudiesPage />;
      break;
    case "plan":
      content = <PlanPage user={user} />;
      break;
    case "ogretmen":
      content = <TeacherPage aiReady={aiReady} />;
      break;
    case "yanlislarim":
      content = <WrongsPage />;
      break;
    case "basarim":
      content = <AchievementPage />;
      break;
    case "odevler":
      content = <TasksPage kind="homeworks" user={user} />;
      break;
    case "sinavlar":
      content = <TasksPage kind="exams" user={user} />;
      break;
    case "ebeveyn":
      content = <ParentPage />;
      break;
    case "admin":
      content = <AdminPage />;
      break;
    default:
      content = (
        <Empty title="Bu sayfa bulunamadı">
          <Link href="/">Ana sayfaya dön</Link>
        </Empty>
      );
  }
  const active = (p: string) => (p === "/" ? path === "/" : path.startsWith(p));
  return (
    <div className="academy-shell">
      <a className="skip-link" href="#main">
        İçeriğe geç
      </a>
      <aside className={"sidebar " + (mobileMenu ? "mobile-open" : "")}>
        <Link href={roleNav[0].path} className="brand-link">
          <Brand />
        </Link>
        <div className="sidebar-profile">
          <Image
            src="/mascot/nehir-idle.webp"
            width={42}
            height={48}
            alt="Nehir Akademi"
          />
          <div>
            <strong>{user.name}</strong>
            <small>
              {user.role === "STUDENT"
                ? user.grade + ". sınıf öğrencisi"
                : user.role === "PARENT"
                  ? "Ebeveyn hesabı"
                  : "Yönetici hesabı"}
            </small>
          </div>
          <span className="profile-status" />
        </div>
        <div className="nav-caption">
          {user.role === "STUDENT" ? "ÖĞRENME YOLCULUĞUN" : "ÇALIŞMA ALANIN"}
        </div>
        <nav aria-label="Ana gezinme">
          {roleNav.map((n) => (
            <Link
              aria-current={active(n.path) ? "page" : undefined}
              className={"nav-link " + (active(n.path) ? "active" : "")}
              key={n.path}
              href={n.path}
              onClick={() => setMobileMenu(false)}
            >
              <n.icon size={20} />
              {n.label}
              {n.path === "/ogretmen" && <span className="ai-tag">AI</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>✦</span>
            <p>
              Her gün yeni bir şey öğren.
              <br />
              <strong>Kendi hızında, kendi yolunda.</strong>
            </p>
          </div>
          <button
            className="nav-link logout"
            disabled={action.busy}
            onClick={() =>
              action.run(async () => {
                await api("auth/logout", "POST", {});
                router.push("/login");
                router.refresh();
              })
            }
          >
            <LogOut size={18} /> Çıkış yap
          </button>
          <span className="sidebar-footnote">
            NEHİR AKADEMİ · ÖĞRENME ALANIN
          </span>
        </div>
      </aside>
      <div className="main-wrapper">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu-toggle"
              aria-label="Menüyü aç"
              onClick={() => setMobileMenu((v) => !v)}
            >
              <Menu size={22} />
            </button>
            <span className="topbar-greeting">
              Öğrenmek için güzel bir gün <span>✦</span>
            </span>
          </div>
          <div className="topbar-right">
            <span className="topbar-date">
              <CalendarDays size={16} />
              {new Date().toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                timeZone: "Europe/Istanbul",
              })}
            </span>
            {user.role === "STUDENT" && (
              <button
                className="search-button"
                onClick={() => setSearchOpen(true)}
              >
                <Search size={18} />
                <span>Konu ara</span>
              </button>
            )}
            <div className="topbar-user">
              <Image
                src="/mascot/nehir-wave.webp"
                width={30}
                height={38}
                alt=""
              />
              <span>{user.name.split(" ")[0]}</span>
            </div>
          </div>
        </header>
        <main
          id="main"
          className={"main-content " + (key === "test" ? "focus-mode" : "")}
        >
          <ActionStatus {...action} />
          {content}
          {mascot.notice && !mascot.minimized && (
            <div className="context-guide">
              <MascotGuide
                state={mascot.notice.state}
                message={mascot.notice.message}
                size={100}
                onClose={mascot.reset}
              />
              <button
                className="icon-button"
                aria-label="Maskotu küçült"
                onClick={mascot.toggle}
              >
                <PanelBottomClose size={18} />
              </button>
            </div>
          )}
          {mascot.minimized && (
            <button className="mascot-reopen" onClick={mascot.toggle}>
              <Image
                src="/mascot/nehir-idle.webp"
                width={35}
                height={45}
                alt=""
              />{" "}
              Rehberi aç
            </button>
          )}
          <footer className="page-footer">
            <Brand />
            <span>Öğrenmek bir yolculuk. Her adımın değerli.</span>
          </footer>
        </main>
      </div>
      {user.role === "STUDENT" && (
        <nav className="bottom-nav" aria-label="Mobil gezinme">
          {[
            { path: "/", label: "Ana sayfa", icon: Home },
            { path: "/dersler", label: "Dersler", icon: BookOpen },
            { path: "/plan", label: "Çalış", icon: Sparkles },
            { path: "/yanlislarim", label: "Tekrarlar", icon: RefreshCw },
            { path: "/basarim", label: "Başarım", icon: ChartNoAxesCombined },
          ].map((n) => (
            <Link
              href={n.path}
              className={active(n.path) ? "active" : ""}
              aria-current={active(n.path) ? "page" : undefined}
              key={n.path}
            >
              <n.icon size={20} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
      )}
      {searchOpen && (
        <div className="modal-overlay" onClick={() => setSearchOpen(false)}>
          <section
            className="modal search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Konu ara"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <h2>Konu ara</h2>
              <button
                className="icon-button"
                aria-label="Aramayı kapat"
                onClick={() => setSearchOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <input
              autoFocus
              aria-label="Arama metni"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ders veya konu adı…"
            />
            {nodes
              .filter(
                (n) =>
                  ["subject", "topic"].includes(n.kind) &&
                  search.length > 0 &&
                  n.title
                    .toLocaleLowerCase("tr-TR")
                    .includes(search.toLocaleLowerCase("tr-TR")),
              )
              .slice(0, 10)
              .map((n) => (
                <Link
                  className="list-link"
                  key={n.id}
                  onClick={() => setSearchOpen(false)}
                  href={(n.kind === "topic" ? "/konu/" : "/dersler/") + n.id}
                >
                  {n.title}
                  <ArrowRight size={15} />
                </Link>
              ))}
          </section>
        </div>
      )}
      {onboard !== null && (
        <div className="modal-overlay">
          <section
            className="modal onboarding"
            role="dialog"
            aria-modal="true"
            aria-label="Nehir Akademi’ye hoş geldin"
          >
            <MascotGuide
              state={
                onboard === 0
                  ? "welcome"
                  : onboard === 1
                    ? "point"
                    : "celebrate"
              }
              size={170}
              showBubble={false}
            />
            <span className="page-eyebrow">{onboard + 1} / 3</span>
            <h2>
              {
                [
                  "Merhaba " + user.name.split(" ")[0] + "!",
                  "Kendi yolunu seç.",
                  "Bir küçük adımla başlayalım.",
                ][onboard]
              }
            </h2>
            <p>
              {
                [
                  "Derslerinde sana eşlik edeceğim. Burada kendi hızında öğrenebilirsin.",
                  "Konuları çalışabilir, test çözebilir veya anlamadığın yerde AI öğretmenine sorabilirsin.",
                  "Çalışmaların kaydedilir. Tekrarların ve planın, öğrendiklerine göre şekillenir.",
                ][onboard]
              }
            </p>
            <ActionStatus {...action} />
            <button
              className="button primary"
              disabled={action.busy}
              onClick={() => {
                if (onboard < 2) setOnboard(onboard + 1);
                else void action.run(finishOnboarding);
              }}
            >
              {onboard < 2 ? "Devam edelim" : "Haydi başlayalım"}{" "}
              <ArrowRight size={16} />
            </button>
            <button
              className="button text"
              disabled={action.busy}
              onClick={() => action.run(finishOnboarding)}
            >
              Bir daha gösterme
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function AuthPage({ reset }: { reset: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [requestReset, setRequestReset] = useState(false);
  const [token, setToken] = useState("");
  const action = useAction();
  const router = useRouter();
  useEffect(() => {
    if (reset)
      setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, [reset]);
  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <Link href="/login" className="brand-link">
          <Brand />
        </Link>
        <div>
          <div className="pill">Sana özel bir öğrenme yolculuğu</div>
          <h1>
            Küçük adımlar.
            <br />
            Büyük keşifler.
          </h1>
          <p>
            Konuları öğren, merak ettiklerini sor.
            <br />
            Her gün biraz daha ileriye.
          </p>
          <MascotGuide state="welcome" size={280} showBubble={false} priority />
        </div>
        <span>NEHİR AKADEMİ · KENDİ HIZINDA ÖĞREN</span>
      </div>
      <main className="auth-form-panel">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form-card">
          <span className="page-eyebrow">ÖĞRENME ALANINA HOŞ GELDİN</span>
          <h2>
            {reset
              ? "Yeni bir başlangıç"
              : requestReset
                ? "Parolanı yenileyelim"
                : "Yeniden merhaba!"}
          </h2>
          <p>
            {reset
              ? "En az 12 karakterli yeni bir parola belirle."
              : requestReset
                ? "Hesabının e-posta adresini yaz."
                : "Kaldığın yerden devam etmek için giriş yap."}
          </p>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(
                async () => {
                  if (reset) {
                    await api("auth/reset", "POST", { token, password });
                    router.push("/login");
                  } else if (requestReset) {
                    await api("auth/reset-request", "POST", { email });
                  } else {
                    await api("auth/login", "POST", { email, password });
                    const result = await api<{ user: User }>("auth/me");
                    router.push(
                      result.user.role === "ADMIN"
                        ? "/admin"
                        : result.user.role === "PARENT"
                          ? "/ebeveyn"
                          : "/",
                    );
                    router.refresh();
                  }
                },
                requestReset
                  ? "Hesap varsa yenileme bağlantısı gönderilir."
                  : "",
              );
            }}
          >
            {!reset && (
              <label>
                E-posta adresin
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  maxLength={254}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-posta adresin"
                />
              </label>
            )}
            {(!requestReset || reset) && (
              <label>
                Parolan
                <input
                  type="password"
                  autoComplete={reset ? "new-password" : "current-password"}
                  minLength={reset ? 12 : 1}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={reset ? "En az 12 karakter" : "Parolan"}
                />
              </label>
            )}
            <ActionStatus {...action} />
            <button className="button primary full" disabled={action.busy}>
              {action.busy
                ? "Bir saniye…"
                : reset
                  ? "Parolayı kaydet"
                  : requestReset
                    ? "Yenileme bağlantısı gönder"
                    : "Öğrenmeye devam et"}
              <ArrowRight size={17} />
            </button>
          </form>
          {!reset && (
            <button
              className="button text full"
              onClick={() => {
                setRequestReset((v) => !v);
                setPassword("");
              }}
            >
              {requestReset ? "Giriş ekranına dön" : "Parolamı unuttum"}
            </button>
          )}
          <div className="login-note">
            <Shield size={17} />
            <span>
              Öğrenci, ebeveyn ve yönetici hesapları kendi alanlarına
              yönlendirilir.
            </span>
          </div>
        </div>
        <div className="auth-footnote">
          Her öğrenme yolculuğu bir merakla başlar.
        </div>
      </main>
    </div>
  );
}
