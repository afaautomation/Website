/**
 * Kompetenzen Auth Modal Component
 * Displays the 2-Panel Sign Up / Log In popup on school pages and handles user authentication.
 */
(function () {
  'use strict';

  // Inject styles if not present
  function injectAuthStyles() {
    if (document.getElementById('auth-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'auth-modal-styles';
    style.textContent = `
      #jobs-auth-modal,
      #jobs-auth-modal * {
        box-sizing: border-box !important;
      }
      #jobs-auth-modal .auth-modal-container {
        width: 100% !important;
        max-width: 760px !important;
        overflow: hidden !important;
      }
      #jobs-auth-modal .auth-modal-left {
        flex: 0 0 44% !important;
        min-width: 0 !important;
      }
      #jobs-auth-modal .auth-modal-right {
        flex: 1 1 56% !important;
        min-width: 0 !important;
        overflow: hidden !important;
      }
      #jobs-auth-modal .auth-fields-grid {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
        gap: 0.65rem 0.75rem !important;
        width: 100% !important;
      }
      #jobs-auth-modal .auth-fields-grid > div {
        min-width: 0 !important;
        width: 100% !important;
      }
      #jobs-auth-modal input {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }
      @keyframes authFadeIn {
        from {
          opacity: 0;
          transform: scale(0.96) translateY(8px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      @media (max-width: 680px) {
        #jobs-auth-modal .auth-modal-container {
          flex-direction: column !important;
          max-height: 90vh !important;
          overflow-y: auto !important;
        }
        #jobs-auth-modal .auth-modal-left {
          width: 100% !important;
          flex: none !important;
          border-right: none !important;
          border-bottom: 1px solid #f1f5f9 !important;
          padding: 1.25rem 1.5rem !important;
        }
        #jobs-auth-modal .auth-modal-right {
          width: 100% !important;
          flex: none !important;
          padding: 1.25rem 1.5rem !important;
        }
        #jobs-auth-modal .auth-fields-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Inject modal HTML if not already in document
  function ensureAuthModalDOM() {
    if (document.getElementById('jobs-auth-modal')) return;

    injectAuthStyles();

    const modalMarkup = `
    <div id="jobs-auth-modal"
      style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.65); backdrop-filter:blur(8px); align-items:center; justify-content:center; padding:1rem; box-sizing:border-box;">
      <div class="auth-modal-container"
        style="background:#ffffff; border-radius:20px; width:100%; max-width:760px; overflow:hidden; box-shadow:0 25px 60px -12px rgba(15,23,42,0.35), 0 0 0 1px rgba(15,23,42,0.06); animation:authFadeIn 0.25s ease; position:relative; display:flex; flex-direction:row; box-sizing:border-box;">
        
        <!-- LEFT PANEL: Brand, Title, 1-Click Google & Trust Perks -->
        <div class="auth-modal-left"
          style="width:44%; background:#f8fafc; padding:2rem 1.75rem; border-right:1px solid #f1f5f9; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box; min-width:0;">
          <div>
            <img src="kompetenzen logo-02.png" alt="Kompetenzen" style="height:28px; margin-bottom:1.15rem; display:block;">
            <h3 id="auth-modal-title" style="margin:0 0 0.4rem; font-size:1.25rem; font-weight:800; color:#0f172a; letter-spacing:-0.02em; line-height:1.25;">Create Your Account</h3>
            <p id="auth-modal-subtitle" style="margin:0 0 1.25rem; font-size:0.82rem; color:#64748b; line-height:1.45;">Sign up to access courses, jobs & placements</p>
            
            <!-- Google 1-Click Button -->
            <button type="button" id="lead-google-btn" onclick="triggerWebsiteGoogleSignIn()"
              style="display:flex; align-items:center; justify-content:center; gap:9px; width:100%; padding:0.7rem 1rem; background:#fff; border:1.5px solid #e2e8f0; border-radius:10px; font-family:inherit; font-size:0.88rem; font-weight:600; color:#1e293b; cursor:pointer; transition:all 0.2s ease; box-shadow:0 1px 2px rgba(0,0,0,0.04); box-sizing:border-box;"
              onmouseover="this.style.borderColor='#cbd5e1'; this.style.background='#f8fafc'; this.style.transform='translateY(-1px)';"
              onmouseout="this.style.borderColor='#e2e8f0'; this.style.background='#fff'; this.style.transform='none';">
              <svg style="width:18px; height:18px; flex-shrink:0;" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span id="lead-google-btn-text">Continue with Google</span>
            </button>

            <!-- Feature Perks -->
            <div style="margin-top:1.4rem; display:flex; flex-direction:column; gap:0.6rem;">
              <div style="display:flex; align-items:center; gap:0.55rem; font-size:0.78rem; color:#475569; font-weight:600;">
                <span style="color:#10b981; font-weight:800;">✓</span> 1-Click instant sign-in
              </div>
              <div style="display:flex; align-items:center; gap:0.55rem; font-size:0.78rem; color:#475569; font-weight:600;">
                <span style="color:#10b981; font-weight:800;">✓</span> 100% Placement assistance
              </div>
              <div style="display:flex; align-items:center; gap:0.55rem; font-size:0.78rem; color:#475569; font-weight:600;">
                <span style="color:#10b981; font-weight:800;">✓</span> Industry-verified certificates
              </div>
            </div>
          </div>

          <div style="padding-top:1.15rem; border-top:1px solid #e2e8f0; font-size:0.74rem; color:#94a3b8; display:flex; align-items:center; gap:0.4rem;">
            <span>🎓</span> Trusted by 5,000+ students & learners
          </div>
        </div>

        <!-- RIGHT PANEL: Tab Switcher, Close Button, & Email Auth Form -->
        <div class="auth-modal-right"
          style="width:56%; padding:1.75rem 1.75rem; background:#ffffff; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box; min-width:0; overflow:hidden;">
          
          <!-- Top Row: Tab Switcher on Left, Close Button on Right -->
          <div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1rem;">
              <div style="display:flex; background:#f1f5f9; border-radius:99px; padding:2px; border:1px solid #e2e8f0;">
                <button type="button" id="tab-signup-btn" onclick="switchAuthTab('signup')"
                  style="padding:5px 14px; border:none; border-radius:99px; font-weight:700; font-size:0.78rem; cursor:pointer; transition:all 0.2s; background:#1947FF; color:#ffffff; box-shadow:0 2px 6px rgba(25,71,255,0.25);">
                  Sign Up
                </button>
                <button type="button" id="tab-login-btn" onclick="switchAuthTab('login')"
                  style="padding:5px 14px; border:none; border-radius:99px; font-weight:700; font-size:0.78rem; cursor:pointer; transition:all 0.2s; background:transparent; color:#64748b;">
                  Log In
                </button>
              </div>

              <button type="button" onclick="closeJobsAuthModal()" aria-label="Close modal"
                style="background:#f8fafc; border:1px solid #e2e8f0; cursor:pointer; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#64748b; transition:all 0.2s;"
                onmouseover="this.style.background='#fee2e2'; this.style.borderColor='#fca5a5'; this.style.color='#b91c1c'"
                onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0'; this.style.color='#64748b'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <!-- Divider -->
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:1rem;">
              <div style="flex:1; height:1px; background:#f1f5f9;"></div>
              <span id="auth-divider-text" style="font-size:0.72rem; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.06em;">or continue with email</span>
              <div style="flex:1; height:1px; background:#f1f5f9;"></div>
            </div>

            <!-- Inline Status Message -->
            <div id="auth-inline-msg" style="display:none; padding:0.55rem 0.85rem; border-radius:8px; font-size:0.82rem; font-weight:600; margin-bottom:0.85rem; text-align:center;"></div>

            <!-- SIGN UP FORM -->
            <form id="signup-form" onsubmit="handleSignupSubmit(event)" style="display:flex; flex-direction:column; gap:0.75rem; width:100%; box-sizing:border-box;">
              <div class="auth-fields-grid" style="display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:0.65rem 0.75rem; width:100%; box-sizing:border-box;">
                <div style="display:flex; flex-direction:column; gap:0.25rem; min-width:0;">
                  <label style="font-size:0.74rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">Full Name</label>
                  <input id="signup-name" type="text" required placeholder="Enter full name"
                    style="width:100%; max-width:100%; min-width:0; box-sizing:border-box; padding:0.6rem 0.75rem; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; font-size:0.88rem; color:#0f172a; outline:none; transition:all 0.2s;"
                    onfocus="this.style.borderColor='#1947FF'; this.style.background='#fff'" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'">
                </div>
                <div style="display:flex; flex-direction:column; gap:0.25rem; min-width:0;">
                  <label style="font-size:0.74rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">Email Address</label>
                  <input id="signup-email" type="email" required placeholder="you@example.com"
                    style="width:100%; max-width:100%; min-width:0; box-sizing:border-box; padding:0.6rem 0.75rem; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; font-size:0.88rem; color:#0f172a; outline:none; transition:all 0.2s;"
                    onfocus="this.style.borderColor='#1947FF'; this.style.background='#fff'" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'">
                </div>
                <div style="display:flex; flex-direction:column; gap:0.25rem; min-width:0;">
                  <label style="font-size:0.74rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">Phone Number</label>
                  <input id="signup-phone" type="tel" required placeholder="+91 98765 43210"
                    style="width:100%; max-width:100%; min-width:0; box-sizing:border-box; padding:0.6rem 0.75rem; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; font-size:0.88rem; color:#0f172a; outline:none; transition:all 0.2s;"
                    onfocus="this.style.borderColor='#1947FF'; this.style.background='#fff'" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'">
                </div>
                <div style="display:flex; flex-direction:column; gap:0.25rem; position:relative; min-width:0;">
                  <label style="font-size:0.74rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">Password</label>
                  <input id="signup-password" type="password" required minlength="6" placeholder="Min 6 chars"
                    style="width:100%; max-width:100%; min-width:0; box-sizing:border-box; padding:0.6rem 2rem 0.6rem 0.75rem; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; font-size:0.88rem; color:#0f172a; outline:none; transition:all 0.2s;"
                    onfocus="this.style.borderColor='#1947FF'; this.style.background='#fff'" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'">
                  <span onclick="togglePasswordVisibility('signup-password')" style="position:absolute; right:8px; top:28px; cursor:pointer; color:#94a3b8; font-size:13px; user-select:none; padding:4px;" title="Toggle password visibility">👁️</span>
                </div>
              </div>
              
              <button type="submit" id="signup-submit-btn"
                style="background:#1947FF; color:#fff; border:none; padding:0.72rem 1rem; border-radius:10px; font-weight:700; font-size:0.9rem; cursor:pointer; transition:all 0.2s; box-shadow:0 2px 8px rgba(25,71,255,0.28); margin-top:0.35rem; width:100%; box-sizing:border-box;"
                onmouseover="this.style.background='#0E2EC9'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='#1947FF'; this.style.transform='none'">
                Create Account →
              </button>
              <p style="margin:0.2rem 0 0; font-size:0.78rem; color:#64748b; text-align:center;">
                Already have an account? <a href="javascript:void(0)" onclick="switchAuthTab('login')" style="color:#1947FF; font-weight:700; text-decoration:none;">Log In</a>
              </p>
            </form>

            <!-- LOG IN FORM -->
            <form id="login-form" onsubmit="handleLoginSubmit(event)" style="display:none; flex-direction:column; gap:0.8rem; width:100%; box-sizing:border-box;">
              <div style="display:flex; flex-direction:column; gap:0.25rem; min-width:0;">
                <label style="font-size:0.74rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">Email Address</label>
                <input id="login-email" type="email" required placeholder="Enter your email address" autocomplete="off"
                  style="width:100%; max-width:100%; min-width:0; box-sizing:border-box; padding:0.65rem 0.85rem; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; font-size:0.88rem; color:#0f172a; outline:none; transition:all 0.2s;"
                  onfocus="this.style.borderColor='#1947FF'; this.style.background='#fff'" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'">
              </div>
              <div style="display:flex; flex-direction:column; gap:0.25rem; position:relative; min-width:0;">
                <label style="font-size:0.74rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.03em;">Password</label>
                <input id="login-password" type="password" required placeholder="Enter password"
                  style="width:100%; max-width:100%; min-width:0; box-sizing:border-box; padding:0.65rem 2.2rem 0.65rem 0.85rem; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; font-size:0.88rem; color:#0f172a; outline:none; transition:all 0.2s;"
                  onfocus="this.style.borderColor='#1947FF'; this.style.background='#fff'" onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'">
                <span onclick="togglePasswordVisibility('login-password')" style="position:absolute; right:8px; top:28px; cursor:pointer; color:#94a3b8; font-size:13px; user-select:none; padding:4px;" title="Toggle password visibility">👁️</span>
              </div>
              
              <button type="submit" id="login-submit-btn"
                style="background:#1947FF; color:#fff; border:none; padding:0.72rem 1rem; border-radius:10px; font-weight:700; font-size:0.9rem; cursor:pointer; transition:all 0.2s; box-shadow:0 2px 8px rgba(25,71,255,0.28); margin-top:0.35rem; width:100%; box-sizing:border-box;"
                onmouseover="this.style.background='#0E2EC9'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='#1947FF'; this.style.transform='none'">
                Log In →
              </button>
              <p style="margin:0.2rem 0 0; font-size:0.78rem; color:#64748b; text-align:center;">
                Don't have an account? <a href="javascript:void(0)" onclick="switchAuthTab('signup')" style="color:#1947FF; font-weight:700; text-decoration:none;">Sign Up</a>
              </p>
            </form>

          </div>
        </div>
      </div>
    </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = modalMarkup;
    document.body.appendChild(container.firstElementChild);

    // Click outside backdrop to close
    document.getElementById('jobs-auth-modal')?.addEventListener('click', function (e) {
      if (e.target === this) closeJobsAuthModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeJobsAuthModal();
    });
  }

  // ===== AUTHENTICATION MODAL LOGIC =====
  let currentAuthMode = 'signup';

  window.switchAuthTab = function (mode) {
    ensureAuthModalDOM();
    currentAuthMode = mode;
    const signupBtn = document.getElementById('tab-signup-btn');
    const loginBtn = document.getElementById('tab-login-btn');
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');
    const titleEl = document.getElementById('auth-modal-title');
    const subtitleEl = document.getElementById('auth-modal-subtitle');
    const googleText = document.getElementById('lead-google-btn-text');
    const dividerText = document.getElementById('auth-divider-text');
    const inlineMsg = document.getElementById('auth-inline-msg');

    if (inlineMsg) inlineMsg.style.display = 'none';

    if (mode === 'login') {
      if (signupBtn) {
        signupBtn.style.background = 'transparent';
        signupBtn.style.color = '#64748b';
        signupBtn.style.boxShadow = 'none';
      }
      if (loginBtn) {
        loginBtn.style.background = '#1947FF';
        loginBtn.style.color = '#ffffff';
        loginBtn.style.boxShadow = '0 2px 6px rgba(25,71,255,0.25)';
      }
      if (signupForm) signupForm.style.display = 'none';
      if (loginForm) loginForm.style.display = 'flex';
      if (titleEl) titleEl.textContent = 'Welcome Back';
      if (subtitleEl) subtitleEl.textContent = 'Log in to your student & career portal';
      if (googleText) googleText.textContent = 'Log In with Google';
      if (dividerText) dividerText.textContent = 'or continue with email';
    } else {
      if (signupBtn) {
        signupBtn.style.background = '#1947FF';
        signupBtn.style.color = '#ffffff';
        signupBtn.style.boxShadow = '0 2px 6px rgba(25,71,255,0.25)';
      }
      if (loginBtn) {
        loginBtn.style.background = 'transparent';
        loginBtn.style.color = '#64748b';
        loginBtn.style.boxShadow = 'none';
      }
      if (signupForm) signupForm.style.display = 'flex';
      if (loginForm) loginForm.style.display = 'none';
      if (titleEl) titleEl.textContent = 'Create Your Account';
      if (subtitleEl) subtitleEl.textContent = 'Sign up to access courses, jobs & placements';
      if (googleText) googleText.textContent = 'Continue with Google';
      if (dividerText) dividerText.textContent = 'or continue with email';
    }
  };

  window.togglePasswordVisibility = function (inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  };

  window.showAuthMessage = function (msg, isError = false) {
    const msgEl = document.getElementById('auth-inline-msg');
    if (!msgEl) return;
    msgEl.textContent = msg;
    msgEl.style.display = 'block';
    if (isError) {
      msgEl.style.background = '#FEE2E2';
      msgEl.style.color = '#B91C1C';
      msgEl.style.border = '1px solid #FECACA';
    } else {
      msgEl.style.background = '#DCFCE7';
      msgEl.style.color = '#15803D';
      msgEl.style.border = '1px solid #BBF7D0';
    }
  };

  window.closeJobsAuthModal = function () {
    const modal = document.getElementById('jobs-auth-modal');
    if (modal) modal.style.display = 'none';
    window._pendingAuthRedirect = null;
    window._pendingAuthSection = null;
    const msgEl = document.getElementById('auth-inline-msg');
    if (msgEl) msgEl.style.display = 'none';
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';
  };

  window.openAuthModal = function (mode = 'signup', redirectUrl = null) {
    ensureAuthModalDOM();
    const modal = document.getElementById('jobs-auth-modal');
    if (redirectUrl) window._pendingAuthRedirect = redirectUrl;

    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';

    // Always honor requested mode, defaulting to 'signup'
    const activeMode = (mode === 'login') ? 'login' : 'signup';
    window.switchAuthTab(activeMode);
    if (modal) modal.style.display = 'flex';
  };

  // The primary interceptor for "View course details" buttons on school pages
  window.checkAuthAndGoToCourse = function (event, url) {
    if (event && event.preventDefault) event.preventDefault();
    if (isUserLoggedIn()) {
      window.location.href = url;
    } else {
      window.openAuthModal('signup', url);
    }
  };

  // Job listing interceptor
  window.checkAuthAndGoToJob = function (event, url) {
    if (event && event.preventDefault) event.preventDefault();
    if (isUserLoggedIn()) {
      window.location.href = url;
    } else {
      window.openAuthModal('signup', url);
    }
  };

  // Resume builder trigger
  window.openResumeBuilder = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const RESUME_BUILDER_URL = 'Resume/resume.html';
    if (isUserLoggedIn()) {
      window.location.href = RESUME_BUILDER_URL;
    } else {
      window._pendingAuthSection = 'resume';
      window.openAuthModal('signup', RESUME_BUILDER_URL);
    }
  };

  // ===== UNIFIED AUTHENTICATION & SINGLE SIGN-ON (SSO) HELPERS =====
  const AUTH_STORAGE_KEY = 'kompetenzen_google_user';

  function getStoredUser() {
    try {
      const raw = localStorage.getItem('kompetenzen_user') || localStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.email || parsed.name)) return parsed;
      return null;
    } catch (e) {
      return null;
    }
  }

  function isUserLoggedIn() {
    const user = getStoredUser();
    return !!(user && (user.email || user.name));
  }

  window.isUserLoggedIn = isUserLoggedIn;
  window.getStoredUser = getStoredUser;

  function getRegisteredUsers() {
    try {
      return JSON.parse(localStorage.getItem('kompetenzen_registered_users') || '[]');
    } catch (e) {
      return [];
    }
  }

  function hasRegisteredAccount() {
    try {
      const users = getRegisteredUsers();
      if (users && users.length > 0) return true;
      if (getStoredUser() || localStorage.getItem('kompetenzen_last_auth_email')) return true;
    } catch (e) {}
    return false;
  }

  function getLastKnownEmail() {
    try {
      const stored = getStoredUser();
      if (stored && stored.email) return stored.email;
      const last = localStorage.getItem('kompetenzen_last_auth_email');
      if (last) return last;
      const users = getRegisteredUsers();
      if (users.length > 0 && users[users.length - 1].email) return users[users.length - 1].email;
    } catch (e) {}
    return '';
  }

  function saveUnifiedSession(userData) {
    const token = localStorage.getItem('token') || ('kompetenzen_jwt_' + Math.random().toString(36).substring(2) + Date.now().toString(36));
    const userObj = {
      name: userData.name || 'Student / Candidate',
      email: (userData.email || '').toLowerCase(),
      phone: userData.phone || '',
      authType: userData.authType || 'Direct Login',
      loginTime: new Date().toISOString()
    };

    localStorage.setItem('token', token);
    localStorage.setItem('kompetenzen_user', JSON.stringify(userObj));
    localStorage.setItem('user', JSON.stringify(userObj));
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userObj));
    if (userObj.email) {
      localStorage.setItem('kompetenzen_last_auth_email', userObj.email);
    }

    try {
      const users = getRegisteredUsers();
      const idx = users.findIndex(u => (u.email || '').toLowerCase() === userObj.email);
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...userObj, password: userData.password || users[idx].password || '' };
      } else {
        users.push({ ...userObj, password: userData.password || '' });
      }
      localStorage.setItem('kompetenzen_registered_users', JSON.stringify(users));
    } catch (e) {}

    syncToResumeBuilder({ name: userObj.name, email: userObj.email, phone: userObj.phone });

    document.querySelectorAll('.logout-link').forEach(l => (l.style.display = 'inline-block'));

    return userObj;
  }

  function syncToResumeBuilder(userData) {
    try {
      fetch('http://localhost:5000/api/auth/login-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: userData.phone || userData.email,
          email: userData.email,
          name: userData.name
        })
      }).catch(function () {});
    } catch (e) {}
  }

  function completeAuthSession(userData, redirectMsg = 'Logging in…') {
    saveUnifiedSession(userData);
    updateNavBadge();
    window.showAuthMessage(`✓ ${redirectMsg}`, false);

    setTimeout(() => {
      const redirect = window._pendingAuthRedirect;
      window._pendingAuthRedirect = null;
      const section = window._pendingAuthSection;
      window._pendingAuthSection = null;

      if (redirect) {
        if (redirect.indexOf('http') === 0 && redirect.indexOf(window.location.host) === -1) {
          window.open(redirect, '_blank');
          window.closeJobsAuthModal();
        } else {
          window.location.href = redirect;
        }
      } else {
        window.closeJobsAuthModal();
      }
    }, 700);
  }

  window.handleSignupSubmit = async function (e) {
    e.preventDefault();
    const name = document.getElementById('signup-name')?.value.trim();
    const email = document.getElementById('signup-email')?.value.trim().toLowerCase();
    const phone = document.getElementById('signup-phone')?.value.trim();
    const password = document.getElementById('signup-password')?.value;
    const btn = document.getElementById('signup-submit-btn');

    if (!name || !email || !phone || !password) {
      window.showAuthMessage('Please fill in all required fields.', true);
      return;
    }

    if (!isSupabaseConfigured()) {
      window.showAuthMessage('Sign up is temporarily unavailable. Please try again shortly.', true);
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creating Account…';
    }

    try {
      const newUser = await supabaseSignUp(name, email, phone, password);
      completeAuthSession(newUser, 'Account created! Redirecting to course…');
    } catch (err) {
      const msg = (err && err.message) || 'Could not create account. Please try again.';
      if (/already registered|already exists/i.test(msg)) {
        window.showAuthMessage('An account with this email already exists. Please log in.', true);
        window.switchAuthTab('login');
        const loginEmail = document.getElementById('login-email');
        if (loginEmail) loginEmail.value = email;
      } else {
        window.showAuthMessage(msg, true);
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Create Account →';
      }
    }
  };

  window.handleLoginSubmit = async function (e) {
    e.preventDefault();
    const email = document.getElementById('login-email')?.value.trim().toLowerCase();
    const password = document.getElementById('login-password')?.value;
    const btn = document.getElementById('login-submit-btn');

    if (!email || !password) {
      window.showAuthMessage('Please enter both your email and password.', true);
      return;
    }

    if (!isSupabaseConfigured()) {
      window.showAuthMessage('Log in is temporarily unavailable. Please try again shortly.', true);
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Verifying…';
    }

    try {
      const authenticatedUser = await supabaseSignIn(email, password);
      completeAuthSession(authenticatedUser, `Welcome back, ${authenticatedUser.name}! Opening course…`);
    } catch (err) {
      window.showAuthMessage((err && err.message) || 'Incorrect email or password.', true);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Log In →';
      }
    }
  };

  window.triggerWebsiteGoogleSignIn = async function () {
    if (!isSupabaseConfigured()) {
      window.showAuthMessage('Google sign-in is temporarily unavailable. Please try again shortly.', true);
      return;
    }

    const btn = document.getElementById('lead-google-btn');
    const btnText = document.getElementById('lead-google-btn-text');
    if (btnText) btnText.textContent = 'Connecting with Google…';
    if (btn) btn.disabled = true;

    try {
      const redirect = window._pendingAuthRedirect || null;
      const section = window._pendingAuthSection || null;
      if (redirect) localStorage.setItem('kompetenzen_pending_auth_redirect', redirect);
      if (section) localStorage.setItem('kompetenzen_pending_auth_section', section);
      await supabaseSignInWithGoogle(redirect);
      // Browser is now redirecting to Google; nothing more to do here.
    } catch (err) {
      window.showAuthMessage((err && err.message) || 'Google sign-in failed. Please try again.', true);
      if (btnText) btnText.textContent = 'Continue with Google';
      if (btn) btn.disabled = false;
    }
  };

  // Resume any pending OAuth redirect/session after Google sign-in bounces back
  async function resumeOAuthSessionIfAny() {
    if (!isSupabaseConfigured()) return;
    try {
      const user = await supabaseGetSessionUser();
      if (!user) return;
      if (isUserLoggedIn()) return; // already handled
      window._pendingAuthRedirect = localStorage.getItem('kompetenzen_pending_auth_redirect') || null;
      window._pendingAuthSection = localStorage.getItem('kompetenzen_pending_auth_section') || null;
      localStorage.removeItem('kompetenzen_pending_auth_redirect');
      localStorage.removeItem('kompetenzen_pending_auth_section');
      ensureAuthModalDOM();
      completeAuthSession(user, `Welcome, ${user.name}! Signed in with Google…`);
    } catch (e) {}
  }

  // Hash-based triggers (e.g. #auth-redirect=course-details.html, #login, #signup)
  function handleUrlHash() {
    if (
      window.location.hash.startsWith('#auth-redirect=') ||
      window.location.hash === '#jobs-auth' ||
      window.location.hash === '#signup' ||
      window.location.hash === '#login'
    ) {
      let redirect = null;
      if (window.location.hash.startsWith('#auth-redirect=')) {
        redirect = window.location.hash.replace('#auth-redirect=', '');
      }
      const initialMode = window.location.hash === '#login' ? 'login' : 'signup';
      window.openAuthModal(initialMode, redirect);
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function updateNavBadge() {
    const user = getStoredUser();
    const navBadge = document.getElementById('nav-user-badge');
    if (!navBadge) return;
    if (user && (user.email || user.name)) {
      const displayName = user.name || 'Candidate';
      const displayInitial = (displayName || 'C')[0].toUpperCase();
      const navName = document.getElementById('nav-user-name');
      const navAvatar = document.getElementById('nav-user-avatar');
      const menuName = document.getElementById('nav-user-menu-name');
      const menuEmail = document.getElementById('nav-user-menu-email');
      navBadge.style.display = 'block';
      if (navName) navName.textContent = displayName;
      if (navAvatar) navAvatar.textContent = displayInitial;
      if (menuName) menuName.textContent = displayName;
      if (menuEmail) menuEmail.textContent = user.email || '';
    } else {
      navBadge.style.display = 'none';
      navBadge.classList.remove('open');
    }
  }

  window.toggleNavUserDropdown = function (e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const navBadge = document.getElementById('nav-user-badge');
    if (navBadge) navBadge.classList.toggle('open');
  };

  function initAuthNav() {
    ensureAuthModalDOM();
    handleUrlHash();
    resumeOAuthSessionIfAny();
    updateNavBadge();
    if (isUserLoggedIn()) {
      document.querySelectorAll('.logout-link').forEach(l => {
        l.style.display = 'inline-block';
        l.onclick = function (e) {
          if (e && e.preventDefault) e.preventDefault();
          window.handleSignOut();
        };
      });
    }
  }

  window.handleSignOut = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (typeof supabaseSignOut === 'function') supabaseSignOut();
    ['token', 'kompetenzen_user', 'user', 'kompetenzen_google_user', 'kompetenzen_candidate_profile'].forEach(k => localStorage.removeItem(k));
    const navBadge = document.getElementById('nav-user-badge');
    if (navBadge) {
      navBadge.classList.remove('open');
      navBadge.style.display = 'none';
    }
    window.location.reload();
  };

  // On page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthNav);
  } else {
    initAuthNav();
  }
})();
