import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Auth screens can be opened directly from a URL, so there may not be a
 * history entry to return to. Always provide a deterministic destination.
 */
export function goBackOr(fallback) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}

export async function hasStoredSession(storageKey) {
  return Boolean(await AsyncStorage.getItem(storageKey));
}

export async function getStoredSessionDestination() {
  const values = await AsyncStorage.multiGet(['token', 'teacher_token', 'parent_token']);
  const sessions = Object.fromEntries(values);
  if (sessions.token) return '/school/dashboard';
  if (sessions.teacher_token) return '/teacher/dashboard';
  if (sessions.parent_token) return '/parent/dashboard';
  return '';
}
