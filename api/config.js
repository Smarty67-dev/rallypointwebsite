// Vercel Serverless Function: returns runtime config (read from ENV vars)
// Set the following environment variables in your Vercel project to override:
// RALLY_NOTIFY_EMAIL
// RALLY_FIREBASE_API_KEY
// RALLY_FIREBASE_AUTH_DOMAIN
// RALLY_FIREBASE_PROJECT_ID
// RALLY_FIREBASE_STORAGE_BUCKET
// RALLY_FIREBASE_MESSAGING_SENDER_ID
// RALLY_FIREBASE_APP_ID
// RALLY_RESET_BOOKINGS_ON_LOAD

module.exports = (req, res) => {
  const cfg = {
    notifyEmail: process.env.RALLY_NOTIFY_EMAIL || null,
    firebaseConfig: {
      apiKey: process.env.RALLY_FIREBASE_API_KEY || null,
      authDomain: process.env.RALLY_FIREBASE_AUTH_DOMAIN || null,
      projectId: process.env.RALLY_FIREBASE_PROJECT_ID || null,
      storageBucket: process.env.RALLY_FIREBASE_STORAGE_BUCKET || null,
      messagingSenderId: process.env.RALLY_FIREBASE_MESSAGING_SENDER_ID || null,
      appId: process.env.RALLY_FIREBASE_APP_ID || null
    },
    resetBookingsOnLoad: (process.env.RALLY_RESET_BOOKINGS_ON_LOAD || '').toLowerCase() === 'true'
  };

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify(cfg));
};
