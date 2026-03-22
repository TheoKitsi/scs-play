/* ─── Authentication service ───
 *  Supports:  Guest (localStorage), Firebase Email, Google, Apple
 *  Firebase is loaded dynamically from CDN — if config is empty the app
 *  gracefully falls back to guest-only mode.
 */

import { t } from './i18n.js';

/* ══════════════════════════════════════════════════════
 *  🔧  FIREBASE CONFIG — fill in YOUR project values
 * ══════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey:            '',
  authDomain:        '',
  projectId:         '',
  storageBucket:     '',
  messagingSenderId: '',
  appId:             ''
};
/* ════════════════════════════════════════════════════ */

let fb  = null;   // firebase modules cache
let app = null;
let auth = null;
let db   = null;

async function loadFirebase() {
  if (fb) return true;
  if (!FIREBASE_CONFIG.apiKey) return false;

  try {
    const [appMod, authMod, dbMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
    ]);

    app  = appMod.initializeApp(FIREBASE_CONFIG);
    auth = authMod.getAuth(app);
    db   = dbMod.getFirestore(app);

    fb = { ...authMod, ...dbMod };
    return true;
  } catch (e) {
    return false;
  }
}

export class AuthService {
  constructor() {
    this.user     = null;   // { id, name, email, provider }
    this.isGuest  = true;
    this.fbReady  = false;
    this._cbs     = [];
  }

  /* ── Initialise ── */
  async init() {
    this.fbReady = await loadFirebase();

    if (this.fbReady) {
      await new Promise(resolve => {
        fb.onAuthStateChanged(auth, u => {
          if (u) {
            this.user = {
              id:       u.uid,
              name:     u.displayName || u.email?.split('@')[0] || t('guest_short'),
              email:    u.email,
              provider: u.providerData?.[0]?.providerId || 'firebase'
            };
            this.isGuest = false;
          } else {
            this._checkGuest();
          }
          this._notify();
          resolve();
        });
      });
    } else {
      this._checkGuest();
      this._notify();
    }
  }

  _checkGuest() {
    const raw = localStorage.getItem('scs_guest');
    if (raw) {
      try { this.user = JSON.parse(raw); this.isGuest = true; } catch (_) {}
    }
  }

  /* ── Sign-in methods ── */
  async signInWithGoogle() {
    this._assertFb();
    const provider = new fb.GoogleAuthProvider();
    await fb.signInWithPopup(auth, provider);
  }

  async signInWithApple() {
    this._assertFb();
    const provider = new fb.OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    await fb.signInWithPopup(auth, provider);
  }

  async signInWithEmail(email, password) {
    this._assertFb();
    await fb.signInWithEmailAndPassword(auth, email, password);
  }

  async registerWithEmail(email, password, displayName) {
    this._assertFb();
    const cred = await fb.createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await fb.updateProfile(cred.user, { displayName });
  }

  signInAsGuest() {
    this.user = {
      id:       'guest_' + Date.now(),
      name:     t('guest_short'),
      email:    null,
      provider: 'guest'
    };
    this.isGuest = true;
    localStorage.setItem('scs_guest', JSON.stringify(this.user));
    this._notify();
  }

  async signOut() {
    if (this.fbReady && auth) {
      try { await fb.signOut(auth); } catch (_) {}
    }
    this.user    = null;
    this.isGuest = true;
    localStorage.removeItem('scs_guest');
    this._notify();
  }

  /* ── Firestore helpers (used by SaveService) ── */
  async cloudSave(path, data) {
    if (!this.fbReady || this.isGuest || !db) return;
    await fb.setDoc(fb.doc(db, path, this.user.id), data, { merge: true });
  }

  async cloudLoad(path) {
    if (!this.fbReady || this.isGuest || !db) return null;
    const snap = await fb.getDoc(fb.doc(db, path, this.user.id));
    return snap.exists() ? snap.data() : null;
  }

  /* ── Listener ── */
  onAuthStateChanged(cb) { this._cbs.push(cb); }
  _notify() { this._cbs.forEach(c => c(this.user, this.isGuest)); }
  _assertFb() { if (!this.fbReady) throw new Error('Firebase not configured'); }
}
