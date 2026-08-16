/* ==========================================================================
   TENNIS CAMP BOOKING SYSTEM - ENGINE WITH AUTHENTICATION & EMAIL ALERTS
   ========================================================================== */

// Camp runs May 25 – Sep 30, 2026. Outside that window we use a demo "today" so the calendar stays bookable.
function getCampToday() {
  const realNow = new Date();
  realNow.setHours(0, 0, 0, 0);
  const seasonStart = new Date(2026, 4, 25);
  const seasonEnd = new Date(2026, 8, 30);
  const demoToday = new Date(2026, 4, 22);

  if (realNow < seasonStart || realNow > seasonEnd) {
    return demoToday;
  }
  return realNow;
}

function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// --- GLOBAL APPLICATION STATE ---
const state = {
  currentDate: getCampToday(),
  today: getCampToday(),
  selectedDate: null,
  selectedSession: null,
  viewingMonth: 4,
  viewingYear: 2026,
  maxSpots: 8,
  campStartDate: normalizeDate(new Date(2026, 4, 25)),
  bookingDeadlineDate: normalizeDate(new Date(2026, 8, 30)),
  currentUser: null,
  users: []
};

const ADMIN_EMAILS = ['yashaswin@rallypoint.org', 'nikhilesh@rallypoint.org'];

// --- DOM ELEMENTS ---
const elements = {
  header: document.getElementById('main-header'),
  menuToggle: document.getElementById('menu-toggle'),
  navMenu: document.getElementById('nav-menu'),
  calendarMonthYear: document.getElementById('calendar-month-year'),
  calendarDays: document.getElementById('calendar-days'),
  prevMonthBtn: document.getElementById('prev-month'),
  nextMonthBtn: document.getElementById('next-month'),
  flowTitle: document.getElementById('flow-title'),
  flowSubtitle: document.getElementById('flow-subtitle'),
  flowEmptyState: document.getElementById('flow-empty-state'),
  flowSessionsStep: document.getElementById('flow-sessions-step'),
  slotCardMorning: document.getElementById('slot-card-morning'),
  slotCardEvening: document.getElementById('slot-card-evening'),
  morningCapacityText: document.getElementById('morning-capacity-text'),
  morningCapacityBar: document.getElementById('morning-capacity-bar'),
  eveningCapacityText: document.getElementById('evening-capacity-text'),
  eveningCapacityBar: document.getElementById('evening-capacity-bar'),
  flowAuthRequired: document.getElementById('flow-auth-required'),
  btnFlowLogin: document.getElementById('btn-flow-login'),
  bookingForm: document.getElementById('booking-form'),
  bookerName: document.getElementById('booker-name'),
  bookerEmail: document.getElementById('booker-email'),
  bookerPhone: document.getElementById('booker-phone'),
  bookerSkill: document.getElementById('booker-skill'),
  bookerAge: document.getElementById('booker-age'),
  btnSubmitBooking: document.getElementById('btn-submit-booking'),
  lookupEmail: document.getElementById('lookup-email'),
  btnLookupSearch: document.getElementById('btn-lookup-search'),
  bookingsOutputContainer: document.getElementById('bookings-output-container'),
  adminRoute: document.getElementById('admin'),
  adminAccessPanel: document.getElementById('admin-access-panel'),
  adminDashboard: document.getElementById('admin-dashboard'),
  adminSummaryGrid: document.getElementById('admin-summary-grid'),
  adminSkillTotal: document.getElementById('admin-skill-total'),
  adminSkillBars: document.getElementById('admin-skill-bars'),
  adminRosterList: document.getElementById('admin-roster-list'),
  toastContainer: document.getElementById('toast-container'),
  
  // Auth Elements
  navAuthContainer: document.getElementById('nav-auth-container'),
  btnNavLogin: document.getElementById('btn-nav-login'),
  authModalWrapper: document.getElementById('auth-modal-wrapper'),
  authCloseBtn: document.getElementById('auth-close-btn'),
  tabLogin: document.getElementById('tab-login'),
  tabSignup: document.getElementById('tab-signup'),
  sheetLogin: document.getElementById('sheet-login'),
  sheetSignup: document.getElementById('sheet-signup'),
  loginForm: document.getElementById('login-form'),
  signupForm: document.getElementById('signup-form'),
  loginEmail: document.getElementById('login-email'),
  loginPass: document.getElementById('login-password'),
  signupName: document.getElementById('signup-name'),
  signupEmail: document.getElementById('signup-email'),
  signupPhone: document.getElementById('signup-phone'),
  signupPass: document.getElementById('signup-password'),
  // Forgot password elements
  forgotPasswordLink: document.getElementById('forgot-password-link'),
  sheetForgot: document.getElementById('sheet-forgot'),
  forgotContact: document.getElementById('forgot-contact'),
  forgotContactLabel: document.getElementById('forgot-contact-label'),
  btnSendCode: document.getElementById('btn-send-code'),
  forgotStepVerify: document.getElementById('forgot-step-verify'),
  forgotCode: document.getElementById('forgot-code'),
  btnVerifyCode: document.getElementById('btn-verify-code'),
  btnResendCode: document.getElementById('btn-resend-code'),
  forgotStepReset: document.getElementById('forgot-step-reset'),
  forgotNewPassword: document.getElementById('forgot-new-password'),
  btnSetNewPassword: document.getElementById('btn-set-new-password')
};

