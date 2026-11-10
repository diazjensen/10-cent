import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function AccountHome() {
  await requireUser("/account");
  redirect("/account/shortlist");
}
