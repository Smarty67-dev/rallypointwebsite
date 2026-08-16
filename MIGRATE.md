Safe migration guide

This project includes a serverless endpoint to migrate local `rally_users` into Firebase Auth and Firestore.

Files added:
- `api/migrate-users.js` — Vercel serverless function using Firebase Admin SDK.

Requirements (Vercel):
1. Set `FIREBASE_SERVICE_ACCOUNT` to the stringified JSON service account (Service Account JSON from Firebase -> Project Settings -> Service accounts -> Generate new private key). In Vercel, create a new Environment Variable and paste the entire JSON as the value.
2. Set `MIGRATE_SECRET` to a long random string (keeps the endpoint protected).
3. Deploy to Vercel.

How it works:
- POST to `/api/migrate-users` with header `Authorization: Bearer <MIGRATE_SECRET>` and JSON body `{ users: [...] }`.
- Each user object should include: `{ name, email, phone, password }` (password optional).
- The function will attempt to `createUser` using the Admin SDK; if the user already exists, it updates the Firestore profile.
- The function returns `resetLink` values for each user so you can send password reset links to users securely.

Browser snippet (run in DevTools Console locally after you have local users):

const users = JSON.parse(localStorage.getItem('rally_users') || '[]');
fetch('https://<YOUR_DEPLOYED_URL>/api/migrate-users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <MIGRATE_SECRET>'
  },
  body: JSON.stringify({ users })
}).then(r => r.json()).then(console.log).catch(console.error);

Replace `<YOUR_DEPLOYED_URL>` and `<MIGRATE_SECRET>` with your deployed site URL and the secret you set in Vercel. The response contains password reset links you can send to users.

Security notes:
- Do not commit service account JSON or migrate secret to source control.
- After migration, rotate credentials if needed and remove the migrate endpoint or disable it.
