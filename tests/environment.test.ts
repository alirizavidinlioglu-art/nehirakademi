import { afterEach, describe, expect, it, vi } from "vitest";
import { appOrigin } from "../lib/environment";

afterEach(() => vi.unstubAllEnvs());
describe("production origins", () => {
  it("normalizes an explicit production URL for password reset links", () => {
    vi.stubEnv("APP_URL", "https://academy.example.test/");
    vi.stubEnv("VERCEL", "1");
    expect(appOrigin("http://internal:3000/api/auth/reset-request")).toBe(
      "https://academy.example.test",
    );
  });
  it("uses the current Vercel deployment when APP_URL is absent", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_URL", "academy-preview.vercel.app");
    expect(appOrigin()).toBe("https://academy-preview.vercel.app");
  });
  it("rejects an insecure production URL and credentials in a URL", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("APP_URL", "http://academy.example.test");
    expect(() => appOrigin()).toThrow("HTTPS");
    vi.stubEnv("APP_URL", "https://user:password@academy.example.test");
    expect(() => appOrigin()).toThrow("HTTPS");
  });
  it("fails without external PostgreSQL on Vercel instead of writing a local database", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "");
    const { database } = await import("../lib/db");
    await expect(database()).rejects.toThrow("DATABASE_URL gerekli");
    await expect(database()).rejects.toThrow("DATABASE_URL gerekli");
  });
});
