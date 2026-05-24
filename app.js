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
  bookingDeadlineDate: normalizeDate(new Date(2026, 6, 31)), // July 31, 2026
  currentUser: null,
  users: []
};

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
  signupPass: document.getElementById('signup-password')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initAuth();
  initCalendar();
  initSessionCards();
  initBookingForm();
  initLookup();
  
  // Seed sample data
  seedDatabase();
  
  // Check active session (loads bookings if already logged in)
  checkSession();

  if (!state.currentUser) {
    renderBookingsPlaceholder();
  }
});

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

// --- USER AUTHENTICATION ENGINE ---
function initAuth() {
  // Opening Modal triggers
  elements.btnNavLogin.addEventListener('click', () => openAuthModal('login'));
  elements.btnFlowLogin.addEventListener('click', () => openAuthModal('login'));
  
  // Closing Modal trigger
  elements.authCloseBtn.addEventListener('click', closeAuthModal);
  elements.authModalWrapper.addEventListener('click', (e) => {
    if (e.target === elements.authModalWrapper) closeAuthModal();
  });

  // Tab switcher
  elements.tabLogin.addEventListener('click', () => switchAuthTab('login'));
  elements.tabSignup.addEventListener('click', () => switchAuthTab('signup'));

  // Form Submissions
  elements.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin();
  });

  elements.signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSignup();
  });
}

function openAuthModal(tab = 'login') {
  elements.authModalWrapper.classList.add('active');
  switchAuthTab(tab);
}

function closeAuthModal() {
  elements.authModalWrapper.classList.remove('active');
  elements.loginForm.reset();
  elements.signupForm.reset();
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
}

function handleSignup() {
  const name = elements.signupName.value.trim();
  const email = elements.signupEmail.value.trim().toLowerCase();
  const phone = elements.signupPhone.value.trim();
  const pass = elements.signupPass.value;

  if (!name || !email || !phone || !pass) {
    showToast("All fields are strictly required.", "error");
    return;
  }

  const users = getUsersFromStorage();
  if (users.some(u => u.email === email)) {
    showToast("An account already exists under this email address.", "error");
    return;
  }

  const newUser = { name, email, phone, password: pass };
  users.push(newUser);
  saveUsersToStorage(users);

  showToast("Account successfully registered!", "success");
  
  // Set current user session
  setCurrentUserSession(newUser);
  closeAuthModal();
}

function handleLogin() {
  const email = elements.loginEmail.value.trim().toLowerCase();
  const pass = elements.loginPass.value;

  if (!email || !pass) {
    showToast("Please enter email and password.", "error");
    return;
  }

  const users = getUsersFromStorage();
  const matchedUser = users.find(u => u.email === email && u.password === pass);

  if (!matchedUser) {
    showToast("Invalid credentials. Please try again.", "error");
    return;
  }

  showToast(`Welcome back, ${matchedUser.name}!`, "success");
  setCurrentUserSession(matchedUser);
  closeAuthModal();
}

function setCurrentUserSession(user) {
  state.currentUser = user;
  localStorage.setItem('rally_current_user', JSON.stringify(user));
  updateAuthUI();
  refreshMyBookingsView();
}

function handleLogout() {
  state.currentUser = null;
  localStorage.removeItem('rally_current_user');
  showToast("Logged out successfully.", "info");
  updateAuthUI();
  renderBookingsPlaceholder();
}

function checkSession() {
  try {
    const savedUser = localStorage.getItem('rally_current_user');
    if (savedUser) {
      state.currentUser = JSON.parse(savedUser);
    }
  } catch {
    localStorage.removeItem('rally_current_user');
    state.currentUser = null;
  }
  updateAuthUI();
  refreshMyBookingsView();
}

