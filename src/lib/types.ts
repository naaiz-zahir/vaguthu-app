export interface Category {
  id: string;
  name: string;
  color: string;
  archived?: boolean;
}

/** A block of time within a single day. start/end are minutes from midnight (0–1440). */
export interface Entry {
  id: string;
  start: number;
  end: number;
  categoryId: string;
  note?: string;
}

export interface DayDoc {
  date: string; // yyyy-MM-dd
  entries: Entry[];
}

export interface Settings {
  categories: Category[];
  /** 0 = Sunday, 1 = Monday, 6 = Saturday */
  weekStartsOn: 0 | 1 | 6;
}

export const MINUTES_PER_DAY = 1440;
export const SLOT_MINUTES = 15;
export const SLOTS_PER_DAY = MINUTES_PER_DAY / SLOT_MINUTES;
