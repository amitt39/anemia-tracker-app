import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSchoolSession, getSchoolProfile } from './school/api';
import { clearTeacherSession, getTeacherProfile } from './teacher/api';

export default function HomeScreen() {
  const [destination, setDestination] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function restoreSession() {
      const schoolToken = await AsyncStorage.getItem('token');
      if (schoolToken) {
        try {
          await getSchoolProfile(schoolToken);
          if (mounted) {
            setDestination('/school/dashboard');
            setChecking(false);
          }
          return;
        } catch (error: any) {
          if (error.code === 'SESSION_EXPIRED' || !error.message?.startsWith('Unable to connect')) {
            await clearSchoolSession();
          }
        }
      }

      const teacherToken = await AsyncStorage.getItem('teacher_token');
      if (teacherToken) {
        try {
          await getTeacherProfile(teacherToken);
          if (mounted) {
            setDestination('/teacher/dashboard');
            setChecking(false);
          }
          return;
        } catch (error: any) {
          if (error.code === 'SESSION_EXPIRED' || !error.message?.startsWith('Unable to connect')) {
            await clearTeacherSession();
          }
        }
      }

      if (mounted) {
        setDestination('/school/login');
        setChecking(false);
      }
    }
    restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  if (destination) return <Redirect href={destination as any} />;
  return <SafeAreaView style={styles.container}><View style={styles.loading}><ActivityIndicator /></View></SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
