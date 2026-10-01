export type MascotState =
  | "idle"
  | "welcome"
  | "thinking"
  | "point"
  | "help"
  | "correct"
  | "encourage"
  | "celebrate"
  | "achievement"
  | "study"
  | "aiTeacher";
export const mascotAssets: Record<MascotState, string> = {
  idle: "idle",
  welcome: "wave",
  thinking: "thinking",
  point: "point",
  help: "help",
  correct: "celebrate",
  encourage: "help",
  celebrate: "celebrate",
  achievement: "celebrate",
  study: "study",
  aiTeacher: "ai",
};
export const mascotSrc = (state: MascotState) =>
  "/mascot/nehir-" + mascotAssets[state] + ".webp";
