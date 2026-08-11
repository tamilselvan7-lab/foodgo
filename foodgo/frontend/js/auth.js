let mode = "signin"; // or "signup"

function setMode(next) {
  mode = next;
  document.getElementById("formTitle").textContent = mode === "signin" ? "Sign in" : "Create your account";
  document.getElementById("submitBtn").textContent = mode === "signin" ? "Sign in" : "Sign up";
  document.getElementById("toggleText").textContent = mode === "signin" ? "Don't have an account?" : "Already have an account?";
  document.getElementById("toggleLink").textContent = mode === "signin" ? "Sign up" : "Sign in";
  document.querySelector(".field:has(#nameField)").style.display = mode === "signup" ? "block" : "none";
}

function showAuthError(msg) {
  const el = document.getElementById("authError");
  el.textContent = msg;
  el.style.display = "block";
}

async function handleSubmit() {
  const email = document.getElementById("emailField").value.trim();
  const password = document.getElementById("passwordField").value;
  const fullName = document.getElementById("nameField").value.trim();
  document.getElementById("authError").style.display = "none";

  if (!email || !password) return showAuthError("Please enter your email and password.");

  try {
    if (mode === "signin") {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
    }
    const next = new URLSearchParams(location.search).get("next") || "index.html";
    location.href = next;
  } catch (err) {
    showAuthError(err.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  setMode("signin");
  document.getElementById("submitBtn").addEventListener("click", handleSubmit);
  document.getElementById("toggleLink").addEventListener("click", (e) => {
    e.preventDefault();
    setMode(mode === "signin" ? "signup" : "signin");
  });
});
