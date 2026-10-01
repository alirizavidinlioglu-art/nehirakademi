"use client";
import Image from "next/image";
import { coordinateScale } from "@/lib/graph";
import type { Question } from "@/types/domain";
import { MathText } from "@/components/MathText";
export function QuestionRenderer({
  question: q,
  value,
  onChange,
  disabled = false,
}: {
  question: Question;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const choices = q.kind === "true_false" ? ["Doğru", "Yanlış"] : q.options;
  const pairs = q.payload?.pairs ?? [];
  const selected = value ? value.split("|") : pairs.map(() => "");
  const points = q.payload?.points ?? [];
  const scale = coordinateScale(points);
  return (
    <div className="question-renderer">
      {q.passage && (
        <div className="reading-passage">
          <MathText text={q.passage} />
        </div>
      )}
      {q.kind === "image_question" &&
        q.payload.image?.startsWith("/question-images/") && (
          <Image
            src={q.payload.image}
            width={600}
            height={400}
            alt="Sorunun görseli"
            className="question-image"
          />
        )}
      {q.kind === "table_question" && q.payload.table && (
        <div className="table-scroll">
          <table>
            <tbody>
              {q.payload.table.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) =>
                    i === 0 ? <th key={j}>{cell}</th> : <td key={j}>{cell}</td>,
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {q.kind === "graph_question" && (
        <figure>
          <svg
            viewBox="0 0 400 240"
            role="img"
            aria-label={
              "Grafik noktaları: " +
              points.map((p) => p.x + "," + p.y).join("; ")
            }
          >
            <path
              d={`M${scale.x(0)} 10 V205 M35 ${scale.y(0)} H385`}
              fill="none"
              stroke="currentColor"
            />
            <polyline
              points={points
                .map((p) => `${scale.x(p.x)},${scale.y(p.y)}`)
                .join(" ")}
              stroke="#7651c9"
              fill="none"
              strokeWidth="3"
            />
            {points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={scale.x(p.x)}
                  cy={scale.y(p.y)}
                  r="4"
                  fill="#7651c9"
                />
                <text
                  x={scale.x(p.x)}
                  y={220}
                  textAnchor="middle"
                  fontSize="12"
                >
                  {p.x}
                </text>
                <text
                  x={scale.x(p.x)}
                  y={scale.y(p.y) - 10}
                  textAnchor="middle"
                  fontSize="12"
                >
                  {p.y}
                </text>
              </g>
            ))}
          </svg>
        </figure>
      )}
      <h2 className="question-prompt">
        <MathText text={q.prompt} />
      </h2>
      {q.kind === "matching" ? (
        <div className="matching-list">
          {pairs.map((pair, i) => (
            <label key={i}>
              {pair.left}
              <select
                disabled={disabled}
                aria-label={pair.left + " eşleşmesi"}
                value={selected[i] ?? ""}
                onChange={(e) => {
                  const next = pairs.map((_, j) => selected[j] ?? "");
                  next[i] = e.target.value;
                  onChange(next.join("|"));
                }}
              >
                <option value="">Eşleştir</option>
                {[...pairs]
                  .sort((a, b) => a.right.localeCompare(b.right))
                  .map((p) => (
                    <option key={p.right}>{p.right}</option>
                  ))}
              </select>
            </label>
          ))}
        </div>
      ) : choices?.length ? (
        <fieldset className="options" disabled={disabled}>
          <legend className="sr-only">Cevabını seç</legend>
          {choices.map((option, i) => (
            <label
              className={"option " + (value === option ? "selected" : "")}
              key={option}
            >
              <input
                type="radio"
                name={"answer-" + q.id}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
              />
              <span className="option-letter">
                {String.fromCharCode(65 + i)}
              </span>
              <MathText text={option} />
            </label>
          ))}
        </fieldset>
      ) : (
        <label className="answer-label">
          {q.kind === "numeric" ? "Sayısal cevabın" : "Cevabın"}
          <input
            disabled={disabled}
            autoComplete="off"
            inputMode={q.kind === "numeric" ? "decimal" : "text"}
            value={value}
            maxLength={3000}
            onChange={(e) => onChange(e.target.value)}
            placeholder={q.kind === "numeric" ? "Sonucu yaz…" : "Cevabını yaz…"}
          />
          {q.kind === "short_answer" && (
            <small>Bu soru, soru bankasındaki kısa yanıtla eşleştirilir.</small>
          )}
        </label>
      )}
    </div>
  );
}
