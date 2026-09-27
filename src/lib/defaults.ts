import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  weekStartsOn: 0,
  categories: [
    { id: 'work', name: 'Work', color: '#2a78d6' },
    { id: 'sleep', name: 'Sleep', color: '#4a3aa7' },
    { id: 'exercise', name: 'Exercise', color: '#1baf7a' },
    { id: 'meals', name: 'Meals', color: '#eda100' },
    { id: 'commute', name: 'Commute', color: '#8a5a44' },
    { id: 'leisure', name: 'Leisure', color: '#e87ba4' },
    { id: 'chores', name: 'Chores', color: '#eb6834' },
    { id: 'social', name: 'Social', color: '#e34948' },
    { id: 'learning', name: 'Learning / Study', color: '#008300' },
    { id: 'prayer', name: 'Prayer / Spiritual', color: '#0d9fb5' },
    { id: 'social-media', name: 'Social media', color: '#9b59d0' },
    { id: 'tv', name: 'TV / Streaming', color: '#6b7f1a' },
  ],
};
