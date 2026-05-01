# Security

## Supported Surface

SCS Play is a client-side PWA with optional Firebase auth/cloud sync and a Capacitor Android shell. Treat all client code as public.

## Secrets

Never commit:

- `.env` or `.env.*` files except `.env.example`.
- Android keystores: `*.jks`, `*.keystore`, `*.p12`.
- Private keys or certificates: `*.pem`, `*.key`.
- `google-services.json`.
- APK/AAB build outputs.

The repo ignore rules cover these by default. If a secret is committed, rotate it immediately before cleanup.

## Firebase Rules

Use authenticated, per-user access for saves:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /saves/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Do not trust client-side score, purchase, or entitlement data for anything that has financial or competitive significance without a server-side verifier.

## Dependency Updates

Use `npm audit` and dependency release notes for upgrades. After any dependency or Capacitor change, run:

```bash
npm run verify
npm run cap:sync
```

## Reporting

Report security issues privately to the repository owner. Do not open public issues with exploit details or secrets.