"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { MascotState } from "@/config/mascot";
import { api } from "@/lib/client";
type Notice = { state: MascotState; message: string; priority: number };
type Context = {
  notice: Notice | null;
  minimized: boolean;
  toggle: () => void;
  reset: () => void;
  say: (
    message: string,
    state?: MascotState,
    priority?: "low" | "normal" | "high",
  ) => void;
  think: () => void;
  help: () => void;
  encourage: () => void;
  celebrate: () => void;
  point: () => void;
};
const MascotContext = createContext<Context | null>(null);
export function MascotProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Notice[]>([]);
  const [minimized, setMinimized] = useState(false);
  const recent = useRef(new Map<string, number>());
  useEffect(() => {
    void api<{ preferences: { mascotMinimized?: boolean } }>("profile")
      .then((r) => setMinimized(Boolean(r.preferences.mascotMinimized)))
      .catch(() => {});
  }, []);
  const say = useCallback(
    (
      message: string,
      state: MascotState = "idle",
      priority: "low" | "normal" | "high" = "normal",
    ) => {
      const now = Date.now();
      if (now - (recent.current.get(message) ?? 0) < 60000) return;
      recent.current.set(message, now);
      const n = {
        state,
        message,
        priority: { low: 0, normal: 1, high: 2 }[priority],
      };
      setQueue((q) =>
        [...q, n].sort((a, b) => b.priority - a.priority).slice(0, 6),
      );
    },
    [],
  );
  useEffect(() => {
    if (!queue.length) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), 7000);
    return () => clearTimeout(timer);
  }, [queue]);
  const point = useCallback(
    () => say("Bugün hangi dersten başlayalım?", "point"),
    [say],
  );
  const toggle = () =>
    setMinimized((v) => {
      void api("profile", "PUT", {
        preferences: { mascotMinimized: !v },
      }).catch(() => {});
      return !v;
    });
  return (
    <MascotContext.Provider
      value={{
        notice: queue[0] ?? null,
        minimized,
        toggle,
        reset: () => setQueue([]),
        say,
        think: () => say("Soruda bizden ne istendiğine bakalım.", "thinking"),
        help: () => say("Önce bildiklerimizi birlikte sıralayalım.", "help"),
        encourage: () =>
          say(
            "Bir daha bakalım. Küçük bir ayrıntı olabilir.",
            "encourage",
            "high",
          ),
        celebrate: () =>
          say(
            "Test tamamlandı! Bir sonraki adımı birlikte seçebiliriz.",
            "celebrate",
            "high",
          ),
        point,
      }}
    >
      {children}
    </MascotContext.Provider>
  );
}
export function useMascot() {
  const value = useContext(MascotContext);
  if (!value) throw new Error("MascotProvider missing");
  return value;
}