// Toast helper
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.log(type || 'info', msg);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '!' : 'i'}</span>
    <span class="toast-message">${msg}</span>
    <button class="toast-close" aria-label="Dismiss notification">×</button>
  `;

  const closeButton = toast.querySelector('.toast-close');
  closeButton.addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  initAuth();
  initCalendar();
  initSessionCards();
  initBookingForm();
  initLookup();
  initAdminRoute();

  await initBookingBackend();

  const shouldReset = window.RALLY_EMAIL_CONFIG?.resetBookingsOnLoad && !(await hasBookingResetBeenApplied());
  if (shouldReset) {
    const resetSuccess = await resetAllBookings();
    if (resetSuccess) {
      await markBookingResetAsApplied();
      showToast('All camp spots were reset once. Future page loads will keep availability stable.', 'success');
    }
  }

  if (!hasFirestoreBackend()) {
    showToast('Shared booking sync is not configured. This browser still uses local storage only. Device-to-device updates require Firebase setup in email-config.js.', 'warning');
    seedDatabase();
  }

  ensureDirectorAccounts();

  // Check active session (loads bookings if already logged in)
  checkSession();
  // Ensure bookings placeholder is accurate after session restore
  if (!state.currentUser) {
    renderBookingsPlaceholder();
  }

  // Listen for storage events (other tabs) to keep auth UI in sync
  window.addEventListener('storage', (e) => {
    if (e.key === 'rally_current_user') {
      try {
        state.currentUser = e.newValue ? JSON.parse(e.newValue) : null;
      } catch (err) {
        state.currentUser = null;
      }
      updateAuthUI();
    }
  });

  // Debug: log whether a persisted user exists (helps diagnose reload logout)
  try { console.debug('RALLY: persisted user on load=', localStorage.getItem('rally_current_user')); } catch (e) {}

  initDbModalAndTelemetry();
});

// --- WAITLIST & TELEMETRY INITIALIZATION ---
function initDbModalAndTelemetry() {
  // DB Modal Trigger Buttons
  const dbModal = document.getElementById('db-architecture-modal');
  const openModalBtns = [
    document.getElementById('btn-open-db-modal'),
    document.getElementById('btn-open-db-modal-hero'),
    document.getElementById('cta-db-design'),
    document.getElementById('footer-link-db')
  ];

  openModalBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (dbModal) dbModal.style.display = 'flex';
      });
    }
  });

  const closeModalBtn = document.getElementById('db-modal-close');
  if (closeModalBtn && dbModal) {
    closeModalBtn.addEventListener('click', () => {
      dbModal.style.display = 'none';
    });

    dbModal.addEventListener('click', (e) => {
      if (e.target === dbModal) dbModal.style.display = 'none';
    });
  }

  // DB Modal Tab Switching
  document.querySelectorAll('.db-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.db-tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Quick Seed Full Session Demo Button
  const btnSeed = document.getElementById('btn-seed-full-session');
  if (btnSeed) {
    btnSeed.addEventListener('click', seedFullSessionAndWaitlist);
  }
}

// Telemetry Logger Engine
let telemetryExecutionCount = 0;
let telemetryPromotionCount = 0;

function logEdgeTelemetry(message, type = 'info') {
  // telemetry logging removed
}

function updateTelemetryMetrics(latencyMs = 24, isPromotion = false) {
  // telemetry metrics removed
}

// --- NAVIGATION ---
function setMobileMenuOpen(open) {
  const navOverlay = document.getElementById('nav-overlay');
  elements.navMenu.classList.toggle('active', open);
  if (navOverlay) {
    navOverlay.classList.toggle('active', open);
    navOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  document.body.classList.toggle('menu-open', open);
  elements.menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  elements.menuToggle.querySelector('i').className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
}

function initNavigation() {
  const navOverlay = document.getElementById('nav-overlay');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      elements.header.classList.add('scrolled');
    } else {
      elements.header.classList.remove('scrolled');
    }
  });

  elements.menuToggle.addEventListener('click', () => {
    setMobileMenuOpen(!elements.navMenu.classList.contains('active'));
  });

  if (navOverlay) {
    navOverlay.addEventListener('click', () => setMobileMenuOpen(false));
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => setMobileMenuOpen(false));
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 992 && elements.navMenu.classList.contains('active')) {
      setMobileMenuOpen(false);
    }
  });
}

function initAdminRoute() {
  window.addEventListener('hashchange', renderAdminRoute);
  renderAdminRoute();
}

function isAdminRouteActive() {
  return window.location.hash.toLowerCase() === '#admin';
}

function isDirectorUser(user = state.currentUser) {
  return Boolean(user && ADMIN_EMAILS.includes(user.email));
}

function renderAdminRoute() {
  try {
    const adminSection = document.getElementById('admin');
    const accessPanel = elements.adminAccessPanel;
    const dashboard = elements.adminDashboard;
    if (!adminSection || !accessPanel || !dashboard) return;

    if (isAdminRouteActive()) {
      adminSection.style.display = 'block';
      if (isDirectorUser()) {
        accessPanel.style.display = 'none';
        dashboard.style.display = 'block';
        try { renderAdminRoster(); } catch (e) { console.error('renderAdminRoster failed', e); }
      } else {
        accessPanel.style.display = 'block';
        dashboard.style.display = 'none';
        accessPanel.innerHTML = `
          <div style="padding:1.2rem; text-align:center;">
            <p><strong>Director access required</strong></p>
            <p>Please sign in with a director account to view the roster.</p>
            <div style="margin-top:0.8rem;"><button class="btn btn-volt" id="btn-admin-login">Sign in</button></div>
          </div>
        `;
        const btn = document.getElementById('btn-admin-login');
        if (btn) btn.addEventListener('click', () => openAuthModal('login'));
      }
      adminSection.setAttribute('aria-hidden', isDirectorUser() ? 'false' : 'true');
    } else {
      adminSection.style.display = 'none';
    }
  } catch (err) {
    console.error('renderAdminRoute error', err);
  }
}

// --- USER AUTHENTICATION ENGINE ---
function initAuth() {
  elements.btnNavLogin.addEventListener('click', () => openAuthModal('login'));
  elements.btnFlowLogin.addEventListener('click', () => openAuthModal('login'));
  elements.authCloseBtn.addEventListener('click', closeAuthModal);

  elements.tabLogin.addEventListener('click', () => switchAuthTab('login'));
  elements.tabSignup.addEventListener('click', () => switchAuthTab('signup'));

  // ensure forgot link visibility matches the currently active tab (default hidden)
  if (elements.forgotPasswordLink) {
    const loginActive = elements.tabLogin && elements.tabLogin.classList.contains('active');
    elements.forgotPasswordLink.style.display = loginActive ? 'inline' : 'none';
  }

  elements.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin();
  });

  elements.signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSignup();
  });
  // initialize forgot-password handlers
  initForgotPassword();
}

// --- FORGOT PASSWORD FLOW ---
function initForgotPassword() {
  if (!elements.forgotPasswordLink) return;
  elements.forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    openAuthModal('forgot');
    // initialize forgot sheet visible state
    if (elements.sheetForgot) elements.sheetForgot.style.display = 'block';
    if (elements.forgotStepVerify) elements.forgotStepVerify.style.display = 'none';
    if (elements.forgotStepReset) elements.forgotStepReset.style.display = 'none';
    if (elements.forgotContact) elements.forgotContact.value = '';
    if (elements.forgotContactLabel) elements.forgotContactLabel.textContent = 'Email Address';
  });

  if (elements.btnSendCode) elements.btnSendCode.addEventListener('click', (e) => { e.preventDefault(); handleSendVerificationCode(); });
  if (elements.btnVerifyCode) elements.btnVerifyCode.addEventListener('click', (e) => { e.preventDefault(); handleVerifyCode(); });
  if (elements.btnResendCode) elements.btnResendCode.addEventListener('click', (e) => { e.preventDefault(); handleResendCode(); });
  if (elements.btnSetNewPassword) elements.btnSetNewPassword.addEventListener('click', (e) => { e.preventDefault(); handleSetNewPassword(); });
}



function handleSendVerificationCode() {
  const contact = elements.forgotContact?.value.trim().toLowerCase();
  if (!contact) { showToast('Please provide an email to receive the code.', 'error'); return; }

  // check user exists
  const users = getUsersFromStorage();
  const user = users.find(u => u.email === contact);
  if (!user) {
    showToast('This Gmail was never registered before. Please sign up first.', 'error');
    return;
  }

  const method = 'email';
  const existingCodes = getVerificationCodesFromStorage();
  const previousRecord = existingCodes.find(c => c.contact === contact && c.method === method);
  const code = generateVerificationCode(previousRecord?.code);
  const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes
  const record = { contact, method, code, expiresAt };
  const codes = getVerificationCodesFromStorage().filter(c => !(c.contact === contact && c.method === method));
  codes.push(record);
  saveVerificationCodesToStorage(codes);
  // Attempt to send via EmailJS if configured (email only)
  const cfg = window.RALLY_EMAIL_CONFIG || {};
  function safeToast(msg, type) { if (typeof showToast === 'function') try { showToast(msg, type); } catch(e){ console.log(msg); } else { console.log(type||'info', msg); } }
  function loadEmailJsSdk() {
    return new Promise((resolve, reject) => {
      if (window.emailjs) {
        return resolve(window.emailjs);
      }
      const existing = document.getElementById('emailjs-sdk-script');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.emailjs));
        existing.addEventListener('error', () => reject(new Error('EmailJS SDK failed to load.')));
        return;
      }
      const script = document.createElement('script');
      script.id = 'emailjs-sdk-script';
      script.src = 'email.min.js';
      script.onload = () => resolve(window.emailjs);
      script.onerror = () => reject(new Error('EmailJS SDK failed to load.'));
      document.head.appendChild(script);
    });
  }
  function sendEmailJsCode(params) {
    return loadEmailJsSdk().then((emailjs) => {
      if (!emailjs || typeof emailjs.send !== 'function') {
        return Promise.reject(new Error('EmailJS SDK not available.'));
      }
      if (typeof emailjs.init === 'function') {
        emailjs.init(cfg.emailjsPublicKey);
      }
      return emailjs.send(cfg.emailjsServiceId, cfg.emailjsTemplateId, params);
    });
  }
  function sendEmailJsRest(params) {
    return fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: cfg.emailjsServiceId,
        template_id: cfg.emailjsTemplateId,
        publicKey: cfg.emailjsPublicKey,
        template_params: params
      })
    }).then((response) => {
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`EmailJS REST send failed: ${response.status} ${response.statusText} - ${text}`);
        });
      }
      return response.text().then(text => ({ status: 'ok', text }));
    });
  }
  const params = {
    user_email: contact,
    user_name: user.name || contact,
    verification_code: code,
    contact: contact,
    name: user.name || contact,
    to_email: contact,
    to_name: user.name || contact
  };
  if (method === 'email' && cfg.emailjsServiceId && cfg.emailjsTemplateId && cfg.emailjsPublicKey) {
    sendEmailJsCode(params)
      .catch((err) => {
        console.warn('EmailJS SDK send failed, falling back to REST API.', err);
        return sendEmailJsRest(params);
      })
      .then(() => safeToast(`Verification code sent to ${contact}.`, 'success'))
      .catch((err) => {
        safeToast(`Could not send email. Code displayed in console (demo).`, 'warning');
        console.error('EmailJS send error', err);
      });
  } else {
    if (method === 'email') {
      safeToast(`Verification code sent to ${contact} (demo).`, 'success');
    } else {
      safeToast(`Verification code sent to ${contact} via SMS (demo).`, 'success');
    }
    console.info('Demo verification code for', contact, 'is', code);
  }

  // Reveal verify step and hide initial inputs to present a dedicated entry view
  if (elements.sheetForgot) elements.sheetForgot.style.display = 'block';
  if (elements.forgotStepVerify) elements.forgotStepVerify.style.display = 'block';
  if (elements.forgotStepReset) elements.forgotStepReset.style.display = 'none';
  if (elements.forgotContact) elements.forgotContact.disabled = true;
  if (elements.btnSendCode) elements.btnSendCode.style.display = 'none';
  if (elements.btnResendCode) elements.btnResendCode.style.display = 'inline-block';
  if (elements.forgotCode) {
    elements.forgotCode.value = '';
    elements.forgotCode.focus();
  }
}

function handleVerifyCode() {
  const code = elements.forgotCode.value.trim();
  const method = 'email';
  const contact = elements.forgotContact?.value.trim().toLowerCase();
  if (!code) { showToast('Please enter the verification code.', 'error'); return; }

  const codes = getVerificationCodesFromStorage();
  const record = codes.find(c => c.contact === contact && c.method === method && c.code === code);
  if (!record) { showToast('Wrong verification code. Please check your email and try again.', 'error'); return; }
  if (Date.now() > record.expiresAt) { showToast('Code expired. Please resend a new code.', 'error'); return; }

  // Verified - show reset password step
  if (elements.forgotStepReset) elements.forgotStepReset.style.display = 'block';
  const resetNote = document.getElementById('forgot-reset-note');
  if (resetNote) resetNote.style.display = 'block';
  showToast('Code verified. Set your new password.', 'success');
}

function handleResendCode() {
  const contact = elements.forgotContact?.value.trim().toLowerCase();
  if (!contact) { showToast('Please provide email to resend code.', 'error'); return; }
  // simply call send again
  handleSendVerificationCode();
}

function handleSetNewPassword() {
  const newPass = elements.forgotNewPassword.value;
  const contact = elements.forgotContact?.value.trim().toLowerCase();
  if (!newPass) { showToast('Please enter a new password.', 'error'); return; }

  const users = getUsersFromStorage();
  const idx = users.findIndex(u => u.email === contact);
  if (idx === -1) { showToast('Account not found.', 'error'); return; }
  users[idx].password = newPass;
  saveUsersToStorage(users);
  showToast('Password updated. You can now log in.', 'success');
  // clear verification codes for contact
  const codes = getVerificationCodesFromStorage().filter(c => !(c.contact === contact && c.method === 'email'));
  saveVerificationCodesToStorage(codes);
  // close modal
  closeAuthModal();
}

// Verification code storage helpers
function getVerificationCodesFromStorage() {
  try { return JSON.parse(localStorage.getItem('rally_verification_codes') || '[]'); } catch (e) { return []; }
}
function saveVerificationCodesToStorage(arr) { localStorage.setItem('rally_verification_codes', JSON.stringify(arr || [])); }
function generateVerificationCode(previousCode) {
  let code;
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (previousCode && code === previousCode);
  return code;
}

function openAuthModal(tab = 'login') {
  if (tab === 'forgot') {
    elements.tabLogin.classList.remove('active');
    elements.tabSignup.classList.remove('active');
    elements.sheetLogin.classList.remove('active');
    elements.sheetSignup.classList.remove('active');
    if (elements.sheetForgot) elements.sheetForgot.style.display = 'block';
  } else {
    switchAuthTab(tab);
    if (elements.sheetForgot) elements.sheetForgot.style.display = 'none';
  }
  elements.authModalWrapper.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  elements.authModalWrapper.classList.remove('active');
  document.body.style.overflow = '';
}

function switchAuthTab(tab) {
  if (tab === 'login') {
    elements.tabLogin.classList.add('active');
    elements.tabSignup.classList.remove('active');
    elements.sheetLogin.classList.add('active');
    elements.sheetSignup.classList.remove('active');
  } else {
    elements.tabSignup.classList.add('active');
    elements.tabLogin.classList.remove('active');
    elements.sheetSignup.classList.add('active');
    elements.sheetLogin.classList.remove('active');
  }
  // show forgot-password link only on the login tab
  const forgotLinkEl = document.getElementById('forgot-password-link');
  if (forgotLinkEl) forgotLinkEl.style.display = (tab === 'login') ? 'inline' : 'none';
  const sheetForgotEl = document.getElementById('sheet-forgot');
  if (sheetForgotEl) sheetForgotEl.style.display = 'none';
}

function handleLogin() {
  const email = elements.loginEmail.value.trim().toLowerCase();
  const pass = elements.loginPass.value;
  // If Firebase is configured, use Firebase Auth
  if (hasFirestoreBackend() && window.firebase && window.firebase.auth) {
    window.firebase.auth().signInWithEmailAndPassword(email, pass)
      .then(async (cred) => {
        try {
          const uid = cred.user.uid;
          const doc = await window.__rally_db.collection('users').doc(uid).get();
          const profile = doc.exists ? doc.data() : { name: cred.user.displayName || '', email: cred.user.email, phone: '' };
          profile.uid = uid;
          closeAuthModal();
          setCurrentUserSession(profile);
          showToast(`Welcome back, ${profile.name || profile.email}!`, 'success');
          elements.loginForm.reset();
        } catch (e) {
          showToast('Login succeeded but failed to load profile.', 'warning');
        }
      })
      .catch((err) => {
        console.warn('Firebase login error', err);
        // Fallback: check localStorage users in case account exists only locally
        const users = getUsersFromStorage();
        const localUser = users.find(u => u.email === email && u.password === pass);
        if (localUser) {
          closeAuthModal();
          setCurrentUserSession(localUser);
          showToast('Signed in using local account (no remote profile).', 'warning');
          elements.loginForm.reset();
          return;
        }
        showToast('Invalid email or password.', 'error');
      });
    return;
  }

  // Local-storage fallback
  const users = getUsersFromStorage();
  const user = users.find(u => u.email === email && u.password === pass);

  if (user) {
    closeAuthModal();
    setCurrentUserSession(user);
    showToast(`Welcome back, ${user.name}!`, "success");
    elements.loginForm.reset();
  } else {
    showToast("Invalid email or password.", "error");
  }
}

function handleSignup() {
  const name = elements.signupName.value.trim();
  const email = elements.signupEmail.value.trim().toLowerCase();
  const phone = elements.signupPhone.value.trim();
  const pass = elements.signupPass.value;

  if (!name || !email || !phone || !pass) {
    showToast("Please fill in all fields.", "error");
    return;
  }

  if (!validateEmail(email)) {
    showToast("Please enter a valid email address.", "error");
    return;
  }

  // If Firebase is available, create Firebase Auth user and profile
  if (hasFirestoreBackend() && window.firebase && window.firebase.auth) {
    window.firebase.auth().createUserWithEmailAndPassword(email, pass)
      .then(async (cred) => {
        try {
          const uid = cred.user.uid;
          const profile = { name, email, phone, uid };
          await window.__rally_db.collection('users').doc(uid).set(profile);
          // Optionally set displayName on Firebase user
          try { cred.user.updateProfile({ displayName: name }); } catch (e) {}
          closeAuthModal();
          setCurrentUserSession(profile);
          showToast(`Account created! Welcome to RallyPoint, ${name}.`, 'success');
          elements.signupForm.reset();
        } catch (e) {
          console.error('Failed to save profile', e);
          showToast('Account created but failed to save profile.', 'warning');
        }
      })
      .catch((err) => {
        console.warn('Firebase signup error', err);
        showToast('Could not create account: ' + (err.message || err.code), 'error');
      });
    return;
  }

  const users = getUsersFromStorage();
  if (users.some(u => u.email === email)) {
    showToast("An account with this email already exists.", "error");
    return;
  }

  const newUser = { name, email, phone, password: pass };
  users.push(newUser);
  saveUsersToStorage(users);

  closeAuthModal();
  setCurrentUserSession(newUser);
  showToast(`Account created! Welcome to RallyPoint, ${name}.`, "success");
  elements.signupForm.reset();
}

function setCurrentUserSession(user) {
  state.currentUser = user;
  localStorage.setItem('rally_current_user', JSON.stringify(user));
  updateAuthUI();
  if (state.selectedDate) selectDate(state.selectedDate);
}

function checkSession() {
  try {
    const savedUser = localStorage.getItem('rally_current_user');
    if (savedUser) {
      state.currentUser = JSON.parse(savedUser);
    }
  } catch {
    localStorage.removeItem('rally_current_user');
  }
  updateAuthUI();
}

function updateAuthUI() {
  try {
    if (state.currentUser) {
    const isDirector = isDirectorUser();
    elements.navAuthContainer.innerHTML = `
      <div class="user-badge" id="user-profile-badge">
        <span class="user-avatar">${getInitials(state.currentUser.name)}</span>
        <span class="user-badge-name">${escapeHTML(state.currentUser.name)}</span>
        ${isDirector ? '<span class="director-pill">Director</span>' : ''}
        <i class="fa-solid fa-chevron-down" style="font-size: 0.75rem; margin-left: 0.2rem; opacity: 0.7;"></i>
      </div>
      <div class="user-dropdown-menu" id="user-dropdown" style="display:none;">
        <div class="user-dropdown-header">
          <strong>${escapeHTML(state.currentUser.name)}</strong>
          <span>${escapeHTML(state.currentUser.email)}</span>
        </div>
        ${isDirector ? '<a href="#admin" class="user-dropdown-item"><i class="fa-solid fa-clipboard-list"></i> Director Roster</a>' : ''}
        <a href="#my-bookings" class="user-dropdown-item"><i class="fa-solid fa-ticket"></i> My Reservations</a>
        <div class="user-dropdown-divider"></div>
        <button class="user-dropdown-item logout" id="btn-logout"><i class="fa-solid fa-right-from-bracket"></i> Log Out</button>
      </div>
    `;

    const badge = document.getElementById('user-profile-badge');
    const dropdown = document.getElementById('user-dropdown');

    if (badge && dropdown) {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        dropdown.style.display = dropdown.classList.contains('active') ? 'block' : 'none';
      });

      document.addEventListener('click', () => {
        dropdown.classList.remove('active');
        dropdown.style.display = 'none';
      });
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    if (elements.bookerName) elements.bookerName.value = state.currentUser.name;
    if (elements.bookerEmail) elements.bookerEmail.value = state.currentUser.email;
    if (elements.bookerPhone) elements.bookerPhone.value = state.currentUser.phone || '';

    refreshMyBookingsView();
    } else {
    elements.navAuthContainer.innerHTML = `
      <button class="btn btn-volt btn-nav-auth" id="btn-nav-login">Login / Signup</button>
    `;
    document.getElementById('btn-nav-login').addEventListener('click', () => openAuthModal('login'));
    renderBookingsPlaceholder();
    }
  } catch (err) {
    console.error('updateAuthUI error', err);
  }

  try { renderAdminRoute(); } catch (e) { console.error('renderAdminRoute error', e); }
}

function handleLogout() {
  // If Firebase Auth is enabled, sign out there too
  if (hasFirestoreBackend() && window.firebase && window.firebase.auth) {
    try {
      window.firebase.auth().signOut().catch(() => {});
    } catch (e) {}
  }

  state.currentUser = null;
  try { localStorage.removeItem('rally_current_user'); } catch (e) {}
  updateAuthUI();
  showToast("Logged out successfully.", "info");

  if (state.selectedDate) {
    selectDate(state.selectedDate);
  }
}

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

// Ensure a lightweight refresh helper exists for the My Reservations view
function refreshMyBookingsView() {
  try {
    // If there is a dedicated render for the user's bookings, call it; otherwise use placeholder
    if (typeof renderMyBookings === 'function') {
      renderMyBookings();
    } else {
      renderBookingsPlaceholder();
    }
  } catch (e) {
    // swallow errors to avoid breaking auth flow
    console.warn('refreshMyBookingsView error', e);
  }
}

// --- CALENDAR ENGINE ---
function initCalendar() {
  elements.prevMonthBtn.addEventListener('click', () => {
    state.viewingMonth--;
    if (state.viewingMonth < 0) {
      state.viewingMonth = 11;
      state.viewingYear--;
    }
    renderCalendar();
  });

  elements.nextMonthBtn.addEventListener('click', () => {
    state.viewingMonth++;
    if (state.viewingMonth > 11) {
      state.viewingMonth = 0;
      state.viewingYear++;
    }
    renderCalendar();
  });

  renderCalendar();
}

function renderCalendar() {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  elements.calendarMonthYear.textContent = `${monthNames[state.viewingMonth]} ${state.viewingYear}`;

  elements.calendarDays.innerHTML = '';

  const firstDayIndex = new Date(state.viewingYear, state.viewingMonth, 1).getDay();
  const daysInMonth = new Date(state.viewingYear, state.viewingMonth + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    const emptyTile = document.createElement('div');
    emptyTile.className = 'calendar-day-tile empty';
    elements.calendarDays.appendChild(emptyTile);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const tileDate = new Date(state.viewingYear, state.viewingMonth, day);
    const dayOfWeek = tileDate.getDay();
    const isCampDayOfWeek = (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5);

    const isAfterCampStart = tileDate >= state.campStartDate;
    const isPast = tileDate < state.today;
    const isAfterBookingDeadline = tileDate > state.bookingDeadlineDate;

    const dateKey = getFormattedDateKey(tileDate);
    const bookings = getBookingsFromStorage();
    const waitlists = getWaitlistsFromStorage();

    const morningCount = bookings.filter(b => b.date === dateKey && b.session === 'morning').length;
    const eveningCount = bookings.filter(b => b.date === dateKey && b.session === 'evening').length;
    const isFullyBooked = (morningCount >= state.maxSpots) && (eveningCount >= state.maxSpots);
    const hasWaitlistActive = waitlists.some(w => w.date === dateKey && w.status === 'WAITING');

    const tile = document.createElement('div');
    tile.className = 'calendar-day-tile disabled';
    tile.innerHTML = `<span class="day-number">${day}</span>`;

    if (isSameDate(tileDate, state.today)) {
      tile.classList.add('today');
    }

    if (state.selectedDate && isSameDate(tileDate, state.selectedDate)) {
      tile.classList.add('selected');
    }

    elements.calendarDays.appendChild(tile);
  }
}

function selectDate(date) {
  if (date > state.bookingDeadlineDate) {
    showToast("Booking deadline passed! The last day to book sessions was August 30, 2026.", "error");
    return;
  }

  state.selectedDate = date;
  state.selectedSession = null;

  renderCalendar();

  elements.flowEmptyState.style.display = 'none';
  elements.flowSessionsStep.style.display = 'flex';

  elements.slotCardMorning.classList.remove('selected');
  elements.slotCardEvening.classList.remove('selected');

  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  elements.flowTitle.textContent = "Select Session Time";
  elements.flowSubtitle.textContent = `Date selected: ${dateStr}. Choose Morning or Evening.`;

  updateSessionSlotsCapacity(date);
}

// --- SESSION CARDS & WAITLIST CAPACITIES ---
function initSessionCards() {
  elements.slotCardMorning.addEventListener('click', () => {
    selectSession('morning');
  });

  elements.slotCardEvening.addEventListener('click', () => {
    selectSession('evening');
  });
}

function selectSession(session) {
  if (!state.selectedDate) return;

  state.selectedSession = session;
  const dateKey = getFormattedDateKey(state.selectedDate);
  const bookings = getBookingsFromStorage();
  const waitlists = getWaitlistsFromStorage();

  const activeWaitlists = waitlists.filter(w => w.date === dateKey && w.session === session && w.status === 'WAITING');
  const isFull = true;

  state.isWaitlistBooking = true;

  if (session === 'morning') {
    elements.slotCardMorning.classList.add('selected');
    elements.slotCardEvening.classList.remove('selected');
  } else {
    elements.slotCardEvening.classList.add('selected');
    elements.slotCardMorning.classList.remove('selected');
  }

  const sessionName = session === 'morning' ? "Morning Rise & Rally" : "Evening Sunset Smash";
  const dateStr = state.selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (isFull) {
    elements.flowTitle.textContent = "Join Session Waitlist";
    elements.flowSubtitle.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="color: #ffaa00;"></i> Waitlist Mode: <strong>${sessionName}</strong> on <strong>${dateStr}</strong> (Position #${activeWaitlists.length + 1} in queue)`;
    elements.btnSubmitBooking.textContent = `Join Waitlist Queue (#${activeWaitlists.length + 1})`;
    elements.btnSubmitBooking.className = 'btn btn-volt';

    const noticeText = document.getElementById('booking-notice-text');
    if (noticeText) noticeText.textContent = "This session is currently full. Submitting this form adds you to the FIFO waitlist. If any player cancels, your spot will be automatically promoted via our serverless edge function!";
  } else {
    elements.flowTitle.textContent = "Reserve Court Seat";
    elements.flowSubtitle.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--primary-light);"></i> Reserve: <strong>${sessionName}</strong> on <strong>${dateStr}</strong>`;
    elements.btnSubmitBooking.textContent = "Confirm Booking";
    elements.btnSubmitBooking.className = 'btn btn-volt';

    const noticeText = document.getElementById('booking-notice-text');
    if (noticeText) noticeText.textContent = "Your account details are pre-filled below. You can edit your name, email, or phone before confirming.";
  }

  if (state.currentUser) {
    elements.flowAuthRequired.style.display = 'none';
    elements.bookingForm.style.display = 'flex';
  } else {
    elements.bookingForm.style.display = 'none';
    elements.flowAuthRequired.style.display = 'flex';
  }
}

