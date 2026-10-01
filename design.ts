export const subjectTokens: Record<
  string,
  { color: string; background: string; symbol: string }
> = {
  Matematik: { color: "#7651c9", background: "#eee7fb", symbol: "∑" },
  Türkçe: { color: "#c25377", background: "#fce7ee", symbol: "Aa" },
  "Fen Bilimleri": { color: "#26896e", background: "#e1f3e9", symbol: "⚗" },
  "Sosyal Bilgiler": { color: "#bf742c", background: "#fff0db", symbol: "◎" },
  İngilizce: { color: "#3982bc", background: "#e4f0fd", symbol: "En" },
  "Din Kültürü ve Ahlak Bilgisi": {
    color: "#338f98",
    background: "#e2f4f3",
    symbol: "◇",
  },
  "T.C. İnkılap Tarihi ve Atatürkçülük": {
    color: "#ab4a51",
    background: "#f8e5e7",
    symbol: "★",
  },
};
export const tokenFor = (subject: string) =>
  subjectTokens[subject] ?? subjectTokens.Matematik;
