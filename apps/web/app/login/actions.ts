"use server";

import { redirect } from "next/navigation";
import { checkCredentials, createSessionCookie } from "@/lib/auth";

export async function loginAction(_prevState: string | null, formData: FormData): Promise<string | null> {
  const user = String(formData.get("user") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!checkCredentials(user, password)) {
    return "Usuário ou senha inválidos.";
  }

  await createSessionCookie(user);
  redirect("/");
}