function updateAuthUI() {
  if (state.currentUser) {
    // Inject user initials icon in navigation
    const initials = state.currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    elements.navAuthContainer.innerHTML = `
      <div class="user-badge" title="Logged in as ${state.currentUser.name}">
        <span class="user-initials">${initials}</span>
        <span class="user-badge-name">${state.currentUser.name.split(' ')[0]}</span>
        <button class="btn-logout" onclick="handleLogout()" aria-label="Logout"><i class="fa-solid fa-right-from-bracket"></i></button>
      </div>
    `;
    
    // Pre-fill checkout fields (editable by the user)
    elements.bookerName.value = state.currentUser.name;
    elements.bookerEmail.value = state.currentUser.email;
    elements.bookerPhone.value = state.currentUser.phone;
    
    // Show Form, hide lock screen
    elements.flowAuthRequired.style.display = 'none';
    if (state.selectedDate && state.selectedSession) {
      elements.bookingForm.style.display = 'flex';
    }
  } else {
    // Show standard login button in nav
    elements.navAuthContainer.innerHTML = `
      <button class="btn btn-volt btn-nav-auth" id="btn-nav-login" style="padding: 0.45rem 1.2rem; font-size: 0.85rem; border-radius: 50px;">Login / Signup</button>
    `;
    // Re-bind click listener since element was dynamically overwritten
    document.getElementById('btn-nav-login').addEventListener('click', () => openAuthModal('login'));
    
    // Hide form, show authentication lock
    elements.bookingForm.style.display = 'none';
    if (state.selectedDate && state.selectedSession) {
      elements.flowAuthRequired.style.display = 'flex';
    }
  }
}

// Global handleLogout binder for Nav click
window.handleLogout = handleLogout;

// --- CALENDAR SYSTEM ---
function initCalendar() {
  renderCalendar();

  elements.prevMonthBtn.addEventListener('click', () => {
    if (state.viewingMonth === 4 && state.viewingYear === 2026) return; // May 2026 limit
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
}

function renderCalendar() {
  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  
  elements.calendarMonthYear.textContent = `${monthNames[state.viewingMonth]} ${state.viewingYear}`;
  elements.prevMonthBtn.disabled = (state.viewingMonth === 4 && state.viewingYear === 2026);

  elements.calendarDays.innerHTML = '';
  
  const firstDayIndex = new Date(state.viewingYear, state.viewingMonth, 1).getDay();
  const totalDays = new Date(state.viewingYear, state.viewingMonth + 1, 0).getDate();
  
  for (let i = 0; i < firstDayIndex; i++) {
    elements.calendarDays.appendChild(document.createElement('div'));
  }
  
  for (let day = 1; day <= totalDays; day++) {
    const dayTile = document.createElement('button');
    dayTile.className = 'calendar-day-tile';
    dayTile.textContent = day;
    
    const tileDate = normalizeDate(new Date(state.viewingYear, state.viewingMonth, day));
    const dayOfWeek = tileDate.getDay();
    // Camp sessions: Monday (1), Wednesday (3), Friday (5)
    const isCampDayOfWeek = (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5);
    const isAfterCampStart = tileDate >= state.campStartDate;
    const isPast = tileDate < state.today;
    const isAfterBookingDeadline = tileDate > state.bookingDeadlineDate;

    if (isCampDayOfWeek && isAfterCampStart && !isPast && !isAfterBookingDeadline) {
      dayTile.classList.add('camp-day');
      if (state.selectedDate && isSameDate(tileDate, state.selectedDate)) dayTile.classList.add('selected');
      if (isSameDate(tileDate, state.today)) dayTile.classList.add('today');
      
      dayTile.addEventListener('click', () => selectDate(tileDate));
    } else {
      dayTile.classList.add('disabled');
      dayTile.setAttribute('disabled', 'true');
    }
    elements.calendarDays.appendChild(dayTile);
  }
}

function selectDate(date) {
  // Check if date is after booking deadline
  if (date > state.bookingDeadlineDate) {
    showToast("Booking deadline passed! The last day to book sessions was July 31, 2026.", "error");
    return;
  }

  state.selectedDate = date;
  state.selectedSession = null;
  
  const allTiles = elements.calendarDays.querySelectorAll('.calendar-day-tile');
  allTiles.forEach(tile => {
    tile.classList.remove('selected');
    const dayVal = parseInt(tile.textContent);
    if (dayVal && isSameDate(new Date(state.viewingYear, state.viewingMonth, dayVal), date)) {
      tile.classList.add('selected');
    }
  });
  
  elements.flowTitle.textContent = "Select Your Program Time";
  const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  elements.flowSubtitle.innerHTML = `<i class="fa-solid fa-calendar-day"></i> Selected: <strong>${formattedDate}</strong>`;
  
  elements.flowEmptyState.style.display = 'none';
  elements.flowSessionsStep.style.display = 'flex';
  
  // Hide form until session selected
  elements.bookingForm.style.display = 'none';
  elements.flowAuthRequired.style.display = 'none';
  
  elements.slotCardMorning.classList.remove('selected');
  elements.slotCardEvening.classList.remove('selected');
  
  updateSessionSlotsCapacity(date);
}

// --- SESSIONS AND CHECKOUT SELECTION ---
function initSessionCards() {
  elements.slotCardMorning.addEventListener('click', () => {
    if (elements.slotCardMorning.classList.contains('disabled')) return;
    selectSession('morning');
  });

  elements.slotCardEvening.addEventListener('click', () => {
    if (elements.slotCardEvening.classList.contains('disabled')) return;
    selectSession('evening');
  });
  
  elements.btnFlowLogin.addEventListener('click', () => openAuthModal('login'));
}

function selectSession(session) {
  state.selectedSession = session;
  
  if (session === 'morning') {
    elements.slotCardMorning.classList.add('selected');
    elements.slotCardEvening.classList.remove('selected');
  } else {
    elements.slotCardEvening.classList.add('selected');
    elements.slotCardMorning.classList.remove('selected');
  }
  
  elements.flowTitle.textContent = "Reserve Court Seat";
  const sessionName = session === 'morning' ? "Morning Rise & Rally" : "Evening Sunset Smash";
  const dateStr = state.selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  elements.flowSubtitle.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--primary-light);"></i> Reserve: <strong>${sessionName}</strong> on <strong>${dateStr}</strong>`;
  
  // Show either form or authentication block depending on login state
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
  
  const morningCount = bookings.filter(b => b.date === dateKey && b.session === 'morning').length;
  const eveningCount = bookings.filter(b => b.date === dateKey && b.session === 'evening').length;
  
  const morningLeft = Math.max(0, state.maxSpots - morningCount);
  const eveningLeft = Math.max(0, state.maxSpots - eveningCount);
  
  // Morning UI update
  if (morningLeft === 0) {
    elements.slotCardMorning.classList.add('disabled');
    elements.morningCapacityText.textContent = "Sold Out";
    elements.morningCapacityBar.style.width = '100%';
    elements.morningCapacityBar.className = 'capacity-progress full';
  } else {
    elements.slotCardMorning.classList.remove('disabled');
    elements.morningCapacityText.textContent = `${morningLeft} Spots Left`;
    elements.morningCapacityBar.style.width = `${(morningLeft / state.maxSpots) * 100}%`;
    elements.morningCapacityBar.className = 'capacity-progress available';
  }
  
  // Evening UI update
  if (eveningLeft === 0) {
    elements.slotCardEvening.classList.add('disabled');
    elements.eveningCapacityText.textContent = "Sold Out";
    elements.eveningCapacityBar.style.width = '100%';
    elements.eveningCapacityBar.className = 'capacity-progress full';
  } else {
    elements.slotCardEvening.classList.remove('disabled');
    elements.eveningCapacityText.textContent = `${eveningLeft} Spots Left`;
    elements.eveningCapacityBar.style.width = `${(eveningLeft / state.maxSpots) * 100}%`;
    elements.eveningCapacityBar.className = 'capacity-progress available';
  }
}

// --- BOOKING SUBMISSION & EMAIL DISPATCH ---
const EMAIL_CONFIG = window.RALLY_EMAIL_CONFIG || { notifyEmail: 'rallypoint.hr@gmail.com', web3formsAccessKey: '' };

function initBookingForm() {
  elements.bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitBooking();
  });
}

