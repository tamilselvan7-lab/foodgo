function renderHeader(containerId = "topbar") {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="topbar">
      <a href="index.html" class="logo">FoodGo</a>
      <div class="actions">
        <a href="index.html#search" class="icon-btn" title="Search">&#128269;</a>
        <a href="#" class="icon-btn" title="Location">&#128205;</a>
        <a href="checkout.html" class="icon-btn cart-badge" title="Cart">
          &#128722;
          <span class="count" data-cart-count style="display:none">0</span>
        </a>
        <a id="authLink" href="login.html">
          <img class="avatar" id="avatarImg" style="display:none" />
          <span id="signInLabel" class="icon-btn">Sign in</span>
        </a>
      </div>
    </div>
  `;
  updateCartBadge();
  reflectAuthState();
}

async function reflectAuthState() {
  const user = await getCurrentUser();
  const authLink = document.getElementById("authLink");
  const avatarImg = document.getElementById("avatarImg");
  const signInLabel = document.getElementById("signInLabel");
  if (!authLink) return;
  if (user) {
    authLink.href = "account.html";
    avatarImg.src = user.user_metadata?.avatar_url || "https://api.dicebear.com/7.x/initials/svg?seed=" + (user.email || "U");
    avatarImg.style.display = "block";
    signInLabel.style.display = "none";
  } else {
    authLink.href = "login.html";
    avatarImg.style.display = "none";
    signInLabel.style.display = "block";
  }
}
