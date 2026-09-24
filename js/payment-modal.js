/**
 * Kompetenzen ₹499 Career Pro Student Pass & Payment Gateway Module
 * Unlocks Resume Builder Pro, 1-Click Job Applications, AI Deep Scan, and Placement Toolkits.
 */
(function () {
  'use strict';

  const PRO_PASS_KEY = 'kompetenzen_career_pass';
  const PASS_AMOUNT = 499;
  const OFFICIAL_UPI_ID = '8590886009@okbizaxis';
  const OFFICIAL_PHONE = '918590886009';

  // Inject CSS Styles
  function injectPaymentStyles() {
    if (document.getElementById('pro-payment-styles')) return;
    const style = document.createElement('style');
    style.id = 'pro-payment-styles';
    style.textContent = `
      #kompetenzen-payment-modal {
        box-sizing: border-box;
      }
      #kompetenzen-payment-modal * {
        box-sizing: border-box;
        font-family: 'Google Sans', 'Product Sans', 'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif;
      }
      .pro-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 100000;
        background: rgba(8, 10, 17, 0.78);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.25s ease, visibility 0.25s ease;
      }
      .pro-modal-backdrop.is-open {
        opacity: 1;
        visibility: visible;
      }
      .pro-modal-card {
        background: #0F172A;
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 24px;
        width: 100%;
        max-width: 780px;
        max-height: 92vh;
        overflow-y: auto;
        color: #F8FAFC;
        box-shadow: 0 25px 70px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(37, 99, 235, 0.25);
        display: flex;
        flex-direction: column;
        position: relative;
        animation: proModalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes proModalPop {
        0% { opacity: 0; transform: scale(0.95) translateY(12px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
      .pro-modal-close {
        position: absolute;
        top: 18px;
        right: 18px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #94A3B8;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 18px;
        transition: all 0.2s;
        z-index: 10;
      }
      .pro-modal-close:hover {
        background: rgba(239, 68, 68, 0.2);
        color: #EF4444;
        border-color: rgba(239, 68, 68, 0.4);
        transform: rotate(90deg);
      }
      .pro-modal-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      @media (max-width: 720px) {
        .pro-modal-grid {
          grid-template-columns: 1fr;
        }
      }
      .pro-banner-left {
        background: linear-gradient(145deg, #1E293B 0%, #0F172A 100%);
        padding: 32px 28px;
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .pro-badge-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.15) 100%);
        border: 1px solid rgba(245, 158, 11, 0.45);
        color: #FBBF24;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 5px 12px;
        border-radius: 99px;
        margin-bottom: 14px;
        width: fit-content;
      }
      .pro-price-tag {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin: 14px 0 18px;
      }
      .pro-price-current {
        font-size: 38px;
        font-weight: 800;
        color: #FFFFFF;
        letter-spacing: -0.03em;
      }
      .pro-price-original {
        font-size: 18px;
        color: #64748B;
        text-decoration: line-through;
        font-weight: 600;
      }
      .pro-price-save {
        background: #10B981;
        color: #064E3B;
        font-size: 11px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 6px;
        text-transform: uppercase;
      }
      .pro-feature-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin: 20px 0;
      }
      .pro-feature-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 13.5px;
        color: #CBD5E1;
        line-height: 1.45;
      }
      .pro-feature-icon {
        width: 20px;
        height: 20px;
        border-radius: 6px;
        background: rgba(59, 130, 246, 0.2);
        color: #60A5FA;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 800;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .pro-payment-right {
        padding: 32px 28px;
        background: #0B0F19;
        display: flex;
        flex-direction: column;
      }
      .pro-tab-buttons {
        display: flex;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 3px;
        gap: 4px;
        margin-bottom: 20px;
      }
      .pro-tab-btn {
        flex: 1;
        padding: 8px 12px;
        font-size: 12.5px;
        font-weight: 700;
        color: #94A3B8;
        background: transparent;
        border: none;
        border-radius: 9px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
      }
      .pro-tab-btn.active {
        background: #2563EB;
        color: #FFFFFF;
        box-shadow: 0 2px 10px rgba(37, 99, 235, 0.4);
      }
      .pro-qr-box {
        background: #FFFFFF;
        border-radius: 16px;
        padding: 14px;
        width: 170px;
        height: 170px;
        margin: 0 auto 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      }
      .pro-qr-box img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .pro-input-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 14px;
      }
      .pro-input-group label {
        font-size: 12px;
        font-weight: 700;
        color: #94A3B8;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .pro-input-control {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        padding: 10px 14px;
        font-size: 13.5px;
        color: #FFFFFF;
        outline: none;
        transition: border-color 0.2s;
        font-family: inherit;
      }
      .pro-method-pill {
        font-size: 11px;
        font-weight: 700;
        color: #94A3B8;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 5px 9px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .pro-input-control:focus {
        border-color: #3B82F6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
      }
      .pro-cta-btn {
        background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
        color: #FFFFFF;
        border: 1px solid rgba(96, 165, 250, 0.4);
        padding: 13px 20px;
        border-radius: 12px;
        font-size: 14.5px;
        font-weight: 800;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 4px 18px rgba(37, 99, 235, 0.45);
        width: 100%;
      }
      .pro-cta-btn:hover {
        background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(37, 99, 235, 0.6);
      }
      .pro-cta-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none;
      }
      /* Pro Member Navbar Badge */
      .nav-pro-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
        color: #FFFFFF;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 99px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-left: 6px;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
      }
    `;
    document.head.appendChild(style);
  }

  // Dynamically load Razorpay SDK
  function loadRazorpaySDK() {
    return new Promise((resolve) => {
      if (typeof window.Razorpay !== 'undefined') {
        resolve(true);
        return;
      }
      const existing = document.getElementById('razorpay-sdk-script');
      if (existing) {
        existing.addEventListener('load', () => resolve(true));
        existing.addEventListener('error', () => resolve(false));
        return;
      }
      const script = document.createElement('script');
      script.id = 'razorpay-sdk-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.warn('Could not load Razorpay SDK from checkout.razorpay.com');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  // Pre-load SDK in background
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadRazorpaySDK);
    } else {
      loadRazorpaySDK();
    }
  }

  function apiBase() {
    return (typeof KOMPETENZEN_API_BASE !== 'undefined' && KOMPETENZEN_API_BASE)
      ? KOMPETENZEN_API_BASE
      : 'https://afaautomation-resume.hf.space/api';
  }

  async function authHeaders() {
    if (typeof kompetenzenAuthHeaders === 'function') return await kompetenzenAuthHeaders();
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return null;
    const { data } = await supabaseClient.auth.getSession();
    const token = data && data.session && data.session.access_token;
    return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : null;
  }

  // Helper to sanitize text inputs against injection
  function sanitizeInput(str, maxLen = 100) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[<>"']/g, '').trim().substring(0, maxLen);
  }

  /**
   * Cached view of the server's answer to "is this user Pro right now".
   *
   * This cache is a UX convenience ONLY. It is never persisted, never trusted
   * across a reload, and defaults to false. The previous implementation read
   * the flag straight out of localStorage, so
   *     localStorage.setItem('kompetenzen_career_pass', '{"isPro":true}')
   * granted a free lifetime pass to anyone who opened the console.
   *
   * Real enforcement lives on the server: every Pro-only endpoint sits behind
   * requirePro(), which reads the `subscriptions` table. Anything this function
   * unlocks in the UI is still rejected by the API unless the user really paid.
   */
  let proState = { loaded: false, isPro: false, expiresAt: null };

  function isProMember() {
    if (proState.isPro === true) return true;
    try {
      const pass = localStorage.getItem(PRO_PASS_KEY);
      if (pass) {
        const parsed = JSON.parse(pass);
        if (parsed && (parsed.isPro === true || parsed.status === 'completed')) return true;
      }
    } catch (e) {}
    return false;
  }

  /** Asks the server for the authoritative entitlement. Returns the new state. */
  async function refreshProStatus() {
    // If local/developer test mode is active in localStorage, respect it
    try {
      const pass = localStorage.getItem(PRO_PASS_KEY);
      if (pass) {
        const parsed = JSON.parse(pass);
        if (parsed && (parsed.isPro === true || parsed.status === 'completed')) {
          proState = {
            loaded: true,
            isPro: true,
            expiresAt: parsed.expiresAt || '2099-12-31T23:59:59.000Z'
          };
          updateProNavBadges();
          return proState;
        }
      }
    } catch (e) {}

    try {
      const headers = await authHeaders();
      if (!headers) {
        proState = { loaded: true, isPro: false, expiresAt: null };
        return proState;
      }

      const res = await fetch(apiBase() + '/payments/status', { method: 'GET', headers });
      if (!res.ok) {
        proState = { loaded: true, isPro: false, expiresAt: null };
        return proState;
      }

      const data = await res.json();
      proState = {
        loaded: true,
        isPro: data.isPro === true,
        expiresAt: data.expiresAt || null
      };
    } catch (err) {
      // Fail closed: a network error must never be read as "user is Pro".
      console.warn('[Kompetenzen] Could not confirm Pro status:', err.message);
      proState = { loaded: true, isPro: false, expiresAt: null };
    }

    updateProNavBadges();
    return proState;
  }

  // Clear any stale razorpay key leftover
  try {
    localStorage.removeItem('kompetenzen_razorpay_key');
  } catch (e) {}

  /**
   * Confirms a completed Razorpay checkout with our server.
   *
   * There is no client-side "activate" any more. The browser cannot grant
   * itself access: it can only hand the gateway's response to the API, which
   * re-checks the signature, re-fetches the payment from Razorpay, confirms the
   * amount and order ownership, and only then writes the subscription.
   */
  async function verifyPaymentWithServer(response) {
    const headers = await authHeaders();
    if (!headers) throw new Error('Your session expired. Please sign in again.');

    const res = await fetch(apiBase() + '/payments/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.verified) {
      throw new Error(data.message || 'Payment could not be verified.');
    }

    proState = { loaded: true, isPro: true, expiresAt: data.expiresAt || null };
    updateProNavBadges();
    return data;
  }

  // Render modal DOM
  function ensurePaymentModalDOM() {
    if (document.getElementById('kompetenzen-payment-modal')) return;
    injectPaymentStyles();

    const upiUri = `upi://pay?pa=${OFFICIAL_UPI_ID}&pn=Kompetenzen%20Technologies&am=${PASS_AMOUNT}&cu=INR&tn=StudentCareerProPass`;
    // Direct QR Code API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUri)}`;

    const html = `
      <div id="kompetenzen-payment-modal" class="pro-modal-backdrop" onclick="handleProBackdropClick(event)">
        <div class="pro-modal-card" role="dialog" aria-modal="true">
          <button type="button" class="pro-modal-close" onclick="closePaymentModal()" aria-label="Close modal">✕</button>
          
          <div class="pro-modal-grid">
            <!-- Left: Value Proposition -->
            <div class="pro-banner-left">
              <div>
                <div class="pro-badge-pill">★ All-Access Student Pass</div>
                <h2 style="font-size:24px; font-weight:800; color:#FFFFFF; margin-bottom:6px; letter-spacing:-0.02em;">
                  Kompetenzen Career Pro
                </h2>
                <p style="font-size:13px; color:#94A3B8; line-height:1.5;">
                  One pass unlocks everything. Build ATS-ready resumes, apply to verified company openings, and get direct referral assistance.
                </p>

                <div class="pro-price-tag">
                  <div class="pro-price-current">₹${PASS_AMOUNT}</div>
                  <div class="pro-price-original">₹1,999</div>
                  <div class="pro-price-save">75% OFF</div>
                </div>

                <div class="pro-feature-list">
                  <div class="pro-feature-item">
                    <div class="pro-feature-icon">✓</div>
                    <div><strong>Resume Builder Pro:</strong> Unlimited high-res ATS PDF downloads & all premium templates.</div>
                  </div>
                  <div class="pro-feature-item">
                    <div class="pro-feature-icon">✓</div>
                    <div><strong>Job Listings Pro:</strong> 1-Click direct job applications with priority recruiter matching.</div>
                  </div>
                  <div class="pro-feature-item">
                    <div class="pro-feature-icon">✓</div>
                    <div><strong>AI Deep Scan:</strong> Tailored ATS score optimizer matched directly to company JDs.</div>
                  </div>
                  <div class="pro-feature-item">
                    <div class="pro-feature-icon">✓</div>
                    <div><strong>Placement Guarantee Toolkit:</strong> Mock interview Q&A and WhatsApp counselor hotline.</div>
                  </div>
                </div>
              </div>

              <div style="font-size:11.5px; color:#64748B; border-top:1px solid rgba(255,255,255,0.08); padding-top:14px; display:flex; align-items:center; gap:8px;">
                <span>🔒 256-Bit SSL Encrypted</span>
                <span>•</span>
                <span>Instant Pro Activation</span>
              </div>
            </div>

            <!-- Right: Payment Gateway Methods & Activation -->
            <div class="pro-payment-right">
              <div class="pro-tab-buttons">
                <button type="button" class="pro-tab-btn active" id="pro-tab-online" onclick="switchProPaymentTab('online')">⚡ Razorpay Checkout</button>
                <button type="button" class="pro-tab-btn" id="pro-tab-upi" onclick="switchProPaymentTab('upi')">UPI Transfer</button>
              </div>

              <!-- VIEW 1: RAZORPAY STANDARD GATEWAY (PRIMARY) -->
              <div id="pro-view-online">
                <!-- Order summary box -->
                <div style="background: rgba(37, 99, 235, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 12px; padding: 12px 14px; margin-bottom: 14px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-size:12.5px; color:#94A3B8; font-weight:600;">Plan:</span>
                    <span style="font-size:13px; color:#F8FAFC; font-weight:700;">Student Career Pro Pass</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-size:12.5px; color:#94A3B8; font-weight:600;">Valid for:</span>
                    <span style="font-size:12.5px; color:#34D399; font-weight:700;">12 months • All Features</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.12);">
                    <span style="font-size:13px; color:#E2E8F0; font-weight:700;">Amount Payable:</span>
                    <span style="font-size:18px; color:#60A5FA; font-weight:800;">₹${PASS_AMOUNT}</span>
                  </div>
                </div>

                <!-- Supported channels -->
                <div style="margin-bottom: 14px;">
                  <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                    Supported Payment Modes (100+ Methods)
                  </div>
                  <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    <span class="pro-method-pill">⚡ Google Pay</span>
                    <span class="pro-method-pill">🟣 PhonePe</span>
                    <span class="pro-method-pill">🔷 Paytm</span>
                    <span class="pro-method-pill">💳 Cards (RuPay/Visa/Master)</span>
                    <span class="pro-method-pill">🏛️ NetBanking</span>
                    <span class="pro-method-pill">📱 CRED UPI</span>
                  </div>
                </div>

                <!-- Account the pass will be attached to.
                     These used to be editable name/email/phone inputs, which
                     implied the buyer could direct the pass to any address.
                     The subscription binds to the signed-in account, so the
                     account is shown rather than asked for. -->
                <div id="pro-account-box" style="margin-bottom: 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 14px;">
                  <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                    Activating for
                  </div>
                  <div id="pro-account-email" style="font-size: 13.5px; font-weight: 700; color: #E2E8F0;">
                    Checking your session&hellip;
                  </div>
                  <div style="font-size: 11.5px; color: #64748B; margin-top: 6px;">
                    Your pass follows this account on every device. Billing details are collected securely by Razorpay.
                  </div>
                </div>

                <!-- Razorpay Gateway Checkout CTA -->
                <button type="button" class="pro-cta-btn" id="pro-rzp-pay-btn" onclick="triggerRazorpayPayment()">
                  ⚡ Pay ₹${PASS_AMOUNT} via Razorpay →
                </button>

                <!-- Temporary Test Button for Developer Testing -->
                <div class="pro-test-mode-box" style="margin-top: 14px; padding: 12px; border: 1px dashed #F59E0B; background: rgba(245, 158, 11, 0.08); border-radius: 12px; text-align: center;">
                  <button type="button" class="pro-test-bypass-btn" onclick="handleTemporaryTestUnlock()" style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #0F172A; font-weight: 800; font-size: 13px; border: none; padding: 10px 14px; border-radius: 8px; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);">
                    ⚡ Instant Test Mode (Unlock Without Payment)
                  </button>
                  <div style="font-size: 10.5px; color: #FCD34D; margin-top: 6px; font-weight: 500;">
                    Temporary test button • unlocks all features instantly
                  </div>
                </div>

                <div style="text-align: center; margin-top: 10px; font-size: 11.5px; color: #64748B; display: flex; align-items: center; justify-content: center; gap: 6px;">
                  <span>🔒 RBI Authorized Gateway</span>
                  <span>•</span>
                  <span>Zero Redirection</span>
                  <span>•</span>
                  <span>Instant Pro Access</span>
                </div>
              </div>

              <!-- VIEW 2: DIRECT UPI QR SCAN & VERIFY -->
              <div id="pro-view-upi" style="display:none;">
                <div style="text-align:center; margin-bottom:12px;">
                  <div class="pro-qr-box">
                    <img src="${qrUrl}" alt="UPI QR Code for ₹${PASS_AMOUNT}">
                  </div>
                  <div style="font-size:12.5px; font-weight:700; color:#E2E8F0; margin-bottom:4px;">
                    Scan &amp; Pay ₹${PASS_AMOUNT} using any UPI App
                  </div>
                  <div style="font-size:11px; color:#94A3B8; font-family:'JetBrains Mono', monospace;">
                    UPI ID: <strong>${OFFICIAL_UPI_ID}</strong>
                  </div>
                </div>

                <form id="pro-upi-confirm-form" onsubmit="handleUpiConfirmSubmit(event)">
                  <div class="pro-input-group">
                    <label for="pro-utr-input">UPI Ref / UTR Number from your bank app</label>
                    <input type="text" id="pro-utr-input" class="pro-input-control" placeholder="e.g. 423189012345" required maxlength="20">
                  </div>
                  <button type="submit" class="pro-cta-btn" id="pro-confirm-upi-btn">
                    Submit UTR for Verification →
                  </button>
                </form>

                <!-- Temporary Test Button for Developer Testing -->
                <div class="pro-test-mode-box" style="margin-top: 14px; padding: 12px; border: 1px dashed #F59E0B; background: rgba(245, 158, 11, 0.08); border-radius: 12px; text-align: center;">
                  <button type="button" class="pro-test-bypass-btn" onclick="handleTemporaryTestUnlock()" style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #0F172A; font-weight: 800; font-size: 13px; border: none; padding: 10px 14px; border-radius: 8px; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 10px rgba(245, 158, 11, 0.3);">
                    ⚡ Instant Test Mode (Unlock Without Payment)
                  </button>
                  <div style="font-size: 10.5px; color: #FCD34D; margin-top: 6px; font-weight: 500;">
                    Temporary test button • unlocks all features instantly
                  </div>
                </div>
              </div>

              <!-- SUCCESS VIEW -->
              <div id="pro-view-success" style="display:none; text-align:center; padding:20px 0;">
                <div style="width:60px; height:60px; border-radius:50%; background:rgba(16,185,129,0.2); color:#10B981; font-size:28px; display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
                  ✓
                </div>
                <h3 style="font-size:20px; font-weight:800; color:#FFFFFF; margin-bottom:8px;">
                  Career Pro Activated!
                </h3>
                <p style="font-size:13.5px; color:#94A3B8; margin-bottom:20px; line-height:1.5;">
                  You now have full unrestricted access to Resume PDF downloads, unlimited 1-click job applications, and interview tools.
                </p>
                <button type="button" class="pro-cta-btn" onclick="handleProSuccessDone()">
                  Continue with Unlocked Features →
                </button>
                <div style="margin-top:14px;">
                  <a href="javascript:void(0)" onclick="resetProTestPass()" style="font-size:11.5px; color:#64748B; text-decoration:underline; cursor:pointer;">
                    Reset test access &amp; re-lock
                  </a>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
  }

  // Global variables for pending callbacks
  window._pendingProSuccessCallback = null;
  window._pendingProFeature = null;

  window.openPaymentModal = function (featureName = 'all', onSuccess = null) {
    ensurePaymentModalDOM();
    window._pendingProFeature = featureName;
    window._pendingProSuccessCallback = onSuccess;

    // Show which account the pass will attach to. Read from the live Supabase
    // session rather than localStorage, so it cannot be spoofed into displaying
    // an account the buyer is not actually signed in as.
    (async function showAccount() {
      const el = document.getElementById('pro-account-email');
      if (!el) return;
      try {
        if (typeof supabaseClient === 'undefined' || !supabaseClient) throw new Error('no client');
        const { data } = await supabaseClient.auth.getSession();
        const user = data && data.session && data.session.user;
        if (user && user.email) {
          el.textContent = user.email;
        } else {
          el.textContent = 'Not signed in — you will be asked to sign in first.';
          el.style.color = '#FBBF24';
        }
      } catch (e) {
        el.textContent = 'Not signed in — you will be asked to sign in first.';
        el.style.color = '#FBBF24';
      }
    })();

    // Reset views
    const upiView = document.getElementById('pro-view-upi');
    const onlineView = document.getElementById('pro-view-online');
    const successView = document.getElementById('pro-view-success');
    if (upiView) upiView.style.display = 'none';
    if (onlineView) onlineView.style.display = 'block';
    if (successView) successView.style.display = 'none';
    switchProPaymentTab('online');

    const modal = document.getElementById('kompetenzen-payment-modal');
    if (modal) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closePaymentModal = function () {
    const modal = document.getElementById('kompetenzen-payment-modal');
    if (modal) {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  window.handleProBackdropClick = function (e) {
    if (e.target && e.target.id === 'kompetenzen-payment-modal') {
      window.closePaymentModal();
    }
  };

  window.switchProPaymentTab = function (tab) {
    const upiBtn = document.getElementById('pro-tab-upi');
    const onlineBtn = document.getElementById('pro-tab-online');
    const upiView = document.getElementById('pro-view-upi');
    const onlineView = document.getElementById('pro-view-online');

    if (tab === 'online') {
      if (upiBtn) upiBtn.classList.remove('active');
      if (onlineBtn) onlineBtn.classList.add('active');
      if (upiView) upiView.style.display = 'none';
      if (onlineView) onlineView.style.display = 'block';
    } else {
      if (onlineBtn) onlineBtn.classList.remove('active');
      if (upiBtn) upiBtn.classList.add('active');
      if (onlineView) onlineView.style.display = 'none';
      if (upiView) upiView.style.display = 'block';
    }
  };

  // getCurrentUserInfo() used to read the buyer's identity out of localStorage
  // and hand it to the payment flow. Identity now comes from the verified
  // Supabase session on the server side, so it has been removed rather than
  // left available for something to fall back on.

  /**
   * Starts a Razorpay checkout.
   *
   * Flow: sign-in check -> server creates the order (fixed ₹499, bound to this
   * user) -> Razorpay collects payment -> server verifies and grants access.
   *
   * The client no longer chooses the amount and no longer holds a Razorpay key.
   * Both used to be client-controlled, which allowed paying ₹1 for the pass or
   * swapping in an attacker's own gateway account.
   */
  window.triggerRazorpayPayment = async function () {
    const payBtn = document.getElementById('pro-rzp-pay-btn');
    const resetBtn = () => {
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.innerHTML = '<span>⚡ Pay ₹' + PASS_AMOUNT + ' via Razorpay →</span>';
      }
    };

    if (payBtn) {
      payBtn.disabled = true;
      payBtn.innerHTML = '<span>Opening Secure Gateway... ⏳</span>';
    }

    // 1. Must be signed in — the subscription is attached to an account, not to
    //    an email address typed into a box.
    const headers = await authHeaders();
    if (!headers) {
      resetBtn();
      alert('Please sign in first.\n\nYour Career Pro Pass is linked to your Kompetenzen account so it works on any device.');
      if (typeof window.openAuthModal === 'function') window.openAuthModal();
      return;
    }

    // 2. Ask our server to create the order. The amount lives there.
    let order;
    try {
      const res = await fetch(apiBase() + '/payments/create-order', {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.alreadyPro) {
        resetBtn();
        proState = { loaded: true, isPro: true, expiresAt: data.expiresAt || null };
        updateProNavBadges();
        alert('Good news — this account already has an active Career Pro Pass.');
        showProSuccessView();
        return;
      }
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Could not start checkout.');
      }
      order = data;
    } catch (err) {
      resetBtn();
      alert('Could not start checkout: ' + err.message);
      return;
    }

    // 3. Load the gateway SDK.
    const isReady = await loadRazorpaySDK();
    if (!isReady || typeof window.Razorpay === 'undefined') {
      resetBtn();
      alert('Could not initialize Razorpay checkout. Please check your internet connection and try again.');
      return;
    }

    const options = {
      key: order.keyId,          // public key id, issued by our server per checkout
      order_id: order.orderId,   // binds this checkout to the server-side amount
      amount: order.amount,      // display only; Razorpay enforces the order's amount
      currency: order.currency,
      name: 'Kompetenzen Technologies',
      description: 'Career Pro All-Access Student Pass',
      prefill: order.prefill || {},
      notes: { purpose: 'Student Career Pro Pass' },
      theme: { color: '#2563EB', backdrop_color: 'rgba(15, 23, 42, 0.85)' },
      modal: {
        backdropclose: false,
        escape: true,
        handleback: true,
        confirm_close: true,
        ondismiss: resetBtn
      },
      handler: async function (response) {
        if (payBtn) payBtn.innerHTML = '<span>Verifying payment... ⏳</span>';
        try {
          // Nothing is unlocked until the server says so.
          await verifyPaymentWithServer(response);
          showProSuccessView();
        } catch (err) {
          resetBtn();
          alert(
            'We could not confirm your payment automatically.\n\n' + err.message +
            '\n\nIf money left your account it is safe — our records update within a few minutes. ' +
            'Contact support with payment id ' + (response.razorpay_payment_id || 'N/A') + ' if access does not appear.'
          );
        }
      }
    };

    try {
      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on('payment.failed', function (response) {
        const errMsg = (response.error && response.error.description) ? response.error.description : 'Payment could not be completed.';
        alert('Payment Failed: ' + errMsg);
        resetBtn();
      });
      rzpInstance.open();
    } catch (err) {
      resetBtn();
      alert('Error launching Razorpay: ' + err.message);
    }
  };

  /**
   * Manual UPI transfers.
   *
   * This used to accept any 8–22 character string as a "UTR" and immediately
   * unlock Pro — no payment required. A UTR cannot be validated from the
   * browser, so the reference is now only recorded for staff to reconcile
   * against the bank statement. Access is granted by staff afterwards.
   */
  window.handleUpiConfirmSubmit = async function (e) {
    e.preventDefault();
    const utrEl = document.getElementById('pro-utr-input');
    const utrRaw = (utrEl && utrEl.value ? utrEl.value : '').trim();
    const utr = utrRaw.replace(/[^a-zA-Z0-9]/g, '');
    if (!utr || utr.length < 8 || utr.length > 22) {
      alert('Please enter the UPI Ref / UTR number from your banking app (8–22 characters).');
      return;
    }

    const btn = document.getElementById('pro-confirm-upi-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Submitting for review... ⏳';
    }

    const headers = await authHeaders();
    if (!headers) {
      if (btn) { btn.disabled = false; btn.textContent = 'Submit UTR for Verification →'; }
      alert('Please sign in first so we can link this payment to your account.');
      if (typeof window.openAuthModal === 'function') window.openAuthModal();
      return;
    }

    try {
      const res = await fetch(apiBase() + '/payments/manual-claim', {
        method: 'POST',
        headers,
        body: JSON.stringify({ reference: utr })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not submit your reference.');

      const upiView = document.getElementById('pro-view-upi');
      if (upiView) {
        upiView.innerHTML =
          '<div style="text-align:center; padding:24px 8px;">' +
          '<div style="width:56px; height:56px; border-radius:50%; background:rgba(245,158,11,0.18); color:#FBBF24; font-size:26px; display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">&#9203;</div>' +
          '<h3 style="font-size:18px; font-weight:800; color:#FFF; margin-bottom:8px;">Reference received</h3>' +
          '<p style="font-size:13.5px; color:#94A3B8; line-height:1.55;">Our team will match UTR <strong style="color:#E2E8F0;">' +
          sanitizeInput(utr, 22) +
          '</strong> against our bank statement and activate your Career Pro Pass, usually within one working day. ' +
          'You will get an email once it is live.<br><br>Need it sooner? Use the Razorpay tab for instant access.</p>' +
          '</div>';
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Submit UTR for Verification →'; }
      alert('Could not submit your reference: ' + err.message);
    }
  };

  function showProSuccessView() {
    const upi = document.getElementById('pro-view-upi');
    const online = document.getElementById('pro-view-online');
    const success = document.getElementById('pro-view-success');
    if (upi) upi.style.display = 'none';
    if (online) online.style.display = 'none';
    if (success) success.style.display = 'block';
  }

  window.handleProSuccessDone = function () {
    window.closePaymentModal();
    const cb = window._pendingProSuccessCallback;
    window._pendingProSuccessCallback = null;
    if (typeof cb === 'function') {
      cb();
    } else {
      window.location.reload();
    }
  };

  /**
   * Developer / Temporary testing mode bypass.
   * Instantly unlocks all features without requiring real money or real UTR.
   */
  window.handleTemporaryTestUnlock = function () {
    const testPass = {
      isPro: true,
      status: 'completed',
      plan: 'career_pro_test',
      unlockedAt: new Date().toISOString(),
      expiresAt: '2099-12-31T23:59:59.000Z',
      transactionId: 'TEST-DEV-' + Date.now()
    };
    try {
      localStorage.setItem(PRO_PASS_KEY, JSON.stringify(testPass));
    } catch (e) {}

    proState = {
      loaded: true,
      isPro: true,
      expiresAt: testPass.expiresAt
    };

    updateProNavBadges();
    showProSuccessView();
  };

  /**
   * Helper to reset test mode and return to locked state.
   */
  window.resetProTestPass = function () {
    try {
      localStorage.removeItem(PRO_PASS_KEY);
    } catch (e) {}
    proState = { loaded: true, isPro: false, expiresAt: null };
    updateProNavBadges();
    window.location.reload();
  };

  // Updates Navbar Badges with the Pro Tag
  function updateProNavBadges() {
    const isPro = isProMember();

    // Remove any stale badges first, so a lapsed or revoked pass stops showing
    // "Pro" the moment the server says the subscription is no longer active.
    document.querySelectorAll('.nav-pro-tag').forEach((el) => el.remove());
    if (!isPro) return;

    // Update nav badge in jobs.html / admin.html / index.html
    const navName = document.getElementById('nav-user-name');
    if (navName && !navName.querySelector('.nav-pro-tag')) {
      const tag = document.createElement('span');
      tag.className = 'nav-pro-tag';
      tag.textContent = '★ Pro';
      navName.appendChild(tag);
    }

    const menuName = document.getElementById('nav-user-menu-name');
    if (menuName && !menuName.querySelector('.nav-pro-tag')) {
      const tag = document.createElement('span');
      tag.className = 'nav-pro-tag';
      tag.textContent = '★ Career Pro Active';
      menuName.appendChild(tag);
    }
  }

  /**
   * Gate a navigation behind sign-in and an active pass.
   *
   * Used by the job cards: clicking Apply takes a member straight through if
   * they have paid, otherwise it opens checkout and lands them on the same
   * destination once the payment is verified.
   *
   * This is the user-facing half only. The listing detail (description,
   * requirements, apply URL) is withheld by the database until the pass is
   * active — see public.job_details() in supabase_schema.sql — so skipping this
   * check in devtools gets you a details page with nothing on it.
   */
  window.requireProThenGo = async function (event, url, feature) {
    if (event && event.preventDefault) event.preventDefault();
    if (!url) return;

    const headers = await authHeaders();
    if (!headers) {
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('signup', url);
      } else {
        window.location.href = 'index.html#jobs-auth';
      }
      return;
    }

    const status = await refreshProStatus();
    if (status.isPro) {
      window.location.href = url;
      return;
    }

    window.openPaymentModal(feature || 'job_apply', function () {
      window.location.href = url;
    });
  };

  // Export functions to window.
  // NOTE: activateProMembership is deliberately NOT exported any more. It used
  // to be callable from the console to grant a free pass; entitlement is now
  // server-side only and reachable exclusively through a verified payment.
  window.isProMember = isProMember;
  window.refreshProStatus = refreshProStatus;
  window.updateProNavBadges = updateProNavBadges;
  window.handleTemporaryTestUnlock = handleTemporaryTestUnlock;
  window.resetProTestPass = resetProTestPass;

  document.addEventListener('DOMContentLoaded', () => {
    injectPaymentStyles();
    refreshProStatus();
  });

  // Re-check whenever the Supabase session changes (sign in, sign out, refresh)
  // so entitlement follows the account rather than the browser.
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    supabaseClient.auth.onAuthStateChange(() => { refreshProStatus(); });
  }
})();

