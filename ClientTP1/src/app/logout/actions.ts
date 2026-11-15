"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function deconnecter() {
  // On supprime simplement le jeton JWT stocké dans les cookies
  (await

    cookies()).delete("jwt"); 
  redirect("/");
}