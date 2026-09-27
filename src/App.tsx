import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, firebaseEnabled } from './lib/firebase';
import { FirestoreStore, LocalStore, type DataStore } from './lib/store';
import type { Settings } from './lib/types';
import DayView from './components/DayView';
import CategoriesView from './components/CategoriesView';

// Charts are the heaviest dependency; load them only when the Reports tab opens.
const Reports = lazy(() => import('./components/Reports'));

type Tab = 'day' | 'reports' | 'categories';

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
        onClick={() => signInWithPopup(auth!, new GoogleAuthProvider()).catch((e) => setError(e.message))}
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
          {(['day', 'reports', 'categories'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'day' ? 'Log' : t === 'reports' ? 'Reports' : 'Categories'}
            </button>
          ))}
        </nav>
        {user && (
          <button className="ghost small" onClick={() => signOut(auth!)} title={user.email ?? ''}>
            Sign out
          </button>
        )}
      </header>

      {!firebaseEnabled && (
        <div className="banner">
          Local mode: data is saved in this browser only. Add your Firebase config to <code>.env.local</code> to sync across devices.
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
