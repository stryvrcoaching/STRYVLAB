"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

function translateError(error: string): string {
  if (error.includes("Invalid login credentials"))
    return "Identifiants de connexion invalides.";
  if (error.includes("Email not confirmed"))
    return "Votre adresse e-mail n'a pas encore été confirmée. Veuillez vérifier votre boîte mail.";
  if (error.includes("User already registered"))
    return "Cet utilisateur est déjà inscrit.";
  if (error.includes("Rate limit exceeded"))
    return "Trop de tentatives. Veuillez patienter quelques minutes.";
  if (error.includes("Signup is disabled"))
    return "Les inscriptions sont désactivées pour le moment.";
  if (error.includes("Invalid format"))
    return "Format d'adresse e-mail invalide.";
  if (error.includes("Password should be at least 6 characters"))
    return "Le mot de passe doit contenir au moins 6 caractères.";
  if (error.includes("New password should be different from the old password"))
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  return "Une erreur est survenue lors de l'opération. Veuillez réessayer.";
}

function getExceptionMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function login(formData: FormData) {
  try {
    const supabase = createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      return { error: "Email et mot de passe requis" };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: translateError(error.message) };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("[auth/login] login failed:", getExceptionMessage(error));
    return {
      error:
        translateError(getExceptionMessage(error)) ||
        "Impossible de se connecter. Veuillez réessayer plus tard.",
    };
  }
}

export async function signup(formData: FormData) {
  try {
    const supabase = createClient();

    const email = formData.get("email") as string;
    const confirmEmail = formData.get("confirmEmail") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    // Nouveaux champs d'onboarding
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const coachName = formData.get("coachName") as string;
    const phone = formData.get("phone") as string;
    const discoverySource = formData.get("discoverySource") as string;
    const experienceLevel = formData.get("experienceLevel") as string;
    const activeClients = formData.get("activeClients") as string;
    const currentProcess = formData.get("currentProcess") as string;
    const currentTools = formData.get("currentTools") as string;

    console.log("--- SIGNUP ATTEMPT ---");
    console.log("Email:", email);
    console.log("First Name:", firstName);
    console.log("Last Name:", lastName);
    console.log("---------------------");

    if (
      !email ||
      !password ||
      !confirmPassword ||
      !firstName ||
      !lastName ||
      !phone
    ) {
      console.error("Missing required fields for signup");
      return {
        error:
          "Veuillez remplir au moins les champs obligatoires (Identité / Contact / Sécurité).",
      };
    }

    if (email.toLowerCase() !== confirmEmail.toLowerCase()) {
      return { error: "Les adresses e-mail ne correspondent pas." };
    }

    if (password !== confirmPassword) {
      return { error: "Les mots de passe ne correspondent pas" };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/confirm`,
        data: {
          first_name: firstName,
          last_name: lastName,
          coach_name: coachName,
          phone_number: phone,
          discovery_source: discoverySource,
          experience_level: experienceLevel,
          active_clients: activeClients,
          current_process: currentProcess,
          current_tools: currentTools,
          onboarding_completed: true,
        },
      },
    });

    if (error) {
      return { error: translateError(error.message) };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("[auth/login] signup failed:", getExceptionMessage(error));
    return {
      error:
        translateError(getExceptionMessage(error)) ||
        "Impossible de créer le compte. Veuillez réessayer plus tard.",
    };
  }
}

export async function resendEmail(email: string) {
  try {
    const supabase = createClient();

    if (!email) {
      return { error: "Email requis" };
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/confirm`,
      },
    });

    if (error) {
      return { error: translateError(error.message) };
    }

    return { success: true };
  } catch (error) {
    console.error(
      "[auth/login] resendEmail failed:",
      getExceptionMessage(error),
    );
    return {
      error:
        translateError(getExceptionMessage(error)) ||
        "Impossible de renvoyer l’email. Veuillez réessayer plus tard.",
    };
  }
}
