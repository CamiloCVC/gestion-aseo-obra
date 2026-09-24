import { supabase } from "./supabase-client.js";
import { getProfile, landingPageFor } from "./auth.js";
import { loginSchema, firstErrorMessage } from "./validation.js";

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

async function redirectIfLoggedIn() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const profile = await getProfile(session.user.id);
  if (!profile || !profile.activo) {
    await supabase.auth.signOut();
    return;
  }
  window.location.href = landingPageFor(profile.role);
}

redirectIfLoggedIn();

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  const result = loginSchema.safeParse({
    email: document.getElementById("email").value,
    password: document.getElementById("password").value,
  });
  if (!result.success) {
    loginError.textContent = firstErrorMessage(result);
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword(result.data);
  if (error) {
    loginError.textContent = "Credenciales inválidas.";
    return;
  }

  const profile = await getProfile(data.user.id);
  if (!profile || !profile.activo) {
    await supabase.auth.signOut();
    loginError.textContent = "Tu cuenta está desactivada. Contacta a un administrador.";
    return;
  }

  window.location.href = landingPageFor(profile.role);
});
