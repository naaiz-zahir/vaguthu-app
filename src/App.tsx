import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { auth, firebaseEnabled } from './lib/firebase';
import { FirestoreStore, LocalStore, type DataStore } from './lib/store';
import type { Settings } from './lib/types';
import DayView from './components/DayView';
import CategoriesView from './components/CategoriesView';

// Charts are the heaviest dependency; load them only when the Reports tab opens.
const Reports = lazy(() => import('./components/Reports'));

type Tab = 'day' | 'reports' | 'categories';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'day', label: 'Log', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2' },
  { id: 'reports', label: 'Reports', icon: 'M5 20V11M12 20V5M19 20v-7' },
  { id: 'categories', label: 'Categories', icon: 'M4 6h16M4 12h16M4 18h10' },
];

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(firebaseEnabled ? undefined : null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (firebaseEnabled && user === undefined) return <div className="center muted">Loading…</div>;
  if (firebaseEnabled && !user) return <Login />;

  return <Main user={user ?? null} />;
}

function Login() {
  const [error, setError] = useState('');
  return (
    <div className="login">
      <h1>Vaguthu</h1>
      <p className="muted">Log how you spent your day and see where your time goes.</p>
      <button
        className="primary"
        onClick={() => {
          const provider = new GoogleAuthProvider();
          signInWithPopup(auth!, provider).catch((e) => {
            // Popups are often blocked in installed (home-screen) apps; fall back to a full-page redirect.
            if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) {
              signInWithRedirect(auth!, provider).catch((err) => setError(err.message));
            } else if (e.code !== 'auth/popup-closed-by-user') {
              setError(e.message);
            }
          });
        }}
      >
        Sign in with Google
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function Main({ user }: { user: User | null }) {
  const store: DataStore = useMemo(() => (user ? new FirestoreStore(user.uid) : new LocalStore()), [user]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<Tab>('day');
  const [error, setError] = useState('');
  const [localNoticeHidden, setLocalNoticeHidden] = useState(() => {
    try {
      return localStorage.getItem('vaguthu:hide-local-notice') === '1';
    } catch {
      return false;
    }
  });
  const hideLocalNotice = () => {
    setLocalNoticeHidden(true);
    try {
      localStorage.setItem('vaguthu:hide-local-notice', '1');
    } catch {
      // Private mode etc.: the notice just comes back next visit.
    }
  };

  useEffect(() => {
    store.loadSettings().then(setSettings, (e) => setError(String(e.message ?? e)));
  }, [store]);

  const updateSettings = (s: Settings) => {
    setSettings(s);
    store.saveSettings(s).catch((e) => setError(`Couldn't save settings: ${e.message ?? e}`));
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Vaguthu</span>
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => {
                setTab(t.id);
                window.scrollTo(0, 0);
              }}
            >
              <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d={t.icon} />
              </svg>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        {user && (
          <button className="ghost small" onClick={() => signOut(auth!)} title={user.email ?? ''}>
            Sign out
          </button>
        )}
      </header>

      {!firebaseEnabled && !localNoticeHidden && (
        <div className="banner">
          <span>
            Local mode: data is saved in this browser only. Add your Firebase config to <code>.env.local</code> to sync across devices.
          </span>
          <button className="ghost small banner-close" onClick={hideLocalNotice} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="banner error" onClick={() => setError('')}>
          {error}
        </div>
      )}

      <main>
        {!settings ? (
          <div className="center muted">Loading…</div>
        ) : tab === 'day' ? (
          <DayView store={store} settings={settings} onError={setError} />
        ) : tab === 'reports' ? (
          <Suspense fallback={<div className="center muted">Loading…</div>}>
            <Reports store={store} settings={settings} onError={setError} />
          </Suspense>
        ) : (
          <CategoriesView store={store} settings={settings} onChange={updateSettings} />
        )}
      </main>
    </div>
  );
}
