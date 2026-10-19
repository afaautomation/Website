/**
 * Kompetenzen Auth Modal Component
 * Displays the NextRaise-inspired login/signup flow:
 * Step 1: Clean choice between "Continue with Google" & "Continue with email"
 * Step 2: When "Continue with email" is clicked, asks for full name, email, phone number & password.
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
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      #jobs-auth-modal .auth-modal-card {
        width: 100% !important;
        max-width: 440px !important;
        background: #ffffff !important;
        border-radius: 24px !important;
        padding: 2.25rem 2rem !important;
        box-shadow: 0 25px 60px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08) !important;
        position: relative !important;
        animation: authModalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
        overflow: hidden !important;
      }
      @keyframes authModalPop {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(10px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      .auth-step-view {
        animation: authStepFade 0.2s ease-in-out;
      }
      @keyframes authStepFade {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .auth-pill-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;
        width: 100% !important;
        padding: 0.85rem 1.25rem !important;
        border-radius: 9999px !important;
        font-size: 0.95rem !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        text-decoration: none !important;
        outline: none !important;
      }
      .auth-pill-btn:hover {
        transform: translateY(-1px) !important;
      }
      .auth-google-btn {
        background: #f0f4fe !important;
        border: 1px solid rgba(25, 71, 255, 0.12) !important;
        color: #0f172a !important;
      }
      .auth-google-btn:hover {
        background: #e4ecfc !important;
        box-shadow: 0 4px 12px rgba(25, 71, 255, 0.1) !important;
      }
      .auth-email-btn {
        background: #ffffff !important;
        border: 1.5px solid #e2e8f0 !important;
        color: #1e293b !important;
      }
      .auth-email-btn:hover {
        background: #f8fafc !important;
        border-color: #cbd5e1 !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
      }
      .auth-submit-btn {
        background: #1947FF !important;
        border: none !important;
        color: #ffffff !important;
        box-shadow: 0 4px 14px rgba(25, 71, 255, 0.3) !important;
      }
      .auth-submit-btn:hover {
        background: #0E2EC9 !important;
        box-shadow: 0 6px 18px rgba(25, 71, 255, 0.4) !important;
      }
      .auth-input-group {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        margin-bottom: 0.8rem;
        position: relative;
      }
      .auth-input-group label {
        font-size: 0.76rem;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .auth-input-group input {
        width: 100% !important;
        padding: 0.72rem 0.95rem !important;
        background: #f8fafc !important;
        border: 1.5px solid #e2e8f0 !important;
        border-radius: 12px !important;
        font-size: 0.92rem !important;
        color: #0f172a !important;
        outline: none !important;
        transition: all 0.2s ease !important;
      }
      .auth-input-group input:focus {
        border-color: #1947FF !important;
        background: #ffffff !important;
        box-shadow: 0 0 0 3px rgba(25, 71, 255, 0.1) !important;
      }
      .auth-close-btn {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        transition: all 0.2s ease;
      }
      .auth-close-btn:hover {
        background: #fee2e2;
        border-color: #fca5a5;
        color: #b91c1c;
      }
      .auth-back-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85rem;
        font-weight: 600;
        color: #64748b;
        padding: 4px 8px;
        border-radius: 8px;
        transition: all 0.2s ease;
      }
      .auth-back-btn:hover {
        color: #0f172a;
        background: #f1f5f9;
      }
      @media (max-width: 480px) {
        #jobs-auth-modal .auth-modal-card {
          padding: 1.75rem 1.25rem !important;
          border-radius: 20px !important;
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
      
      <div class="auth-modal-card">
        
        <!-- ========================================== -->
        <!-- STEP 1: CHOICE SCREEN (NextRaise Style)   -->
        <!-- ========================================== -->
        <div id="auth-step-choice" class="auth-step-view" style="display:block;">
          
          <!-- Top Row: Logo & Close Button -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem;">
            <div style="display:flex; align-items:center; gap:8px;">
              <img src="kompetenzen logo-02.webp" alt="Kompetenzen" style="height:26px; display:block;">
            </div>
            <button type="button" class="auth-close-btn" onclick="closeJobsAuthModal()" aria-label="Close modal">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <!-- Hero Text -->
          <h2 id="auth-modal-hero-title" style="font-size:1.55rem; font-weight:800; color:#0f172a; line-height:1.22; letter-spacing:-0.03em; margin:0 0 0.5rem;">
            Find matching jobs you'll actually get <span style="color:#1947FF;">placed for.</span>
          </h2>
          <p id="auth-modal-hero-sub" style="font-size:0.88rem; color:#64748b; font-weight:500; margin:0 0 1.75rem;">
            Free to start · no card needed
          </p>

          <!-- Action Buttons Stack -->
          <div style="display:flex; flex-direction:column; gap:0.75rem; width:100%;">
            
            <!-- 1. Continue with Google -->
            <button type="button" id="lead-google-btn" class="auth-pill-btn auth-google-btn" onclick="triggerWebsiteGoogleSignIn()">
              <svg style="width:19px; height:19px; flex-shrink:0;" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span id="lead-google-btn-text">Continue with Google</span>
            </button>

            <!-- 2. Continue with email -->
            <button type="button" id="btn-continue-with-email" class="auth-pill-btn auth-email-btn" onclick="showEmailAuthStep('signup')">
              <span>Continue with email</span>
            </button>
          </div>

          <!-- Terms / Privacy Disclaimer -->
          <p style="font-size:0.75rem; color:#94a3b8; line-height:1.45; text-align:center; margin:1.75rem 0 0;">
            By continuing you agree to the <a href="javascript:void(0)" style="color:#64748b; text-decoration:underline;">Terms of Service</a> and <a href="javascript:void(0)" style="color:#64748b; text-decoration:underline;">Privacy Policy</a>
          </p>

          <!-- Existing user link -->
          <div style="margin-top:1rem; text-align:center; font-size:0.83rem; color:#64748b;">
            Already have an account? <a href="javascript:void(0)" onclick="showEmailAuthStep('login')" style="color:#1947FF; font-weight:700; text-decoration:none;">Log In</a>
          </div>
        </div>

        <!-- ========================================== -->
        <!-- STEP 2: EMAIL & DETAILS FORM (As requested)-->
        <!-- ========================================== -->
        <div id="auth-step-email" class="auth-step-view" style="display:none;">
          
          <!-- Top Row: Back button & Close button -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.1rem;">
            <button type="button" class="auth-back-btn" onclick="showChoiceStep()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Back</span>
            </button>

            <button type="button" class="auth-close-btn" onclick="closeJobsAuthModal()" aria-label="Close modal">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <!-- Step 2 Title & Tab Switcher -->
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:0.4rem;">
            <h3 id="auth-modal-title" style="margin:0; font-size:1.32rem; font-weight:800; color:#0f172a; letter-spacing:-0.025em;">
              Create Your Account
            </h3>
            
            <!-- Switcher Pills -->
            <div style="display:flex; background:#f1f5f9; border-radius:99px; padding:2px; border:1px solid #e2e8f0; flex-shrink:0;">
              <button type="button" id="tab-signup-btn" onclick="switchAuthTab('signup')"
                style="padding:4px 12px; border:none; border-radius:99px; font-weight:700; font-size:0.75rem; cursor:pointer; transition:all 0.2s; background:#1947FF; color:#ffffff; box-shadow:0 2px 6px rgba(25,71,255,0.25);">
                Sign Up
              </button>
              <button type="button" id="tab-login-btn" onclick="switchAuthTab('login')"
                style="padding:4px 12px; border:none; border-radius:99px; font-weight:700; font-size:0.75rem; cursor:pointer; transition:all 0.2s; background:transparent; color:#64748b;">
                Log In
              </button>
            </div>
          </div>

          <p id="auth-modal-subtitle" style="margin:0 0 1.15rem; font-size:0.83rem; color:#64748b; line-height:1.4;">
            Enter your details to access courses, jobs & placements
          </p>

          <!-- Inline Status Message -->
          <div id="auth-inline-msg" style="display:none; padding:0.55rem 0.85rem; border-radius:10px; font-size:0.82rem; font-weight:600; margin-bottom:0.85rem; text-align:center;"></div>

          <!-- SIGN UP FORM (Asks email, phone numbers & details) -->
          <form id="signup-form" onsubmit="handleSignupSubmit(event)" style="display:flex; flex-direction:column; gap:0.2rem;">
            
            <div class="auth-input-group">
              <label>Full Name</label>
              <input id="signup-name" type="text" required placeholder="Enter your full name" autocomplete="name">
            </div>

            <div class="auth-input-group">
              <label>Email Address</label>
              <input id="signup-email" type="email" required placeholder="you@example.com" autocomplete="email">
            </div>

            <div class="auth-input-group">
              <label>Phone Number</label>
              <input id="signup-phone" type="tel" required placeholder="+91 98765 43210" autocomplete="tel">
            </div>

            <div class="auth-input-group">
              <label>Password</label>
              <input id="signup-password" type="password" required minlength="6" placeholder="Min 6 characters" autocomplete="new-password">
              <span onclick="togglePasswordVisibility('signup-password')"
                style="position:absolute; right:10px; top:31px; cursor:pointer; color:#94a3b8; font-size:14px; user-select:none; padding:4px;"
                title="Toggle password visibility">👁️</span>
            </div>

            <button type="submit" id="signup-submit-btn" class="auth-pill-btn auth-submit-btn" style="margin-top:0.4rem;">
              Create Account →
            </button>

            <div style="margin-top:0.85rem; text-align:center; font-size:0.8rem; color:#64748b;">
              Already have an account? <a href="javascript:void(0)" onclick="switchAuthTab('login')" style="color:#1947FF; font-weight:700; text-decoration:none;">Log In</a>
            </div>
          </form>

          <!-- LOG IN FORM (EMAIL + PASSWORD, verified by Supabase) -->
          <form id="login-form" onsubmit="handleLoginSubmit(event)" style="display:none; flex-direction:column; gap:0.35rem;">

            <div class="auth-input-group">
              <label for="login-email">Email or mobile number</label>
              <input id="login-email" type="text" required placeholder="Email or verified mobile number" autocomplete="username">
            </div>

            <div class="auth-input-group">
              <label for="login-password">Password</label>
              <input id="login-password" type="password" required minlength="6" placeholder="Your password" autocomplete="current-password">
              <span onclick="togglePasswordVisibility('login-password')"
                style="position:absolute; right:10px; top:31px; cursor:pointer; color:#94a3b8; font-size:14px; user-select:none; padding:4px;"
                title="Toggle password visibility">👁️</span>
            </div>

            <button type="submit" id="login-submit-btn" class="auth-pill-btn auth-submit-btn" style="margin-top:0.45rem;">
              Log In →
            </button>

            <div style="margin-top:0.5rem; text-align:right; font-size:0.78rem;">
              <a href="javascript:void(0)" onclick="authModalForgotPassword()" style="color:#64748b; text-decoration:underline;">Forgot password?</a>
            </div>

            <div style="margin-top:0.85rem; text-align:center; font-size:0.8rem; color:#64748b;">
              Don't have an account? <a href="javascript:void(0)" onclick="switchAuthTab('signup')" style="color:#1947FF; font-weight:700; text-decoration:none;">Sign Up</a>
            </div>
          </form>

          <!-- Quick Return to Google Option -->
          <div style="margin-top:0.75rem; text-align:center; font-size:0.78rem; color:#94a3b8;">
            or <a href="javascript:void(0)" onclick="triggerWebsiteGoogleSignIn()" style="color:#1947FF; font-weight:600; text-decoration:none;">Continue with Google</a>
          </div>

        </div>

        <!-- ========================================== -->
        <!-- STEP 3: MOBILE OTP VERIFICATION SCREEN    -->
        <!-- ========================================== -->
        <div id="auth-step-otp" class="auth-step-view" style="display:none;">
          
          <!-- Top Row: Back button & Close button -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.1rem;">
            <button type="button" class="auth-back-btn" onclick="showEmailAuthStep('signup')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Back</span>
            </button>

            <button type="button" class="auth-close-btn" onclick="closeJobsAuthModal()" aria-label="Close modal">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <!-- Header & Phone icon -->
          <div style="text-align:center; margin-bottom:1.15rem;">
            <div style="width:52px; height:52px; border-radius:50%; background:#eff6ff; border:1px solid #bfdbfe; color:#1947FF; display:inline-flex; align-items:center; justify-content:center; margin-bottom:0.75rem;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
            </div>
            <h3 style="margin:0 0 0.35rem; font-size:1.32rem; font-weight:800; color:#0f172a; letter-spacing:-0.025em;">
              Verify Mobile Number
            </h3>
            <p style="margin:0; font-size:0.83rem; color:#64748b; line-height:1.45;">
              We sent a 6-digit SMS verification code to<br>
              <strong id="otp-phone-display" style="color:#0f172a; font-weight:700;">+91</strong>
            </p>
          </div>

          <!-- Inline Status Message -->
          <div id="otp-inline-msg" style="display:none; padding:0.55rem 0.85rem; border-radius:10px; font-size:0.82rem; font-weight:600; margin-bottom:0.85rem; text-align:center;"></div>

          <!-- OTP Input Form -->
          <form id="otp-form" onsubmit="handleOtpSubmit(event)" style="display:flex; flex-direction:column; gap:0.65rem;">
            <div class="auth-input-group" style="align-items:center;">
              <label style="text-align:center; width:100%;">Enter 6-Digit Code</label>
              <input id="otp-code-input" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" required
                placeholder="• • • • • •" autocomplete="one-time-code"
                style="text-align:center; font-size:1.55rem; font-weight:800; letter-spacing:0.35em; padding:0.72rem 1rem; border-radius:12px; font-family:monospace; width:100%; max-width:240px; margin:0 auto; background:#f8fafc; border:1.5px solid #cbd5e1; outline:none;">
            </div>

              <button type="submit" id="otp-submit-btn" class="auth-pill-btn auth-submit-btn" style="margin-top:0.25rem;">
              Verify & Complete →
            </button>

            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:0.5rem; font-size:0.8rem; color:#64748b;">
              <button type="button" id="otp-resend-btn" onclick="resendOtpCode()" style="background:none; border:none; color:#1947FF; font-weight:600; cursor:pointer; padding:0;" disabled>
                Resend OTP in 30s
              </button>
              <a href="javascript:void(0)" onclick="editSignupPhoneNumber()" style="color:#64748b; text-decoration:underline;">
                Edit Details
              </a>
            </div>
          </form>

        </div>

        <!-- Firebase invisible reCAPTCHA container (must be outside hidden step views) -->
        <div id="recaptcha-container"></div>

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

  // ===== NAVIGATION & STEP TOGGLING =====

  window.showChoiceStep = function () {
    ensureAuthModalDOM();
    const stepChoice = document.getElementById('auth-step-choice');
    const stepEmail = document.getElementById('auth-step-email');
    const stepOtp = document.getElementById('auth-step-otp');
    const inlineMsg = document.getElementById('auth-inline-msg');
    const otpMsg = document.getElementById('otp-inline-msg');
    const smsBanner = document.getElementById('simulated-sms-banner');
    if (inlineMsg) inlineMsg.style.display = 'none';
    if (otpMsg) otpMsg.style.display = 'none';
    if (smsBanner) smsBanner.style.display = 'none';

    if (stepChoice) stepChoice.style.display = 'block';
    if (stepEmail) stepEmail.style.display = 'none';
    if (stepOtp) stepOtp.style.display = 'none';
  };

  window.showEmailAuthStep = function (mode = 'signup') {
    ensureAuthModalDOM();
    const modal = document.getElementById('jobs-auth-modal') || document;
    const stepChoice = modal.querySelector('#auth-step-choice');
    const stepEmail = modal.querySelector('#auth-step-email');
    const stepOtp = modal.querySelector('#auth-step-otp');
    const inlineMsg = modal.querySelector('#auth-inline-msg');
    const otpMsg = modal.querySelector('#otp-inline-msg');
    const smsBanner = modal.querySelector('#simulated-sms-banner');
    if (inlineMsg) inlineMsg.style.display = 'none';
    if (otpMsg) otpMsg.style.display = 'none';
    if (smsBanner) smsBanner.style.display = 'none';

    if (stepChoice) stepChoice.style.display = 'none';
    if (stepEmail) stepEmail.style.display = 'block';
    if (stepOtp) stepOtp.style.display = 'none';

    window.switchAuthTab(mode);
  };

  window.showOtpStep = function (phone, mode = 'signup') {
    ensureAuthModalDOM();
    const modal = document.getElementById('jobs-auth-modal') || document;
    const stepChoice = modal.querySelector('#auth-step-choice');
    const stepEmail = modal.querySelector('#auth-step-email');
    const stepOtp = modal.querySelector('#auth-step-otp');
    const phoneDisplay = modal.querySelector('#otp-phone-display');
    const otpInput = modal.querySelector('#otp-code-input');
    const otpMsg = modal.querySelector('#otp-inline-msg');
    const otpSubmitBtn = modal.querySelector('#otp-submit-btn');

    if (stepChoice) stepChoice.style.display = 'none';
    if (stepEmail) stepEmail.style.display = 'none';
    if (stepOtp) stepOtp.style.display = 'block';

    if (phoneDisplay) phoneDisplay.textContent = phone || 'your mobile number';
    if (otpSubmitBtn) {
      otpSubmitBtn.textContent = mode === 'login' ? 'Verify & Log In →' : 'Verify & Complete →';
    }
    if (otpInput) {
      otpInput.value = '';
      setTimeout(() => otpInput.focus(), 150);
    }
    if (otpMsg) otpMsg.style.display = 'none';
  };

  let currentAuthMode = 'signup';

  window.switchAuthTab = function (mode) {
    ensureAuthModalDOM();
    currentAuthMode = mode;
    const modal = document.getElementById('jobs-auth-modal') || document;
    const signupBtn = modal.querySelector('#tab-signup-btn');
    const loginBtn = modal.querySelector('#tab-login-btn');
    const signupForm = modal.querySelector('#signup-form');
    const loginForm = modal.querySelector('#login-form');
    const titleEl = modal.querySelector('#auth-modal-title');
    const subtitleEl = modal.querySelector('#auth-modal-subtitle');
    const inlineMsg = modal.querySelector('#auth-inline-msg');

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
      if (subtitleEl) subtitleEl.textContent = 'Log in with your email or verified mobile number and password';
      const emailInput = modal.querySelector('#login-email');
      if (emailInput) setTimeout(() => emailInput.focus(), 100);
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
      if (subtitleEl) subtitleEl.textContent = 'Enter your details to access courses, jobs & placements';
      const nameInput = modal.querySelector('#signup-name');
      if (nameInput) setTimeout(() => nameInput.focus(), 100);
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

  let otpCountdownTimer = null;

  function startOtpCountdown(seconds = 30) {
    const resendBtn = document.getElementById('otp-resend-btn');
    if (!resendBtn) return;
    if (otpCountdownTimer) clearInterval(otpCountdownTimer);

    let remaining = seconds;
    resendBtn.disabled = true;
    resendBtn.style.color = '#94a3b8';
    resendBtn.style.cursor = 'default';
    resendBtn.textContent = `Resend OTP in ${remaining}s`;

    otpCountdownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(otpCountdownTimer);
        otpCountdownTimer = null;
        resendBtn.disabled = false;
        resendBtn.style.color = '#1947FF';
        resendBtn.style.cursor = 'pointer';
        resendBtn.textContent = 'Resend OTP';
      } else {
        resendBtn.textContent = `Resend OTP in ${remaining}s`;
      }
    }, 1000);
  }

  function showOtpInlineMessage(msg, isError = false) {
    const el = document.getElementById('otp-inline-msg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    if (isError) {
      el.style.background = '#FEE2E2';
      el.style.color = '#B91C1C';
      el.style.border = '1px solid #FECACA';
    } else {
      el.style.background = '#DCFCE7';
      el.style.color = '#15803D';
      el.style.border = '1px solid #BBF7D0';
    }
  }

  // Dynamic script loader for Firebase Phone Auth
  function loadScriptAsync(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing && existing.getAttribute('data-loaded') === 'true') return resolve();
      const s = existing || document.createElement('script');
      let timer;
      const cleanup = () => { clearTimeout(timer); s.removeEventListener('load', loaded); s.removeEventListener('error', failed); };
      const loaded = () => { cleanup(); s.setAttribute('data-loaded', 'true'); resolve(); };
      const failed = () => { cleanup(); s.remove(); reject(new Error('Could not load phone verification. Check your connection or browser blocking, then try again.')); };
      s.addEventListener('load', loaded);
      s.addEventListener('error', failed);
      timer = setTimeout(failed, 20000);
      if (existing) return;
      s.src = src;
      s.async = true;
      document.head.appendChild(s);
    });
  }

  async function ensureFirebaseAuth() {
    if (typeof window.firebase === 'undefined') {
      await loadScriptAsync('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    }
    if (typeof window.firebase === 'undefined' || !window.firebase.auth) {
      await loadScriptAsync('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js');
    }
    if (!window.firebase.apps || !window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }
    return window.firebase.auth();
  }

  function formatPhoneToE164(phone) {
    let clean = (phone || '').toString().trim().replace(/[\s\-\(\)]/g, '');
    if (clean.startsWith('+')) return clean;
    if (clean.length === 10) return '+91' + clean;
    if (clean.length > 10 && clean.startsWith('91')) return '+' + clean;
    return '+91' + clean;
  }

  function resetRecaptchaVerifier() {
    if (window._recaptchaVerifier) {
      try {
        window._recaptchaVerifier.clear();
      } catch (e) {}
      window._recaptchaVerifier = null;
    }
    const oldContainer = document.getElementById('recaptcha-container');
    if (oldContainer && oldContainer.parentNode) {
      const fresh = document.createElement('div');
      fresh.id = 'recaptcha-container';
      fresh.style.cssText = oldContainer.style.cssText;
      oldContainer.parentNode.replaceChild(fresh, oldContainer);
    }
  }

  function getRecaptchaVerifier(auth) {
    resetRecaptchaVerifier();

    let container = document.getElementById('recaptcha-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'recaptcha-container';
      document.body.appendChild(container);
    }

    try {
      window._recaptchaVerifier = new window.firebase.auth.RecaptchaVerifier(container, {
        size: 'invisible',
        callback: function () {
          // reCAPTCHA solved
        },
        'expired-callback': function () {
          resetRecaptchaVerifier();
        }
      }, auth.app);
    } catch (e) {
      resetRecaptchaVerifier();
      container = document.getElementById('recaptcha-container') || document.body;
      window._recaptchaVerifier = new window.firebase.auth.RecaptchaVerifier(container, {
        size: 'invisible',
        callback: function () {},
        'expired-callback': function () {
          resetRecaptchaVerifier();
        }
      }, auth.app);
    }

    return window._recaptchaVerifier;
  }

  /**
   * Sends 6-digit OTP code to the user's mobile number via Firebase Phone Auth (SMS)
   */
  async function requestOtp(phone) {
    try {
      const auth = await ensureFirebaseAuth();
      const formattedPhone = formatPhoneToE164(phone);
      const appVerifier = getRecaptchaVerifier(auth);

      const confirmationResult = await auth.signInWithPhoneNumber(formattedPhone, appVerifier);
      window._firebaseConfirmationResult = confirmationResult;
      return { ok: true, formattedPhone };
    } catch (err) {
      console.error('Firebase send OTP error:', err);
      resetRecaptchaVerifier();

      let msg = 'Could not send SMS verification code. Please try again.';
      const code = err && err.code ? err.code : '';
      if (code === 'auth/invalid-phone-number') {
        msg = 'Invalid mobile number. Please check your 10-digit number.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please wait a few minutes before trying again.';
      } else if (code === 'auth/quota-exceeded') {
        msg = 'Daily SMS quota reached. Please try again later or add phone numbers for testing in Firebase.';
      } else if (code === 'auth/operation-not-allowed') {
        msg = 'SMS verification is unavailable. Check that Firebase Phone sign-in is enabled and the SMS region policy allows India.';
      } else if (code === 'auth/billing-not-enabled') {
        msg = 'SMS verification requires billing to be enabled on the Firebase project. Use a configured fictional test number during development.';
      } else if (code === 'auth/unauthorized-domain' || code === 'auth/app-not-authorized') {
        msg = 'This website is not authorised for phone verification. Add the hosted website domain in Firebase Authentication settings and check API-key restrictions.';
      } else if (code === 'auth/captcha-check-failed') {
        if (['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname)) {
          msg = 'Real SMS verification is not supported on localhost. Test on an authorised HTTPS website, or use a fictional phone number configured for testing in Firebase.';
        } else {
          msg = 'Security verification failed: Please verify your domain in Firebase Console > Authentication > Settings > Authorized domains.';
        }
      } else if (code === 'auth/invalid-app-credential') {
        msg = 'Phone security verification failed. For real SMS, use an authorised HTTPS website and check Firebase billing, SMS region settings and browser blocking. For local development, use a fictional test number configured in Firebase; no SMS is sent to test numbers.';
      } else if (err && err.message) {
        msg = err.message;
      }
      return { ok: false, message: msg };
    }
  }

  /**
   * Verifies the 6-digit SMS OTP code using Firebase
   */
  async function verifyOtp(phone, otp) {
    try {
      if (!window._firebaseConfirmationResult) {
        return { ok: false, message: 'Verification session expired. Please request a new OTP.' };
      }
      const result = await window._firebaseConfirmationResult.confirm(otp);
      return { ok: true, user: result.user };
    } catch (err) {
      console.error('Firebase verify OTP error:', err);
      let msg = 'Invalid verification code. Please check the OTP and try again.';
      const code = err && err.code ? err.code : '';
      if (code === 'auth/invalid-verification-code') {
        msg = 'Incorrect 6-digit OTP. Please check the code received on your phone.';
      } else if (code === 'auth/code-expired') {
        msg = 'This code has expired. Please click "Resend OTP".';
      } else if (err && err.message) {
        msg = err.message;
      }
      return { ok: false, message: msg };
    }
  }

  window.editSignupPhoneNumber = function () {
    const pending = window._pendingOtpAuth;
    window.showEmailAuthStep('signup');
    const modal = document.getElementById('jobs-auth-modal') || document;
    if (pending) {
      if (modal.querySelector('#signup-name')) modal.querySelector('#signup-name').value = pending.name || '';
      if (modal.querySelector('#signup-email')) modal.querySelector('#signup-email').value = pending.email || '';
      if (modal.querySelector('#signup-phone')) {
        modal.querySelector('#signup-phone').value = pending.phone || '';
        modal.querySelector('#signup-phone').focus();
      }
    }
  };

  window.resendOtpCode = async function () {
    if (!window._pendingOtpAuth) return;
    window._pendingOtpAuth.verifiedUser = null;
    showOtpInlineMessage('Sending new verification code via SMS…', false);
    const result = await requestOtp(window._pendingOtpAuth.cleanPhone);
    if (!result.ok) {
      showOtpInlineMessage(result.message, true);
      return;
    }
    showOtpInlineMessage('✓ New verification code sent to your phone via SMS!', false);
    startOtpCountdown(30);
  };

  window.closeJobsAuthModal = function () {
    const modal = document.getElementById('jobs-auth-modal');
    if (modal) modal.style.display = 'none';
    window._pendingAuthRedirect = null;
    window._pendingAuthSection = null;
    window._pendingPdfDownload = null;
    window._pendingPdfName = null;
    window._pendingPdfCourse = null;
    if (otpCountdownTimer) {
      clearInterval(otpCountdownTimer);
      otpCountdownTimer = null;
    }
    resetRecaptchaVerifier();
    const msgEl = document.getElementById('auth-inline-msg');
    if (msgEl) msgEl.style.display = 'none';
    const otpMsg = document.getElementById('otp-inline-msg');
    if (otpMsg) otpMsg.style.display = 'none';
    const smsBanner = document.getElementById('simulated-sms-banner');
    if (smsBanner) smsBanner.style.display = 'none';
    const otpInput = document.getElementById('otp-code-input');
    if (otpInput) otpInput.value = '';
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';

    const heroTitle = document.getElementById('auth-modal-hero-title');
    const heroSub = document.getElementById('auth-modal-hero-sub');
    if (heroTitle) heroTitle.innerHTML = 'Find matching jobs you\'ll actually get <span style="color:#1947FF;">placed for.</span>';
    if (heroSub) heroSub.innerHTML = 'Free to start · no card needed';

    // Reset to Step 1 for next open
    window.showChoiceStep();
  };

  window.openAuthModal = function (mode = 'signup', redirectUrl = null, customText = null) {
    if (isUserLoggedIn()) {
      return;
    }
    ensureAuthModalDOM();
    const modal = document.getElementById('jobs-auth-modal');
    if (redirectUrl) window._pendingAuthRedirect = redirectUrl;

    const heroTitle = document.getElementById('auth-modal-hero-title');
    const heroSub = document.getElementById('auth-modal-hero-sub');
    if (customText && customText.title && heroTitle) {
      heroTitle.innerHTML = customText.title;
    } else if (heroTitle) {
      heroTitle.innerHTML = 'Find matching jobs you\'ll actually get <span style="color:#1947FF;">placed for.</span>';
    }

    if (customText && customText.sub && heroSub) {
      heroSub.innerHTML = customText.sub;
    } else if (heroSub) {
      heroSub.innerHTML = 'Free to start · no card needed';
    }

    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';

    if (mode === 'direct-email' || mode === 'direct-signup') {
      window.showEmailAuthStep('signup');
    } else if (mode === 'direct-login') {
      window.showEmailAuthStep('login');
    } else {
      // Default: show the clean NextRaise choice screen (Google & Email)
      window.showChoiceStep();
    }

    if (modal) modal.style.display = 'flex';
  };

  window.showDownloadSuccessToast = function (courseName) {
    let toast = document.getElementById('syllabus-download-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'syllabus-download-toast';
      toast.style.cssText = 'position:fixed; bottom:28px; right:28px; z-index:999999; background:#0F172A; color:#FFFFFF; padding:14px 22px; border-radius:12px; border:1px solid rgba(59,130,246,0.3); box-shadow:0 12px 30px rgba(0,0,0,0.4); font-size:14px; font-weight:600; display:flex; align-items:center; gap:10px; transform:translateY(80px); opacity:0; transition:all 0.3s cubic-bezier(0.16,1,0.3,1); font-family:inherit;';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span style="color:#34D399; font-size:18px;">✓</span> <span>Downloading <strong>${courseName}</strong> Syllabus PDF…</span>`;
    setTimeout(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; }, 50);
    setTimeout(() => { toast.style.transform = 'translateY(80px)'; toast.style.opacity = '0'; }, 4500);
  };

  window.downloadSyllabusWithAuth = function (event, pdfUrl, courseName) {
    if (event && event.preventDefault) event.preventDefault();
    pdfUrl = pdfUrl || 'KOMPETENZEN_FULLSTACK_.pdf';
    courseName = courseName || 'Course';

    const triggerDownload = (url, name) => {
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', name || url.split('/').pop() || 'Kompetenzen_Syllabus.pdf');
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    if (window.isUserLoggedIn && window.isUserLoggedIn()) {
      triggerDownload(pdfUrl, pdfUrl.split('/').pop());
      window.showDownloadSuccessToast(courseName);

      // Record lead in Supabase in background
      try {
        const u = (typeof getStoredUser === 'function' ? getStoredUser() : {}) || {};
        if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
          supabaseClient.from('course_enrollments').insert([{
            name: u.name || 'Candidate',
            email: u.email || '',
            phone: u.phone || '',
            enrolled_course: courseName + ' (Syllabus Download)',
            learning_mode: 'Syllabus Download',
            status: 'Syllabus Downloaded',
            page_url: window.location.href
          }]).then(() => {}).catch(() => {});
        }
      } catch (e) {}
      return;
    }

    // Save pending download and prompt signup
    window._pendingPdfDownload = pdfUrl;
    window._pendingPdfName = pdfUrl.split('/').pop();
    window._pendingPdfCourse = courseName;
    try {
      localStorage.setItem('kompetenzen_pending_pdf_download', pdfUrl);
      localStorage.setItem('kompetenzen_pending_pdf_name', pdfUrl.split('/').pop());
      localStorage.setItem('kompetenzen_pending_pdf_course', courseName);
    } catch (e) {}

    window.openAuthModal('signup', null, {
      title: `Download ${courseName} <span style="color:#1947FF;">Syllabus</span>`,
      sub: 'Sign up free to unlock & download the complete course syllabus & curriculum PDF'
    });
  };

  window.openResumeBuilder = function (e) {
    const RESUME_BUILDER_URL = 'Resume/resume.html';
    window.location.href = RESUME_BUILDER_URL;
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
    return !!(user && (user.email || user.name || user.phone));
  }

  window.isUserLoggedIn = isUserLoggedIn;
  window.getStoredUser = getStoredUser;

  // Browser storage that can hold another person's details on a shared
  // computer (college labs). The first two are legacy lists of every account
  // and enrollment ever used on this browser; they are no longer written and
  // are deleted on every page load. The rest are per-user and cleared on sign-out.
  const LEGACY_SHARED_KEYS = ['kompetenzen_registered_users', 'kompetenzen_enrollments'];
  const PER_USER_KEYS = [
    'token', 'access_token', 'kompetenzen_user', 'user', 'kompetenzen_google_user',
    'kompetenzen_candidate_profile', 'kompetenzen_last_auth_email',
    'kompetenzen_applied_jobs', 'kompetenzen_career_pass', 'kompetenzen_user_resume_name',
    'kompetenzen_pending_auth_redirect', 'kompetenzen_pending_auth_section'
  ];
  try { LEGACY_SHARED_KEYS.forEach(k => localStorage.removeItem(k)); } catch (e) {}

  function saveUnifiedSession(userData) {
    const token = localStorage.getItem('token') || ('kompetenzen_jwt_' + Math.random().toString(36).substring(2) + Date.now().toString(36));
    const userObj = {
      id: userData.id || ('user_' + Math.random().toString(36).substring(2, 10)),
      name: userData.name || 'Student / Candidate',
      email: (userData.email || '').toLowerCase(),
      phone: userData.phone || '',
      authType: userData.authType || 'Mobile OTP Verified',
      loginTime: new Date().toISOString()
    };

    localStorage.setItem('token', token);
    localStorage.setItem('kompetenzen_user', JSON.stringify(userObj));
    localStorage.setItem('user', JSON.stringify(userObj));
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userObj));
    if (userObj.email) {
      localStorage.setItem('kompetenzen_last_auth_email', userObj.email);
    }

    document.querySelectorAll('.logout-link').forEach(l => (l.style.display = 'inline-block'));

    return userObj;
  }

  function completeAuthSession(userData, redirectMsg = 'Logging in…') {
    saveUnifiedSession(userData);
    updateNavBadge();
    window.showAuthMessage(`✓ ${redirectMsg}`, false);

    // Ensure name & phone are directly saved into the public.profiles database table
    try {
      if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && userData && userData.id) {
        supabaseClient.from('profiles').upsert({
          id: userData.id,
          name: userData.name || '',
          phone: userData.phone || ''
        }).then(() => {}).catch(() => {});
      }
    } catch (e) {}

    setTimeout(() => {
      const redirect = window._pendingAuthRedirect;
      window._pendingAuthRedirect = null;
      const section = window._pendingAuthSection;
      window._pendingAuthSection = null;

      const pendingPdf = window._pendingPdfDownload || localStorage.getItem('kompetenzen_pending_pdf_download');
      const pendingPdfName = window._pendingPdfName || localStorage.getItem('kompetenzen_pending_pdf_name') || 'Kompetenzen_Syllabus.pdf';
      const pendingCourse = window._pendingPdfCourse || localStorage.getItem('kompetenzen_pending_pdf_course') || 'Course';

      window._pendingPdfDownload = null;
      window._pendingPdfName = null;
      window._pendingPdfCourse = null;
      try {
        localStorage.removeItem('kompetenzen_pending_pdf_download');
        localStorage.removeItem('kompetenzen_pending_pdf_name');
        localStorage.removeItem('kompetenzen_pending_pdf_course');
      } catch (e) {}

      if (pendingPdf) {
        window.closeJobsAuthModal();
        const a = document.createElement('a');
        a.href = pendingPdf;
        a.setAttribute('download', pendingPdfName);
        document.body.appendChild(a);
        a.click();
        a.remove();

        // Record download lead in Supabase database
        try {
          if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
            supabaseClient.from('course_enrollments').insert([{
              name: userData.name || 'Candidate',
              email: userData.email || '',
              phone: userData.phone || '',
              enrolled_course: pendingCourse + ' (Syllabus Download)',
              learning_mode: 'Syllabus Download',
              status: 'Syllabus Downloaded',
              page_url: window.location.href
            }]).then(() => {}).catch(() => {});
          }
        } catch (e) {}

        if (typeof window.showDownloadSuccessToast === 'function') {
          window.showDownloadSuccessToast(pendingCourse);
        }
        return;
      }

      if (redirect) {
        if (redirect.indexOf('http') === 0 && redirect.indexOf(window.location.host) === -1) {
          window.open(redirect, '_blank');
          window.closeJobsAuthModal();
        } else {
          try {
            const targetUrl = new URL(redirect, window.location.href);
            const currentUrl = new URL(window.location.href);
            if (targetUrl.pathname === currentUrl.pathname && targetUrl.searchParams.get('id') === currentUrl.searchParams.get('id')) {
              window.closeJobsAuthModal();
              updateNavBadge();
              if (typeof updateSidebarAuthState === 'function') updateSidebarAuthState();
              if (targetUrl.searchParams.get('apply') === '1' && typeof handleApplyButtonClick === 'function') {
                handleApplyButtonClick();
              }
              return;
            }
          } catch (e) {}
          window.location.href = redirect;
        }
      } else {
        window.closeJobsAuthModal();
      }
    }, 700);
  }

  window.handleSignupSubmit = async function (e) {
    e.preventDefault();
    // Scope to modal container to avoid reading from hardcoded duplicate-ID inputs
    // on pages like job-details.html that have their own signup form with the same IDs.
    const modal = document.getElementById('jobs-auth-modal') || document;
    const name = modal.querySelector('#signup-name')?.value.trim();
    const email = modal.querySelector('#signup-email')?.value.trim().toLowerCase();
    const phone = modal.querySelector('#signup-phone')?.value.trim();
    const password = modal.querySelector('#signup-password')?.value;
    const btn = modal.querySelector('#signup-submit-btn');

    if (!name || !email || !phone || !password) {
      window.showAuthMessage('Please fill in all required fields.', true);
      return;
    }

    // Validate everything Supabase will check before an SMS is paid for.
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (!/^(\+?91)?[6-9]\d{9}$/.test(cleanPhone)) {
      window.showAuthMessage('Please enter a valid 10-digit mobile number.', true);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      window.showAuthMessage('Please enter a valid email address.', true);
      return;
    }
    if (password.length < 6) {
      window.showAuthMessage('Password must be at least 6 characters.', true);
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending OTP SMS…';
    }

    const sent = await requestOtp(cleanPhone);

    if (!sent.ok) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Create Account →';
      }
      window.showAuthMessage(sent.message, true);
      return;
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Create Account →';
    }

    window._pendingOtpAuth = {
      mode: 'signup',
      name,
      email,
      phone,
      cleanPhone,
      formattedPhone: sent.formattedPhone,
      password
    };

    // Switch to Mobile Number OTP Verification View
    window.showOtpStep(sent.formattedPhone || phone, 'signup');
    startOtpCountdown(30);
  };

  window.handleOtpSubmit = async function (e) {
    e.preventDefault();
    const modal = document.getElementById('jobs-auth-modal') || document;
    const otpInput = modal.querySelector('#otp-code-input')?.value.trim();
    const submitBtn = modal.querySelector('#otp-submit-btn');

    const pending = window._pendingOtpAuth;
    if (!pending) {
      showOtpInlineMessage('Verification session expired. Please start again.', true);
      return;
    }
    if (!otpInput) {
      showOtpInlineMessage('Please enter the 6-digit code.', true);
      return;
    }

    const resetBtn = () => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify & Complete →';
      }
    };
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying Code…';
    }

    // Keep the verified Firebase user for a safe retry if account creation temporarily fails.
    const verified = pending.verifiedUser ? { ok: true, user: pending.verifiedUser } : await verifyOtp(pending.cleanPhone, otpInput);
    if (!verified.ok) {
      showOtpInlineMessage(verified.message || 'Please check your OTP and try again.', true);
      resetBtn();
      return;
    }
    pending.verifiedUser = verified.user;
    showOtpInlineMessage('Mobile verified. Finishing your account…', false);
    try {
      const token = await verified.user.getIdToken(true);
      const result = await supabasePhoneSignUp(pending.name, pending.email, pending.password, token);
      const user = result.session.user;
      window._pendingOtpAuth = null;
      try { await window.firebase.auth().signOut(); } catch (_) {}
      completeAuthSession({ id: user.id, name: user.user_metadata?.name || pending.name,
        email: user.email, phone: user.phone, authType: 'Mobile OTP Verified' }, 'Account created! You’re signed in.');
    } catch (error) {
      showOtpInlineMessage(error.message || 'Could not finish signup. Please try again.', true);
      resetBtn();
    }
  };

  window.handleLoginSubmit = async function (e) {
    e.preventDefault();
    const modal = document.getElementById('jobs-auth-modal') || document;
    const email = (modal.querySelector('#login-email')?.value || '').trim().toLowerCase();
    const password = modal.querySelector('#login-password')?.value || '';
    const btn = modal.querySelector('#login-submit-btn');

    if (!email || !password) {
      window.showAuthMessage('Please enter your email or mobile number and password.', true);
      return;
    }
    if (typeof supabaseSignIn !== 'function' || !isSupabaseConfigured()) {
      window.showAuthMessage('Log in is temporarily unavailable. Please try again shortly.', true);
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Logging in…';
    }
    try {
      const user = await supabaseSignIn(email, password);
      const sessionUser = await supabaseGetSessionUser();
      completeAuthSession({ ...user, id: sessionUser && sessionUser.id },
        `Welcome back${user.name && user.name !== email ? ', ' + user.name : ''}!`);
    } catch (err) {
      const msg = (err && err.message) || '';
      window.showAuthMessage(/email not confirmed/i.test(msg)
        ? 'Your email is not verified yet. Use your verified mobile number and password, or confirm your email.'
        : 'Incorrect email, mobile number or password.', true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Log In →';
      }
    }
  };

  window.authModalForgotPassword = async function () {
    const modal = document.getElementById('jobs-auth-modal') || document;
    const email = (modal.querySelector('#login-email')?.value || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      window.showAuthMessage('Enter your email address above, then click "Forgot password?".', true);
      return;
    }
    try {
      await supabaseResetPassword(email);
    } catch (e) {}
    // Same message either way, so the form does not reveal which emails have accounts.
    window.showAuthMessage(`If an account exists for ${email}, a password reset link has been sent.`, false);
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
      // Browser redirects to Google OAuth
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
      if (isUserLoggedIn()) {
        const pendingPdf = localStorage.getItem('kompetenzen_pending_pdf_download');
        if (pendingPdf) {
          const pendingPdfName = localStorage.getItem('kompetenzen_pending_pdf_name') || 'Kompetenzen_Syllabus.pdf';
          const pendingCourse = localStorage.getItem('kompetenzen_pending_pdf_course') || 'Course';
          localStorage.removeItem('kompetenzen_pending_pdf_download');
          localStorage.removeItem('kompetenzen_pending_pdf_name');
          localStorage.removeItem('kompetenzen_pending_pdf_course');
          const a = document.createElement('a');
          a.href = pendingPdf;
          a.setAttribute('download', pendingPdfName);
          document.body.appendChild(a);
          a.click();
          a.remove();
          if (typeof window.showDownloadSuccessToast === 'function') {
            window.showDownloadSuccessToast(pendingCourse);
          }
        }
        return;
      }
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
    if (isUserLoggedIn()) return;
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
    PER_USER_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (err) {} });
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