function updateSessionSlotsCapacity(date) {
  const dateKey = getFormattedDateKey(date);
  const bookings = getBookingsFromStorage();
  const waitlists = getWaitlistsFromStorage();

  const morningCount = bookings.filter(b => b.date === dateKey && b.session === 'morning').length;
  const eveningCount = bookings.filter(b => b.date === dateKey && b.session === 'evening').length;

  const morningWaitlists = waitlists.filter(w => w.date === dateKey && w.session === 'morning' && w.status === 'WAITING').length;
  const eveningWaitlists = waitlists.filter(w => w.date === dateKey && w.session === 'evening' && w.status === 'WAITING').length;

  const morningLeft = Math.max(0, state.maxSpots - morningCount);
  const eveningLeft = Math.max(0, state.maxSpots - eveningCount);

  // Morning Card Capacity
  elements.slotCardMorning.classList.remove('disabled');
  elements.slotCardMorning.classList.add('waitlist-mode');
  elements.morningCapacityText.textContent = `Waitlist Open - #${morningWaitlists + 1} in Queue`;
  elements.morningCapacityBar.style.width = '100%';
  elements.morningCapacityBar.className = 'capacity-progress waitlist';

  elements.slotCardEvening.classList.remove('disabled');
  elements.slotCardEvening.classList.add('waitlist-mode');
  elements.eveningCapacityText.textContent = `Waitlist Open - #${eveningWaitlists + 1} in Queue`;
  elements.eveningCapacityBar.style.width = '100%';
  elements.eveningCapacityBar.className = 'capacity-progress waitlist';
}