function formatBookingSessionProgram(session) {
  return session === 'morning' ? 'Morning Rise & Rally' : 'Evening Sunset Smash';
}

function formatBookingSessionTime(session) {
  return session === 'morning' ? '7:00 AM - 8:30 AM' : '5:30 PM - 7:00 PM';
}

function formatBookingDateLabel(dateKey) {
  const dateObj = new Date(dateKey + 'T00:00:00');
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function buildBookingEmailPayload(booking) {
  const sessionDate = formatBookingDateLabel(booking.date);
  const sessionTime = formatBookingSessionTime(booking.session);
  const sessionProgram = formatBookingSessionProgram(booking.session);

  const message = [
    'NEW RALLYPOINT TENNIS CAMP BOOKING',
    '',
    '—— PLAYER DETAILS ——',
    `Full Name: ${booking.name}`,
    `Email Address: ${booking.email}`,
    `Phone Number: ${booking.phone}`,
    `Skill Level: ${booking.skill}`,
    `Age Category: ${booking.age}`,
    '',
    '—— SESSION BOOKED ——',
    `Date: ${sessionDate}`,
    `Time: ${sessionTime}`,
    `Program: ${sessionProgram}`,
    '',
    `Booking ID: ${booking.id}`,
    '',
    '— RallyPoint automated booking notification'
  ].join('\n');

  const subject = `New Booking: ${booking.name} — ${sessionDate} (${sessionTime})`;

  return {
    subject,
    sessionDate,
    sessionTime,
    sessionProgram,
    message,
    fields: {
      'Booking ID': booking.id,
      'Full Name': booking.name,
      'Email Address': booking.email,
      'Phone Number': booking.phone,
      'Skill Level': booking.skill,
      'Age Category': booking.age,
      'Session Date': sessionDate,
      'Session Time': sessionTime,
      'Program': sessionProgram,
      'Booking Summary': `${sessionProgram} on ${sessionDate} at ${sessionTime}`
    }
  };
}

async function sendViaFormSubmit(booking, payload) {
  const notifyEmail = EMAIL_CONFIG.notifyEmail;
  const endpoint = `https://formsubmit.co/ajax/${encodeURIComponent(notifyEmail)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      _subject: payload.subject,
      _template: 'table',
      _captcha: 'false',
      _replyto: booking.email,
      ...payload.fields,
      message: payload.message
    })
  });

  let result = {};
  try {
    result = await response.json();
  } catch {
    result = {};
  }

  const success = response.ok && result.success !== false && result.success !== 'false';
  if (!success) {
    throw new Error(result.message || 'FormSubmit could not deliver the notification.');
  }

  return 'FormSubmit';
}

async function sendViaWeb3Forms(booking, payload) {
  const accessKey = EMAIL_CONFIG.web3formsAccessKey;
  if (!accessKey) return null;

  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      access_key: accessKey,
      subject: payload.subject,
      from_name: booking.name,
      email: booking.email,
      ...payload.fields,
      message: payload.message
    })
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Web3Forms could not deliver the notification.');
  }

  return 'Web3Forms';
}

async function dispatchBookingEmailAlert(booking) {
  const payload = buildBookingEmailPayload(booking);
  const errors = [];

  try {
    const via = await sendViaFormSubmit(booking, payload);
    return { sent: true, via };
  } catch (err) {
    errors.push(err.message || String(err));
    console.warn('[Booking Email] FormSubmit failed:', err);
  }

  try {
    const via = await sendViaWeb3Forms(booking, payload);
    if (via) return { sent: true, via };
  } catch (err) {
    errors.push(err.message || String(err));
    console.warn('[Booking Email] Web3Forms failed:', err);
  }

  return { sent: false, error: errors.join(' ') };
}

function getBookingContactDetails() {
  return {
    name: elements.bookerName.value.trim(),
    email: elements.bookerEmail.value.trim().toLowerCase(),
    phone: elements.bookerPhone.value.trim()
  };
}

function syncUserProfileFromBookingForm(contact) {
  if (!state.currentUser) return true;

  const users = getUsersFromStorage();
  const accountEmail = state.currentUser.email;
  const userIndex = users.findIndex(u => u.email === accountEmail);

  if (userIndex === -1) return true;

  if (contact.email !== accountEmail && users.some(u => u.email === contact.email)) {
    showToast("That email is already registered to another account.", "error");
    return false;
  }

  const updatedUser = {
    ...users[userIndex],
    name: contact.name,
    email: contact.email,
    phone: contact.phone
  };
  users[userIndex] = updatedUser;
  saveUsersToStorage(users);
  setCurrentUserSession(updatedUser);
  return true;
}

async function submitBooking() {
  if (!state.currentUser) {
    showToast("You must log in to submit a booking.", "error");
    return;
  }

  // Check if booking deadline has passed
  if (state.currentDate > state.bookingDeadlineDate) {
    showToast("Bookings are no longer available. The deadline was July 31, 2026.", "error");
    return;
  }

  const { name, email, phone } = getBookingContactDetails();
  const skill = elements.bookerSkill.value;
  const age = elements.bookerAge.value;
  
  if (!state.selectedDate || !state.selectedSession) {
    showToast("Please choose a date and time slot first.", "error");
    return;
  }

  if (!name || !email || !phone) {
    showToast("Please enter your name, email, and phone number.", "error");
    return;
  }

  if (!validateEmail(email)) {
    showToast("Please enter a valid email address.", "error");
    return;
  }
  
  if (!skill || !age) {
    showToast("Please enter player skill and age group.", "error");
    return;
  }

  if (!syncUserProfileFromBookingForm({ name, email, phone })) {
    return;
  }
  
  const dateKey = getFormattedDateKey(state.selectedDate);
  const bookings = getBookingsFromStorage();
  
  const isDoubleBooked = bookings.some(b => b.email === email && b.date === dateKey && b.session === state.selectedSession);
  if (isDoubleBooked) {
    showToast("Double-booking alert! You already have a slot reserved for this session.", "error");
    return;
  }
  
  const bookingId = `RP-${state.selectedDate.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const newBooking = {
    id: bookingId,
    name: name,
    email: email,
    phone: phone,
    skill: skill,
    age: age,
    date: dateKey,
    session: state.selectedSession,
    createdAt: new Date().toISOString()
  };

  const submitBtn = elements.btnSubmitBooking;
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending notification...';
  
  try {
    bookings.push(newBooking);
    saveBookingsToStorage(bookings);

    const emailResult = await dispatchBookingEmailAlert(newBooking);
    const notifyEmail = EMAIL_CONFIG.notifyEmail;

    if (emailResult.sent) {
      showToast(`Booking confirmed! Receipt sent to ${notifyEmail}. ID: ${bookingId}`, "success");
    } else {
      showToast(
        `Booking saved (ID: ${bookingId}), but the receipt email to ${notifyEmail} could not be sent. Open the site via a web server and activate FormSubmit on first use.`,
        "warning"
      );
      console.error('[Booking Email]', emailResult.error);
    }

    elements.bookerSkill.selectedIndex = 0;
    elements.bookerAge.selectedIndex = 0;
    elements.bookingForm.style.display = 'none';
    elements.slotCardMorning.classList.remove('selected');
    elements.slotCardEvening.classList.remove('selected');
    state.selectedSession = null;

    updateSessionSlotsCapacity(state.selectedDate);
    selectDate(state.selectedDate);

    if (elements.lookupEmail.value.trim().toLowerCase() === email) {
      searchBookings(email);
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  }
}

// --- BOOKINGS LOOKUP & MAIL CLIENT RECEIPT GENERATOR ---
function initLookup() {
  elements.btnLookupSearch.addEventListener('click', () => {
    const email = elements.lookupEmail.value.trim().toLowerCase();
    searchBookings(email);
  });
  
  elements.lookupEmail.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const email = elements.lookupEmail.value.trim().toLowerCase();
      searchBookings(email);
    }
  });
}

