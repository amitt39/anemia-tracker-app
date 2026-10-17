import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSchoolSession, getSchoolProfile } from './school/api';

export default function HomeScreen() {
  const [destination, setDestination] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function restoreSession() {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        if (mounted) { setDestination('/school/login'); setChecking(false); }
        return;
      }
      try {
        await getSchoolProfile(token);
        if (mounted) setDestination('/school/dashboard');
      } catch (error: any) {
        if (error.code === 'SESSION_EXPIRED' || !error.message?.startsWith('Unable to connect')) {
          await clearSchoolSession();
        }
        if (mounted) setDestination('/school/login');
      } finally {
        if (mounted) setChecking(false);
      }
    }
    restoreSession();
    return () => { mounted = false; };
  }, []);

  if (destination) return <Redirect href={destination as any} />;
  return <SafeAreaView style={styles.container}><View style={styles.loading}><ActivityIndicator /></View></SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
