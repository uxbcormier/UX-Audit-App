"use server";

import { signIn } from "@/lib/auth";

export async function sendMagicLink(formData: FormData) {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.trim()) return;

  await signIn("resend", { email: email.trim(), redirectTo: "/" });
}