function renderBookingsPlaceholder() {
  elements.bookingsOutputContainer.innerHTML = `
    <div class="bookings-demo-hint">
      <i class="fa-solid fa-circle-info"></i>
      <div>
        <p>Enter your email in the box above and press <strong>Search</strong> to view bookings.</p>
      </div>
    </div>
  `;
}

function refreshMyBookingsView() {
  if (state.currentUser) {
    elements.lookupEmail.value = state.currentUser.email;
    searchBookings(state.currentUser.email);
  }
}

function searchBookings(email) {
  if (!email || !validateEmail(email)) {
    showToast("Please enter a valid search email.", "error");
    elements.bookingsOutputContainer.innerHTML = '';
    return;
  }
  
  const bookings = getBookingsFromStorage();
  const userBookings = bookings.filter(b => b.email === email);
  
  if (userBookings.length === 0) {
    showToast("No active registrations found.", "info");
    elements.bookingsOutputContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.65);">
        <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--accent-volt);"></i>
        <p>No active non-profit registrations found for <strong>${email}</strong>.</p>
      </div>
    `;
    return;
  }
  
  userBookings.sort((a, b) => new Date(a.date) - new Date(b.date));
  elements.bookingsOutputContainer.innerHTML = '';
  
  userBookings.forEach(booking => {
    const dateObj = new Date(booking.date + "T00:00:00");
    const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const sessionTime = booking.session === 'morning' ? "7:00 AM - 8:30 AM" : "5:30 PM - 7:00 PM";
    const sessionName = booking.session === 'morning' ? "Morning Rise & Rally" : "Evening Sunset Smash";

    const ticket = document.createElement('div');
    ticket.className = 'ticket';
    ticket.innerHTML = `
      <div class="ticket-main">
        <div class="ticket-header">
          <span class="ticket-badge">${sessionName}</span>
          <span class="ticket-id">${booking.id}</span>
        </div>
        <div class="ticket-grid">
          <div class="ticket-info-item">
            <h6>Date</h6>
            <p>${formattedDate}</p>
          </div>
          <div class="ticket-info-item">
            <h6>Session Duration</h6>
            <p>${sessionTime} (90m)</p>
          </div>
          <div class="ticket-info-item">
            <h6>Player Name</h6>
            <p>${booking.name}</p>
          </div>
          <div class="ticket-info-item">
            <h6>Skill & Category</h6>
            <p>${booking.skill} | ${booking.age.split(' ')[0]}</p>
          </div>
        </div>
      </div>
      <div class="ticket-divider"></div>
      <div class="ticket-side">
        <button class="btn-cancel" onclick="triggerCancellation('${booking.id}', '${booking.email}')">Cancel Booking</button>
      </div>
    `;
    elements.bookingsOutputContainer.appendChild(ticket);
  });
}

window.triggerCancellation = function(bookingId, email) {
  if (confirm(`Are you absolutely sure you want to cancel booking ${bookingId}? This non-profit slot will be released immediately.`)) {
    cancelBooking(bookingId, email);
  }
};

function cancelBooking(bookingId, email) {
  let bookings = getBookingsFromStorage();
  const initialLen = bookings.length;
  
  bookings = bookings.filter(b => b.id !== bookingId);
  saveBookingsToStorage(bookings);
  
  if (bookings.length < initialLen) {
    showToast(`Booking ${bookingId} cancelled successfully.`, "success");
    searchBookings(email);
    
    if (state.selectedDate) {
      updateSessionSlotsCapacity(state.selectedDate);
    }
  } else {
    showToast("Cancellation failed.", "error");
  }
}

// --- TOAST SYSTEMS ---
function showToast(message, type = "info") {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconClass = 'fa-info-circle';
  if (type === 'success') iconClass = 'fa-circle-check';
  if (type === 'error') iconClass = 'fa-triangle-exclamation';
  if (type === 'warning') iconClass = 'fa-circle-exclamation';
  
  toast.innerHTML = `
    <span class="toast-icon"><i class="fa-solid ${iconClass}"></i></span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Close Toast"><i class="fa-solid fa-xmark"></i></button>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 400);
  });
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 400);
    }
  }, 5000);
}

