import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_SETTINGS } from './defaults';
import type { DayDoc, Settings } from './types';

export interface DataStore {
  loadSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  /** All stored days with from <= date <= to (yyyy-MM-dd, inclusive). */
  loadDays(from: string, to: string): Promise<Map<string, DayDoc>>;
  saveDay(day: DayDoc): Promise<void>;
}

export class FirestoreStore implements DataStore {
  constructor(private uid: string) {}

  private get user() {
    return doc(db!, 'users', this.uid);
  }

  async loadSettings(): Promise<Settings> {
    const snap = await getDoc(this.user);
    const data = snap.data() as Partial<Settings> | undefined;
    if (!data?.categories) {
      await this.saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...data } as Settings;
  }

  async saveSettings(s: Settings): Promise<void> {
    await setDoc(this.user, stripUndefined(s), { merge: true });
  }

  async loadDays(from: string, to: string): Promise<Map<string, DayDoc>> {
    const q = query(collection(this.user, 'days'), where('date', '>=', from), where('date', '<=', to));
    const snap = await getDocs(q);
    const out = new Map<string, DayDoc>();
    snap.forEach((d) => {
      const day = d.data() as DayDoc;
      out.set(day.date, day);
    });
    return out;
  }

  async saveDay(day: DayDoc): Promise<void> {
    await setDoc(doc(this.user, 'days', day.date), stripUndefined(day));
  }
}

/** Fallback used when Firebase isn't configured: data lives in this browser only. */
export class LocalStore implements DataStore {
  private key = 'vaguthu:v1';

  private read(): { settings?: Settings; days: Record<string, DayDoc> } {
    try {
      return JSON.parse(localStorage.getItem(this.key) ?? '') ?? { days: {} };
    } catch {
      return { days: {} };
    }
  }

  private write(v: { settings?: Settings; days: Record<string, DayDoc> }) {
    localStorage.setItem(this.key, JSON.stringify(v));
  }

  async loadSettings() {
    return this.read().settings ?? DEFAULT_SETTINGS;
  }

  async saveSettings(s: Settings) {
    this.write({ ...this.read(), settings: s });
  }

  async loadDays(from: string, to: string) {
    const out = new Map<string, DayDoc>();
    for (const d of Object.values(this.read().days)) if (d.date >= from && d.date <= to) out.set(d.date, d);
    return out;
  }

  async saveDay(day: DayDoc) {
    const v = this.read();
    v.days[day.date] = day;
    this.write(v);
  }
}

// Firestore rejects `undefined` field values.
function stripUndefined<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