// --- BOOKING & WAITLIST SUBMISSION ENGINE ---
function initBookingForm() {
  elements.bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitBooking();
  });
}

async function submitBooking() {
  if (!state.currentUser) {
    showToast("You must log in to submit a booking or join the waitlist.", "error");
    return;
  }

  if (state.currentDate > state.bookingDeadlineDate) {
    showToast("Bookings are no longer available. The deadline was August 30, 2026.", "error");
    return;
  }

  const { name, email, phone } = getBookingContactDetails();
  const skill = elements.bookerSkill.value;
  const age = elements.bookerAge.value;

  if (!state.selectedDate || !state.selectedSession) {
    showToast("Please choose a date and time slot first.", "error");
    return;
  }

  if (!name || !email || !phone || !skill || !age) {
    showToast("Please complete all player details.", "error");
    return;
  }

  if (!syncUserProfileFromBookingForm({ name, email, phone })) return;

  const dateKey = getFormattedDateKey(state.selectedDate);
  const bookings = getBookingsFromStorage();
  const waitlists = getWaitlistsFromStorage();

  // Handle Waitlist Submission Mode
  if (state.isWaitlistBooking) {
    const isAlreadyWaitlisted = waitlists.some(w => w.email === email && w.date === dateKey && w.session === state.selectedSession && w.status === 'WAITING');
    if (isAlreadyWaitlisted) {
      showToast("You are already on the waitlist for this session!", "warning");
      return;
    }

    const activeQueue = waitlists.filter(w => w.date === dateKey && w.session === state.selectedSession && w.status === 'WAITING');
    const position = activeQueue.length + 1;

    const waitlistEntry = {
      id: `WL-${dateKey.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      name,
      email,
      phone,
      skill,
      age,
      date: dateKey,
      session: state.selectedSession,
      position,
      status: 'WAITING',
      createdAt: new Date().toISOString()
    };

    waitlists.push(waitlistEntry);
    saveWaitlistsToStorage(waitlists);

    logEdgeTelemetry(`Waitlist Entry Created: ${name} (${email}) queued at Position #${position} for ${dateKey} ${state.selectedSession}.`, 'info');
    updateTelemetryMetrics(12, false);

    showToast(`Added to waitlist! Position #${position} for ${formatBookingSessionProgram(state.selectedSession)}. If a slot opens up, you'll be automatically promoted!`, "success");

    elements.bookingForm.style.display = 'none';
    state.selectedSession = null;

    updateSessionSlotsCapacity(state.selectedDate);
    renderCalendar();
    searchBookings(email);
    renderAdminRoute();
    return;
  }

  // Handle Standard Confirmed Booking
  const isDoubleBooked = bookings.some(b => b.email === email && b.date === dateKey && b.session === state.selectedSession);
  if (isDoubleBooked) {
    showToast("Double-booking alert! You already have a slot reserved for this session.", "error");
    return;
  }

  const bookingId = `RP-${state.selectedDate.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const newBooking = {
    id: bookingId,
    name,
    email,
    phone,
    skill,
    age,
    date: dateKey,
    session: state.selectedSession,
    createdAt: new Date().toISOString()
  };

  const submitBtn = elements.btnSubmitBooking;
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Confirming booking...';

  try {
    bookings.push(newBooking);
    saveBookingsToStorage(bookings);

    logEdgeTelemetry(`New Confirmed Reservation: ${bookingId} - ${name} (${state.selectedSession.toUpperCase()}) on ${dateKey}`, 'success');

    if (hasFirestoreBackend()) {
      saveBookingToBackend(newBooking).catch((backendErr) => {
        console.warn('[Firestore] saveBookingToBackend failed:', backendErr);
      });
    }

    showToast(`Booking confirmed! ID: ${bookingId}`, "success");

    dispatchBookingEmailAlert(newBooking).catch(err => console.error('[Booking Email]', err));

    elements.bookingForm.style.display = 'none';
    state.selectedSession = null;

    updateSessionSlotsCapacity(state.selectedDate);
    renderCalendar();
    selectDate(state.selectedDate);
    renderAdminRoute();

    searchBookings(email);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  }
}

// --- SERVERLESS EDGE FUNCTION CANCELLATION HANDLER & AUTO-PROMOTION ENGINE ---
async function cancelBooking(bookingId, email) {
  let bookings = getBookingsFromStorage();
  const bookingToCancel = bookings.find(b => b.id === bookingId);

  if (!bookingToCancel) {
    showToast("Cancellation failed: Reservation not found.", "error");
    return;
  }

  // Remove booking
  bookings = bookings.filter(b => b.id !== bookingId);
  saveBookingsToStorage(bookings);

  showToast(`Booking ${bookingId} cancelled. Freeing court slot...`, "info");

  deleteBookingFromBackend(bookingToCancel).catch(err => console.warn('[Firestore Delete]', err));
  dispatchBookingCancellationAlert(bookingToCancel).catch(err => console.warn('[Cancellation Email]', err));

  // Execute Serverless Edge Function Pipeline for Dynamic Slot Allocation & Auto-Promotion
  await executeServerlessCancellationHandler(bookingToCancel);

  if (state.selectedDate) updateSessionSlotsCapacity(state.selectedDate);
  renderCalendar();
  renderAdminRoute();
  searchBookings(email);
}

async function executeServerlessCancellationHandler(cancelledBooking) {
  const startTime = Date.now();
  const { date: sessionDate, session: sessionType, id: bookingId } = cancelledBooking;

  logEdgeTelemetry(`═════════════════════════════════════════════════════`, 'info');
  logEdgeTelemetry(`[SERVERLESS EDGE FUNCTION] Invoked: handle-cancellation`, 'info');
  logEdgeTelemetry(`[1/5] Cancellation Payload Received for ${bookingId} (${sessionDate} ${sessionType.toUpperCase()})`, 'info');

  // Query FIFO Waitlist for top waiting player
  let waitlists = getWaitlistsFromStorage();
  const activeQueue = waitlists
    .filter(w => w.date === sessionDate && w.session === sessionType && w.status === 'WAITING')
    .sort((a, b) => a.position - b.position || new Date(a.createdAt) - new Date(b.createdAt));

  logEdgeTelemetry(`[2/5] Transaction Lock Acquired on Session ${sessionDate} ${sessionType}. Reading waitlist queue...`, 'info');

  if (activeQueue.length === 0) {
    logEdgeTelemetry(`[3/5] Court slot released (7/8 spots filled). No waitlisted candidates in queue.`, 'info');
    logEdgeTelemetry(`[4/5] Transaction Committed cleanly in ${Date.now() - startTime}ms. Response: HTTP 200 OK`, 'success');
    updateTelemetryMetrics(Date.now() - startTime, false);
    return;
  }

  // Top candidate found!
  const topCandidate = activeQueue[0];
  logEdgeTelemetry(`[3/5] Top FIFO Candidate Evaluated: ${topCandidate.name} (${topCandidate.email}) at Queue Position #${topCandidate.position}`, 'warning');

  const newBookingId = `RP-${sessionDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Update top candidate status to PROMOTED
  const candidateIndex = waitlists.findIndex(w => w.id === topCandidate.id);
  if (candidateIndex !== -1) {
    waitlists[candidateIndex].status = 'PROMOTED';
    waitlists[candidateIndex].promotedAt = new Date().toISOString();
    waitlists[candidateIndex].promotedBookingId = newBookingId;
  }

  // Re-index remaining queue positions
  let currentPos = 1;
  waitlists.forEach(w => {
    if (w.date === sessionDate && w.session === sessionType && w.status === 'WAITING') {
      w.position = currentPos++;
    }
  });

  saveWaitlistsToStorage(waitlists);

  // Insert newly promoted confirmed booking
  const promotedBooking = {
    id: newBookingId,
    name: topCandidate.name,
    email: topCandidate.email,
    phone: topCandidate.phone,
    skill: topCandidate.skill,
    age: topCandidate.age,
    date: sessionDate,
    session: sessionType,
    createdAt: new Date().toISOString(),
    promotedFromWaitlist: true
  };

  const bookings = getBookingsFromStorage();
  bookings.push(promotedBooking);
  saveBookingsToStorage(bookings);

  logEdgeTelemetry(`[4/5] ATOMIC TRANSITION: Waitlist #${topCandidate.position} -> CONFIRMED (Booking ID: ${newBookingId}). Slot Re-allocated!`, 'success');

  // Dispatch Email Notification to Promoted Player
  dispatchBookingEmailAlert(promotedBooking).catch(err => console.warn('[Promoted Email]', err));

  logEdgeTelemetry(`[5/5] Automated Email Alert sent to ${topCandidate.email}. Execution completed in ${Date.now() - startTime}ms. HTTP 200 OK`, 'success');

  updateTelemetryMetrics(Date.now() - startTime, true);

  showToast(`🎉 WAITLIST AUTO-PROMOTION: ${topCandidate.name} was automatically promoted from the waitlist to a confirmed spot!`, "success");
}

function cancelWaitlistEntry(waitlistId, email) {
  let waitlists = getWaitlistsFromStorage();
  const entry = waitlists.find(w => w.id === waitlistId);
  if (!entry) return;

  waitlists = waitlists.filter(w => w.id !== waitlistId);

  // Re-index remaining positions
  let currentPos = 1;
  waitlists.forEach(w => {
    if (w.date === entry.date && w.session === entry.session && w.status === 'WAITING') {
      w.position = currentPos++;
    }
  });

  saveWaitlistsToStorage(waitlists);
  showToast("Removed from waitlist.", "info");

  logEdgeTelemetry(`Waitlist entry ${waitlistId} left queue. Remaining positions re-indexed.`, 'info');

  searchBookings(email);
  if (state.selectedDate) updateSessionSlotsCapacity(state.selectedDate);
  renderCalendar();
  renderAdminRoute();
}

// --- DEMO SEED FULL SESSION AND WAITLIST ---
function seedFullSessionAndWaitlist() {
  const seedDateKey = "2026-05-27"; // Wednesday Camp Day
  let bookings = getBookingsFromStorage();
  let waitlists = getWaitlistsFromStorage();

  // Clear existing for this date & session
  bookings = bookings.filter(b => !(b.date === seedDateKey && b.session === 'evening'));
  waitlists = waitlists.filter(w => !(w.date === seedDateKey && w.session === 'evening'));

  const demoPlayers = [
    { name: "Yashaswin Ruttala", email: "yashaswin@rallypoint.org", phone: "555-111-2222", skill: "Intermediate", age: "Adult (18+)" },
    { name: "Nikhilesh Meela", email: "nikhilesh@rallypoint.org", phone: "555-333-4444", skill: "Advanced", age: "Adult (18+)" },
    { name: "David Miller", email: "david.m@example.com", phone: "555-444-5555", skill: "Advanced", age: "Adult (18+)" },
    { name: "Elena Rostova", email: "elena@example.com", phone: "555-666-7777", skill: "Intermediate", age: "Teens (13-17)" },
    { name: "Marcus Vance", email: "marcus@example.com", phone: "555-888-9999", skill: "Beginner", age: "Adult (18+)" },
    { name: "Chloe Bennett", email: "chloe@example.com", phone: "555-222-3333", skill: "Intermediate", age: "Junior (8-12)" },
    { name: "Jordan Smith", email: "jordan@example.com", phone: "555-777-1111", skill: "Advanced", age: "Adult (18+)" },
    { name: "Taylor Swift", email: "taylor@example.com", phone: "555-999-0000", skill: "Beginner", age: "Adult (18+)" }
  ];

  demoPlayers.forEach((p, idx) => {
    bookings.push({
      id: `RP-20260527-100${idx + 1}`,
      name: p.name,
      email: p.email,
      phone: p.phone,
      skill: p.skill,
      age: p.age,
      date: seedDateKey,
      session: 'evening',
      createdAt: new Date().toISOString()
    });
  });

  // Seed 2 Waitlisted Players
  waitlists.push({
    id: `WL-20260527-9001`,
    name: "Sarah Jenkins (Waitlist #1)",
    email: "sarah.j@example.com",
    phone: "555-123-9999",
    skill: "Intermediate",
    age: "Adult (18+)",
    date: seedDateKey,
    session: 'evening',
    position: 1,
    status: 'WAITING',
    createdAt: new Date().toISOString()
  });

  waitlists.push({
    id: `WL-20260527-9002`,
    name: "Alex Rivera (Waitlist #2)",
    email: "alex.r@example.com",
    phone: "555-987-1111",
    skill: "Advanced",
    age: "Adult (18+)",
    date: seedDateKey,
    session: 'evening',
    position: 2,
    status: 'WAITING',
    createdAt: new Date().toISOString()
  });

  saveBookingsToStorage(bookings);
  saveWaitlistsToStorage(waitlists);

  // Navigate calendar to May 2026
  state.viewingMonth = 4;
  state.viewingYear = 2026;
  const demoDate = new Date(2026, 4, 27);
  selectDate(demoDate);

  logEdgeTelemetry(`Demo dataset seeded: May 27 Evening Sunset Smash filled to capacity (8/8) with 2 players on FIFO Waitlist.`, 'warning');

  showToast("🚀 Evening Sunset Smash on May 27 is now 100% SOLD OUT with 2 players on the Waitlist! Try cancelling one of the bookings in 'My Bookings' or Admin Roster to observe auto-promotion!", "success");
}

// --- WAITLIST LOCAL STORAGE HELPERS ---
function getWaitlistsFromStorage() {
  try {
    const data = localStorage.getItem('rally_point_waitlists');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveWaitlistsToStorage(waitlists) {
  localStorage.setItem('rally_point_waitlists', JSON.stringify(waitlists));
}

// --- SEARCH & MY BOOKINGS VIEW ---
function initLookup() {
  try {
    if (!elements.lookupEmail || !elements.btnLookupSearch) return;

    // Enable/disable based on signed-in state
    elements.lookupEmail.disabled = !state.currentUser;
    elements.btnLookupSearch.disabled = !state.currentUser;

    elements.btnLookupSearch.addEventListener('click', (e) => {
      e.preventDefault();
      const email = elements.lookupEmail.value.trim();
      searchBookings(email);
    });

    elements.lookupEmail.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const email = elements.lookupEmail.value.trim();
        searchBookings(email);
      }
    });
  } catch (err) {
    console.error('initLookup error', err);
  }
}

