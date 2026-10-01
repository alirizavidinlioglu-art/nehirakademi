import katex from "katex";
export function MathText({ text }: { text: string }) {
  const pieces = text.split(/(\$[^$]+\$)/g);
  return (
    <>
      {pieces.map((piece, i) =>
        piece.startsWith("$") && piece.endsWith("$") ? (
          <span
            key={i}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(piece.slice(1, -1), {
                throwOnError: false,
                trust: false,
                strict: "warn",
              }),
            }}
          />
        ) : (
          <span key={i}>{piece}</span>
        ),
      )}
    </>
  );
}
