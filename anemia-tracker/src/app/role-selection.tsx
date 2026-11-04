import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AUTH } from '../components/auth-ui';
import { getStoredSessionDestination } from '../lib/navigation';

export default function RoleSelection() {
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    getStoredSessionDestination().then((destination) => {
      if (!mounted) return;
      if (destination) {
        router.replace(destination as any);
        return;
      }
      setCheckingSession(false);
    }).catch(() => {
      if (mounted) setCheckingSession(false);
    });
    return () => { mounted = false; };
  }, []);

  if (checkingSession) {
    return <SafeAreaView style={styles.page}><ActivityIndicator color={AUTH.primary} /><Text style={styles.loadingText}>Checking your session…</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>+</Text></View>
        <Text style={styles.eyebrow}>Anemia Tracker</Text>
        <Text style={styles.title}>How will you use the app?</Text>
        <Text style={styles.subtitle}>Choose your workspace to continue.</Text>

        <Pressable style={styles.button} onPress={() => router.push('/school/login')}>
          <View style={[styles.icon, styles.schoolIcon]}><Text style={styles.iconText}>S</Text></View>
          <View style={styles.buttonCopy}><Text style={styles.buttonText}>School admin</Text>
          <Text style={styles.buttonHint}>Register or sign in as a school admin</Text>
          </View><Text style={styles.arrow}>→</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => router.push('/teacher/login')}>
          <View style={[styles.icon, styles.teacherIcon]}><Text style={styles.iconText}>T</Text></View>
          <View style={styles.buttonCopy}><Text style={styles.buttonText}>Teacher</Text>
          <Text style={styles.buttonHint}>Sign in to your teacher account</Text>
          </View><Text style={styles.arrow}>→</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => router.push('/parent/login')}>
          <View style={[styles.icon, styles.parentIcon]}><Text style={styles.iconText}>P</Text></View>
          <View style={styles.buttonCopy}><Text style={styles.buttonText}>Parent</Text>
          <Text style={styles.buttonHint}>Sign in with your phone and OTP</Text>
          </View><Text style={styles.arrow}>→</Text>
        </Pressable>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: AUTH.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  loadingText: { color: AUTH.muted, fontSize: 13, marginTop: 10, textAlign: 'center' },
  card: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  brandMark: { width: 48, height: 48, borderRadius: 15, backgroundColor: AUTH.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  brandMarkText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  eyebrow: { color: AUTH.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: 'Georgia', fontSize: 30, fontWeight: '500', color: AUTH.primary, marginBottom: 8 },
  subtitle: { color: AUTH.muted, marginBottom: 24, fontSize: 14 },
  button: { backgroundColor: AUTH.surface, borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 15, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  schoolIcon: { backgroundColor: AUTH.secondaryFixed },
  teacherIcon: { backgroundColor: AUTH.tertiaryFixed },
  parentIcon: { backgroundColor: AUTH.surfaceHigh },
  iconText: { color: AUTH.primary, fontSize: 17, fontWeight: '700' },
  buttonCopy: { flex: 1 },
  buttonText: { color: AUTH.primary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  buttonHint: { color: AUTH.muted, fontSize: 12 },
  arrow: { color: AUTH.secondary, fontSize: 20, fontWeight: '700' },
});
