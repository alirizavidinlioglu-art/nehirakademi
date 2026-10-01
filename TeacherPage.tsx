"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Camera, Sparkles, X, ImagePlus } from "lucide-react";
import { api } from "@/lib/client";
import { MascotGuide } from "./mascot/MascotGuide";
import { useMascot } from "./mascot/MascotProvider";
import { MathText } from "./MathText";
import { useAction, ActionStatus } from "./ui";
type Message = { role: "user" | "assistant"; content: string; level?: number };
export function TeacherPage({
  topicId,
  testId,
  questionId,
  compact = false,
  initialMessage,
  aiReady = true,
}: {
  topicId?: string;
  testId?: string;
  questionId?: string;
  compact?: boolean;
  initialMessage?: string;
  aiReady?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState(initialMessage ?? "");
  const [conversation, setConversation] = useState<string>();
  const [image, setImage] = useState<string>();
  const [fileName, setFileName] = useState("");
  const action = useAction();
  const mascot = useMascot();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [messages]);
  async function send(message = text) {
    if (!message.trim() || action.busy) return;
    await action.run(async () => {
      const result = await api<{
        message: string;
        conversation_id: string;
        level: number;
      }>("teacher", "POST", {
        message,
        conversation_id: conversation,
        topic_id: topicId,
        test_id: testId,
        question_id: questionId,
        image,
      });
      setMessages((m) => [
        ...m,
        { role: "user", content: message },
        { role: "assistant", content: result.message, level: result.level },
      ]);
      setConversation(result.conversation_id);
      setText("");
      setImage(undefined);
      setFileName("");
      mascot.say("Adım adım ilerleyelim.", "aiTeacher");
    });
  }
  async function attach(file?: File) {
    if (!file) return;
    if (
      file.size > 2 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      await action.run(async () => {
        throw new Error("En fazla 2 MB PNG, JPEG veya WebP fotoğraf seç.");
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setFileName(file.name);
      if (!text)
        setText(
          "Bu soruyu beraber çözelim. Önce ne istendiğini anlamama yardım et.",
        );
    };
    reader.readAsDataURL(file);
  }
  return (
    <section className={"teacher-workspace " + (compact ? "compact" : "")}>
      {!compact && (
        <>
          <div className="page-eyebrow">KENDİ HIZINDA ÖĞREN</div>
          <h1>Beraber çözelim.</h1>
          <p className="page-description">
            Cevabı ezberlemek yerine nasıl bulacağını keşfet.
          </p>
        </>
      )}
      <div className="teacher-topline">
        <span className="teacher-presence">
          <span /> Nehir Akademi · AI öğretmen
        </span>
        <span className="pill">
          <Sparkles size={14} /> Adım adım destek
        </span>
      </div>
      {!aiReady && (
        <div className="source-notice">
          <Sparkles size={20} />
          <p>
            AI öğretmen bağlantısı henüz yapılandırılmadı. Gerçek yanıtlar için
            ortam ayarlarında AI_API_KEY tanımlanmalı.
          </p>
        </div>
      )}
      <div className="teacher-conversation" aria-live="polite">
        {!messages.length && (
          <div className="teacher-intro">
            <MascotGuide
              state="aiTeacher"
              size={compact ? 100 : 170}
              showBubble={false}
            />
            <h2>Birlikte düşünmeye hazır mısın?</h2>
            <p>
              Anlamadığın bir konuyu yaz veya sorunun fotoğrafını yükle.
              <br />
              Önce küçük bir ipucuyla başlayalım.
            </p>
            <div className="quick-actions">
              {[
                "İpucu ver",
                "Daha basit anlat",
                "Örnek göster",
                "Birlikte çözelim",
              ].map((s) => (
                <button
                  key={s}
                  className="button subtle"
                  disabled={action.busy}
                  onClick={() =>
                    setText(initialMessage ? initialMessage + "\n" + s : s)
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={"chat-message " + m.role}>
            {m.role === "assistant" && (
              <MascotGuide state="aiTeacher" size={38} showBubble={false} />
            )}
            <div className="message-body">
              {m.level && <small>Destek seviyesi {m.level} / 5</small>}
              <div className="message-text">
                <MathText text={m.content} />
              </div>
            </div>
          </div>
        ))}
        {action.busy && (
          <div className="thinking-indicator">
            <span />
            <span />
            <span /> Birlikte düşünüyoruz…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <ActionStatus {...action} />
      {image && (
        <div className="photo-attachment">
          <ImagePlus size={18} />
          <span>
            {fileName} · Fotoğraf yalnızca bu AI isteğinde kullanılır.
          </span>
          <button
            className="icon-button"
            aria-label="Fotoğrafı kaldır"
            onClick={() => {
              setImage(undefined);
              setFileName("");
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <form
        className="teacher-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <button
          type="button"
          className="icon-button"
          aria-label="Galeriden soru fotoğrafı yükle"
          disabled={action.busy}
          onClick={() => fileRef.current?.click()}
        >
          <Camera size={22} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            void attach(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            void attach(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="icon-button"
          aria-label="Kamerayla soru fotoğrafı çek"
          disabled={action.busy}
          onClick={() => cameraRef.current?.click()}
        >
          <ImagePlus size={20} />
        </button>
        <textarea
          aria-label="AI öğretmene mesajın"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="Neyi birlikte öğrenelim?"
        />
        <button
          className="button primary"
          aria-label="Mesaj gönder"
          disabled={action.busy || !text.trim()}
        >
          <Send size={19} />
        </button>
      </form>
      <p className="teacher-footnote">
        AI yanılabilir. Verilen adımları kontrol et; kişisel bilgi paylaşma.
      </p>
    </section>
  );
}