// --- LOCAL STORAGE UTILITIES ---
function getUsersFromStorage() {
  try {
    const users = localStorage.getItem('rally_users');
    return users ? JSON.parse(users) : [];
  } catch {
    localStorage.removeItem('rally_users');
    return [];
  }
}

function saveUsersToStorage(users) {
  localStorage.setItem('rally_users', JSON.stringify(users));
}

function getBookingsFromStorage() {
  try {
    const bookings = localStorage.getItem('rally_point_bookings');
    return bookings ? JSON.parse(bookings) : [];
  } catch {
    localStorage.removeItem('rally_point_bookings');
    return [];
  }
}

function saveBookingsToStorage(bookings) {
  localStorage.setItem('rally_point_bookings', JSON.stringify(bookings));
}

function seedDatabase() {
  const defaultUsers = [
    { name: "Yashaswin Ruttala", email: "yashaswin@rallypoint.org", phone: "555-111-2222", password: "prodirector" },
    { name: "Nikhilesh Meela", email: "nikhilesh@rallypoint.org", phone: "555-333-4444", password: "prodirector" },
    { name: "Alice Player", email: "alice@example.com", phone: "555-555-5555", password: "password" }
  ];

  let users = getUsersFromStorage();
  defaultUsers.forEach((demoUser) => {
    if (!users.some((u) => u.email === demoUser.email)) {
      users.push(demoUser);
    }
  });
  saveUsersToStorage(users);

  const sampleData = [
      {
        id: "RP-2026-881232",
        name: "Yashaswin Ruttala",
        email: "yashaswin@rallypoint.org",
        phone: "555-111-2222",
        skill: "Intermediate",
        age: "Adult (18+)",
        date: "2026-05-27",
        session: "morning",
        createdAt: new Date().toISOString()
      },
      {
        id: "RP-2026-990812",
        name: "Nikhilesh Meela",
        email: "nikhilesh@rallypoint.org",
        phone: "555-333-4444",
        skill: "Advanced",
        age: "Adult (18+)",
        date: "2026-05-27",
        session: "morning",
        createdAt: new Date().toISOString()
      },
      {
        id: "RP-2026-442890",
        name: "Alice Player",
        email: "alice@example.com",
        phone: "555-555-5555",
        skill: "Advanced",
        age: "Adult (18+)",
        date: "2026-05-29",
        session: "evening",
        createdAt: new Date().toISOString()
      }
    ];

  let bookings = getBookingsFromStorage();
  sampleData.forEach((sampleBooking) => {
    if (!bookings.some((b) => b.id === sampleBooking.id)) {
      bookings.push(sampleBooking);
    }
  });
  saveBookingsToStorage(bookings);
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