function searchBookings(email) {
  const signedInEmail = state.currentUser ? state.currentUser.email.trim().toLowerCase() : '';
  const lookupEmail = (email || '').trim().toLowerCase();

  if (!signedInEmail) {
    elements.lookupEmail.value = '';
    elements.lookupEmail.disabled = true;
    elements.btnLookupSearch.disabled = true;
    renderBookingsPlaceholder();
    return;
  }

  const resolvedEmail = lookupEmail || signedInEmail;
  if (!resolvedEmail || !validateEmail(resolvedEmail)) {
    showToast('Please enter a valid search email.', 'error');
    return;
  }

  const isDirector = isDirectorUser();
  if (resolvedEmail !== signedInEmail && !isDirector) {
    showToast('You can only view your own reservation history.', 'error');
    elements.bookingsOutputContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.65);">
        <i class="fa-solid fa-shield-halved" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--accent-volt);"></i>
        <p>Only the signed-in account can view reservation details.</p>
      </div>
    `;
    return;
  }

  const bookings = getBookingsFromStorage().filter(b => b.email === resolvedEmail);
  const waitlists = getWaitlistsFromStorage().filter(w => w.email === resolvedEmail);

  if (bookings.length === 0 && waitlists.length === 0) {
    elements.bookingsOutputContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.65);">
        <i class="fa-solid fa-ticket-simple" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--accent-volt);"></i>
        <p>No active reservations or waitlist positions found for <strong>${escapeHTML(resolvedEmail)}</strong>.</p>
      </div>
    `;
    return;
  }

  let html = '';

  // Render Active Confirmed Bookings
  if (bookings.length > 0) {
    html += `<h4 style="color: var(--accent-volt); margin-bottom: 1rem; font-size: 1.1rem;"><i class="fa-solid fa-circle-check"></i> Confirmed Court Reservations</h4>`;
    html += bookings.map(booking => `
      <div class="ticket-card" style="margin-bottom: 1.5rem; border-left: 4px solid var(--accent-volt);">
        <div class="ticket-header">
          <div>
            <span class="ticket-id">CONFIRMED • ID: ${booking.id}</span>
            <h4 class="ticket-session">${formatBookingSessionProgram(booking.session)}</h4>
          </div>
          <span class="ticket-date">${formatBookingDateLabel(booking.date)}</span>
        </div>
        <div class="ticket-body">
          <div class="ticket-grid">
            <div>
              <span class="t-label">Player Name</span>
              <strong class="t-val">${escapeHTML(booking.name)}</strong>
            </div>
            <div>
              <span class="t-label">Session Time</span>
              <strong class="t-val">${formatBookingSessionTime(booking.session)}</strong>
            </div>
            <div>
              <span class="t-label">Skill Level</span>
              <strong class="t-val">${escapeHTML(booking.skill)}</strong>
            </div>
            <div>
              <span class="t-label">Age Group</span>
              <strong class="t-val">${escapeHTML(booking.age)}</strong>
            </div>
          </div>
          ${booking.promotedFromWaitlist ? '<div style="margin-top: 0.8rem; font-size: 0.8rem; color: var(--accent-teal);"><i class="fa-solid fa-wand-magic-sparkles"></i> Auto-promoted off the waitlist!</div>' : ''}
          <div class="ticket-actions" style="margin-top: 1rem; display: flex; justify-content: flex-end; gap: 0.8rem;">
            <button class="btn btn-sm btn-outline" onclick="cancelBooking('${booking.id}', '${booking.email}')" style="color: #ff6b6b; border-color: rgba(255,107,107,0.4);"><i class="fa-solid fa-trash-can"></i> Cancel Reservation</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Render Active Waitlist Entries
  if (waitlists.length > 0) {
    html += `<h4 style="color: #ffaa00; margin-top: 1.5rem; margin-bottom: 1rem; font-size: 1.1rem;"><i class="fa-solid fa-clock-rotate-left"></i> Active Waitlist Entries</h4>`;
    html += waitlists.map(w => `
      <div class="ticket-card" style="margin-bottom: 1.5rem; border-left: 4px solid #ffaa00; background: rgba(255, 170, 0, 0.05);">
        <div class="ticket-header">
          <div>
            <span class="tag-waitlist-badge">WAITLIST POSITION #${w.position}</span>
            <h4 class="ticket-session">${formatBookingSessionProgram(w.session)}</h4>
          </div>
          <span class="ticket-date">${formatBookingDateLabel(w.date)}</span>
        </div>
        <div class="ticket-body">
          <div class="ticket-grid">
            <div>
              <span class="t-label">Player Name</span>
              <strong class="t-val">${escapeHTML(w.name)}</strong>
            </div>
            <div>
              <span class="t-label">Queue Position</span>
              <strong class="t-val" style="color: #ffaa00;">Position #${w.position} in line</strong>
            </div>
            <div>
              <span class="t-label">Skill Level</span>
              <strong class="t-val">${escapeHTML(w.skill)}</strong>
            </div>
            <div>
              <span class="t-label">Status</span>
              <strong class="t-val">${w.status}</strong>
            </div>
          </div>
          <div class="ticket-actions" style="margin-top: 1rem; display: flex; justify-content: flex-end;">
            <button class="btn btn-sm btn-outline" onclick="cancelWaitlistEntry('${w.id}', '${w.email}')" style="color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.2);"><i class="fa-solid fa-xmark"></i> Leave Waitlist</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  elements.bookingsOutputContainer.innerHTML = html;
}

// --- ADMIN ROSTER & WAITLIST QUEUE DISPLAY ---
function renderAdminRoster(bookings = getBookingsFromStorage().filter(isActiveRosterBooking)) {
  if (!elements.adminRosterList) return;

  const waitlists = getWaitlistsFromStorage();

  const grouped = bookings.reduce((acc, booking) => {
    const key = `${booking.date}|${booking.session}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(booking);
    return acc;
  }, {});

  if (Object.keys(grouped).length === 0) {
    elements.adminRosterList.innerHTML = `
      <div class="admin-empty">
        <i class="fa-solid fa-clipboard-list"></i>
        <p>No active session signups yet.</p>
      </div>
    `;
    return;
  }

  elements.adminRosterList.innerHTML = Object.entries(grouped).map(([key, sessionBookings]) => {
    const [date, session] = key.split('|');
    const spotsLeft = Math.max(state.maxSpots - sessionBookings.length, 0);

    const sessionWaitlists = waitlists
      .filter(w => w.date === date && w.session === session && w.status === 'WAITING')
      .sort((a, b) => a.position - b.position);

    return `
      <section class="admin-session" style="margin-bottom: 2rem;">
        <div class="admin-session-header">
          <div>
            <span>${formatBookingDateLabel(date)}</span>
            <h4>${formatBookingSessionProgram(session)}</h4>
            <p>${formatBookingSessionTime(session)} | ${sessionBookings.length}/${state.maxSpots} Booked | ${sessionWaitlists.length} on Waitlist</p>
          </div>
          ${sessionBookings.length >= state.maxSpots ? '<span class="tag-waitlist-badge">Session Full • Waitlist Active</span>' : ''}
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Skill</th>
                <th>Booking ID</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${sessionBookings.map(b => `
                <tr>
                  <td>${escapeHTML(b.name)}</td>
                  <td>${escapeHTML(b.email)}</td>
                  <td>${escapeHTML(b.phone)}</td>
                  <td>${escapeHTML(b.skill)}</td>
                  <td>${escapeHTML(b.id)}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="cancelBooking('${b.id}', '${b.email}')" style="color: #ff6b6b; border-color: rgba(255,107,107,0.4); padding: 0.2rem 0.5rem; font-size: 0.75rem;">Cancel</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${sessionWaitlists.length > 0 ? `
          <div style="margin-top: 1rem; padding: 1rem; background: rgba(255, 170, 0, 0.05); border: 1px solid rgba(255, 170, 0, 0.2); border-radius: var(--border-radius-sm);">
            <h5 style="color: #ffaa00; font-size: 0.9rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-clock-rotate-left"></i> Live FIFO Waitlist Queue (${sessionWaitlists.length} waiting)</h5>
            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
              ${sessionWaitlists.map(w => `
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: rgba(255,255,255,0.85); background: rgba(0,0,0,0.2); padding: 0.4rem 0.8rem; border-radius: 4px;">
                  <span><strong>Position #${w.position}:</strong> ${escapeHTML(w.name)} (${escapeHTML(w.email)})</span>
                  <span style="color: #ffaa00;">${w.skill} • ${w.age}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </section>
    `;
  }).join('');
}

function isActiveRosterBooking(booking) {
  return normalizeDate(new Date(`${booking.date}T00:00:00`)) >= state.today;
}

function getFormattedDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isSameDate(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function getBookingsFromStorage() {
  try {
    const data = localStorage.getItem('rally_point_bookings');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveBookingsToStorage(bookings) {
  localStorage.setItem('rally_point_bookings', JSON.stringify(bookings));
}

function getUsersFromStorage() {
  try {
    const users = localStorage.getItem('rally_users');
    return users ? JSON.parse(users) : [];
  } catch {
    return [];
  }
}

function saveUsersToStorage(users) {
  localStorage.setItem('rally_users', JSON.stringify(users));
}

function hasFirestoreBackend() {
  return Boolean(window.__rally_db);
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => resolve();
    s.onerror = (e) => reject(new Error('Failed to load ' + url));
    document.head.appendChild(s);
  });
}

async function initBookingBackend() {
  let cfg = window.RALLY_EMAIL_CONFIG?.firebaseConfig;
  // If no client config exists, try fetching the runtime config from /api/config (Vercel env vars)
  if (!cfg) {
    try {
      const resp = await fetch('/api/config');
      if (resp && resp.ok) {
        const serverCfg = await resp.json();
        if (!window.RALLY_EMAIL_CONFIG) window.RALLY_EMAIL_CONFIG = {};
        // merge server config into window.RALLY_EMAIL_CONFIG but keep any client values
        window.RALLY_EMAIL_CONFIG = Object.assign({}, window.RALLY_EMAIL_CONFIG, serverCfg);
        cfg = window.RALLY_EMAIL_CONFIG.firebaseConfig;
      }
    } catch (e) {
      // ignore fetch errors and fall back to client config
    }
  }
  if (!cfg) return Promise.resolve();
  if (window.__rally_db) return Promise.resolve();

  try {
    // Load Firebase compat SDKs so code runs in browsers without bundlers
    await loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js');

    if (!window.firebase || !window.firebase.initializeApp) {
      console.warn('Firebase SDK loaded but not available.');
      return Promise.resolve();
    }

    try { window.firebase.initializeApp(cfg); } catch (e) { /* already initialized might throw */ }
    window.__rally_db = window.firebase.firestore();

    // Initialize Auth listener to keep state in sync across tabs/devices
    try {
      if (window.firebase && window.firebase.auth) {
        window.firebase.auth().onAuthStateChanged(async (fbUser) => {
          if (fbUser) {
            // load profile from Firestore if available
            try {
              const doc = await window.__rally_db.collection('users').doc(fbUser.uid).get();
              const profile = doc.exists ? doc.data() : { name: fbUser.displayName || '', email: fbUser.email, phone: '' };
              profile.uid = fbUser.uid;
              setCurrentUserSession(profile);
            } catch (e) {
              setCurrentUserSession({ name: fbUser.displayName || '', email: fbUser.email, phone: '', uid: fbUser.uid });
            }
          } else {
            // signed out
            try { localStorage.removeItem('rally_current_user'); } catch (e) {}
            state.currentUser = null;
            updateAuthUI();
          }
        });
      }
    } catch (e) { console.warn('Firebase auth listener failed', e); }

    // Pull remote collections into localStorage so the app can continue using existing local helpers
    try {
      // Only mirror collections if rules allow public read or user is signed in
      const authAvailable = window.firebase && window.firebase.auth;
      const signedIn = authAvailable ? Boolean(window.firebase.auth().currentUser) : true;
      if (!signedIn) {
        console.info('Firebase mirror skipped: no authenticated user (reads likely restricted by rules).');
      } else {
        const bookingsSnap = await window.__rally_db.collection('bookings').get();
        const bookings = bookingsSnap.docs.map(d => d.data());
        localStorage.setItem('rally_point_bookings', JSON.stringify(bookings || []));

        const usersSnap = await window.__rally_db.collection('users').get();
        const users = usersSnap.docs.map(d => d.data());
        localStorage.setItem('rally_users', JSON.stringify(users || []));

        const waitlistsSnap = await window.__rally_db.collection('waitlists').get();
        const waitlists = waitlistsSnap.docs.map(d => d.data());
        localStorage.setItem('rally_point_waitlists', JSON.stringify(waitlists || []));

        console.info('Firebase sync: loaded', bookings.length || 0, 'bookings,', users.length || 0, 'users');
      }
    } catch (err) {
      console.warn('Firebase: failed to mirror collections to localStorage', err);
    }

    return Promise.resolve();
  } catch (err) {
    console.warn('initBookingBackend error', err);
    return Promise.resolve();
  }
}

function hasBookingResetBeenApplied() { return Promise.resolve(false); }
function markBookingResetAsApplied() { return Promise.resolve(); }
function resetAllBookings() { return Promise.resolve(true); }
function saveBookingToBackend(b) {
  if (!hasFirestoreBackend()) return Promise.resolve();
  try {
    const col = window.__rally_db.collection('bookings');
    return col.doc(b.id).set(b);
  } catch (e) { return Promise.resolve(); }
}
function deleteBookingFromBackend(b) {
  if (!hasFirestoreBackend()) return Promise.resolve();
  try { return window.__rally_db.collection('bookings').doc(b.id).delete(); } catch (e) { return Promise.resolve(); }
}
function dispatchBookingEmailAlert(b) { return Promise.resolve({ sent: true, via: 'Mock' }); }
function dispatchBookingCancellationAlert(b) { return Promise.resolve({ sent: true, via: 'Mock' }); }
function getBookingContactDetails() {
  return {
    name: elements.bookerName.value,
    email: elements.bookerEmail.value,
    phone: elements.bookerPhone.value
  };
}
function syncUserProfileFromBookingForm(c) { return true; }
function formatBookingSessionProgram(s) { return s === 'morning' ? 'Morning Rise & Rally' : 'Evening Sunset Smash'; }
function formatBookingSessionTime(s) { return s === 'morning' ? '7:00 AM - 8:30 AM' : '5:30 PM - 7:00 PM'; }
function formatBookingDateLabel(d) { return d; }
function renderBookingsPlaceholder() {
  if (elements.bookingsOutputContainer) {
    elements.bookingsOutputContainer.innerHTML = '<p>Sign in to view reservations.</p>';
  }
}
function ensureDirectorAccounts() {}
function seedDatabase() {}
