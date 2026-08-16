/*
Serverless migration endpoint for Vercel.
- Requires env var FIREBASE_SERVICE_ACCOUNT containing the JSON service account (stringified)
- Requires env var MIGRATE_SECRET set to a secret token; requests must include header Authorization: Bearer <MIGRATE_SECRET>

Request (POST JSON): { users: [ { name, email, phone, password } ] }
Response: { success: n, skipped: n, failed: n, results: [ { email, status, message, resetLink? } ] }

Security: Keep MIGRATE_SECRET private. Do NOT commit secrets to the repo.
*/

const admin = require('firebase-admin');

function initAdmin() {
  if (global.__admin_inited) return admin;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  let creds;
  try { creds = JSON.parse(sa); } catch (e) { throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON'); }
  admin.initializeApp({ credential: admin.credential.cert(creds) });
  global.__admin_inited = true;
  return admin;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const auth = req.headers.authorization || '';
  const expected = process.env.MIGRATE_SECRET;
  if (!expected) return res.status(500).json({ error: 'Server not configured: MIGRATE_SECRET missing' });
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let users = [];
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }
  users = body && Array.isArray(body.users) ? body.users : [];

  let adminSdk;
  try {
    adminSdk = initAdmin();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const firestore = adminSdk.firestore();

  const results = [];
  let success = 0, skipped = 0, failed = 0;

  for (const u of users) {
    const email = (u.email || '').trim().toLowerCase();
    if (!email) {
      results.push({ email: null, status: 'failed', message: 'missing email' });
      failed++; continue;
    }

    try {
      // Try to create user with a temporary random password if not provided
      const tempPass = u.password && typeof u.password === 'string' && u.password.length >= 6 ? u.password : (Math.random().toString(36).slice(-10) + 'A1');
      const created = await adminSdk.auth().createUser({ email, password: tempPass, displayName: u.name || '' });
      const uid = created.uid;
      const profile = { name: u.name || '', email, phone: u.phone || '', uid };
      try { await firestore.collection('users').doc(uid).set(profile); } catch (e) { console.warn('profile save failed', e); }
      // Generate password reset link so user can set their own password securely
      let resetLink = null;
      try { resetLink = await adminSdk.auth().generatePasswordResetLink(email); } catch (e) { console.warn('reset link failed', e); }
      results.push({ email, status: 'created', message: 'user created', resetLink });
      success++;
    } catch (err) {
      // If the user already exists, skip
      const code = err.code || err.message || '';
      if (code.includes('auth/email-already-exists') || code.includes('auth/email-already-in-use')) {
        // Optionally update profile in Firestore
        try {
          const existing = await adminSdk.auth().getUserByEmail(email);
          const uid = existing.uid;
          const profile = { name: u.name || '', email, phone: u.phone || '', uid };
          try { await firestore.collection('users').doc(uid).set(profile, { merge: true }); } catch (e) { console.warn('profile save failed for existing', e); }
          // Generate password reset link
          let resetLink = null;
          try { resetLink = await adminSdk.auth().generatePasswordResetLink(email); } catch (e) { console.warn('reset link failed', e); }
          results.push({ email, status: 'exists', message: 'already exists - profile updated', resetLink });
          skipped++;
        } catch (e2) {
          results.push({ email, status: 'failed', message: String(e2) });
          failed++;
        }
      } else {
        results.push({ email, status: 'failed', message: String(err) });
        failed++;
      }
    }
  }

  res.status(200).json({ success, skipped, failed, results });
};
