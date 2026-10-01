import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AcademyApp } from "@/components/AcademyApp";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ page?: string[] }>;
}) {
  const segments = (await params).page ?? [];
  const user = await currentUser();
  const key = segments[0] ?? "";
  if (!user && !["login", "reset"].includes(key)) redirect("/login");
  if (user && key === "login")
    redirect(
      user.role === "ADMIN"
        ? "/admin"
        : user.role === "PARENT"
          ? "/ebeveyn"
          : "/",
    );
  if (user) {
    if (key === "admin" && user.role !== "ADMIN") redirect("/");
    if (key === "ebeveyn" && user.role !== "PARENT") redirect("/");
    if (
      !["login", "reset", "admin", "ebeveyn"].includes(key) &&
      user.role !== "STUDENT"
    )
      redirect(user.role === "ADMIN" ? "/admin" : "/ebeveyn");
  }
  return (
    <AcademyApp
      user={user}
      segments={segments}
      aiReady={Boolean(process.env.AI_API_KEY)}
    />
  );
}
