"use client";
import { useState, type ReactNode } from "react";
import { LoaderCircle, AlertCircle, Check } from "lucide-react";
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={24} />
      <span>Çalışma alanın hazırlanıyor…</span>
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      {message}
    </div>
  ) : null;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">✦</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="progress-wrap">
      {label && (
        <div className="progress-label">
          <span>{label}</span>
          <strong>%{Math.round(value)}</strong>
        </div>
      )}
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label ?? "İlerleme"}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: Math.max(0, Math.min(100, value)) + "%" }} />
      </div>
    </div>
  );
}
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function run(fn: () => Promise<void>, message = "") {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      if (message) setSuccess(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, success, run };
}
export function ActionStatus({
  error,
  success,
}: {
  error: string;
  success?: string;
}) {
  return (
    <>
      <ErrorBox message={error} />
      {success && (
        <div className="success-box" role="status">
          <Check size={16} />
          {success}
        </div>
      )}
    </>
  );
}
export function dateLabel(date: string) {
  return new Date(date.slice(0, 10) + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
  });
}
export function percent(correct: number, total: number) {
  return total ? Math.round((correct / total) * 100) : 0;
}
