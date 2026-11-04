import { Redirect, router } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSchoolSession, getMyParentStudents, getSchoolProfile } from '../lib/school-api';
import { clearTeacherSession, getTeacherProfile } from '../lib/teacher-api';

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

      const parentToken = await AsyncStorage.getItem('parent_token');
      if (parentToken) {
        try {
          await getMyParentStudents(parentToken);
          if (mounted) {
            setDestination('/parent/dashboard');
            setChecking(false);
          }
          return;
        } catch (error: any) {
          if (error.code === 'SESSION_EXPIRED' || !error.message?.startsWith('Unable to connect')) {
            await Promise.all([
              AsyncStorage.removeItem('parent_token'),
              AsyncStorage.removeItem('parent_id'),
              AsyncStorage.removeItem('parent_phone'),
            ]);
          }
        }
      }

      if (mounted) setChecking(false);
    }
    restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  if (destination) return <Redirect href={destination as any} />;
  if (checking) return <SafeAreaView style={styles.container}><View style={styles.loading}><ActivityIndicator /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <View style={styles.logoOuter}>
            <View style={styles.logoInner}>
              <Text style={styles.logoDrop}>●</Text>
            </View>
            <View style={styles.logoPlus}><Text style={styles.plus}>+</Text></View>
          </View>
          <View style={styles.programPill}>
            <View style={styles.programDot} />
            <Text style={styles.programText}>SCHOOL HEALTH PROGRAM</Text>
          </View>
          <Text style={styles.title}>Anemia Tracker</Text>
          <Text style={styles.subtitle}>School health records, made simpler.</Text>
          <Text style={styles.description}>
            Maintain student health records, hemoglobin (Hb) test measurements, and iron/folic acid supplementation workflows in one trusted place.
          </Text>
        </View>

        <View style={styles.protocolCard}>
          <Image
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD54GEmXywQCRBWpXU8xjgT_XeEzTFiprRv7pKgeupwbWIK8JONWC1c9H5Y1E-A90koOe8svcAJbe7p3TzhkY55v3mjqU184AX5dnqiEblwIspys7WCty110iDLA3WYTVP6CWXyoQ21ZADNENvNv3ZynBzisK3cQQSdNwhYfCf2F3eAFKIdkU6FZTo7dV60ufdmlLx92p-zhOHukie3pLhj9EImdeI2EndOuI5UZU5Z9GpgQSqeLjt-PA' }}
            style={styles.heroImage}
          />
          <View style={styles.protocolFooter}>
            <Text style={styles.protocolIcon}>✓</Text>
            <Text style={styles.protocolText}>Verified Clinical Hb Protocol</Text>
            <Text style={styles.activeTerm}>Active Term</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <ActionButton icon="▣" label="School Admin Login" primary onPress={() => router.push('/school/login')} />
          <ActionButton icon="＋" label="Register Your School" onPress={() => router.push('/school/register')} />
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerLabel}>OR SIGN IN WITH ANOTHER ROLE</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.roleList}>
          <RoleButton icon="▦" title="Teacher Login" description="Access your classroom roster & log doses" onPress={() => router.push('/teacher/login')} />
          <RoleButton icon="♧" title="Parent Login" description="View verified health records with phone OTP" secondary onPress={() => router.push('/parent/login')} />
        </View>

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>▣  CONFIDENTIAL & PROTECTED</Text>
          <Text style={styles.privacyText}>
            Designed for school health coordinators, educators, and guardians. Standard data privacy and role access controls enforced.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({ icon, label, primary = false, onPress }: { icon: string; label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.actionButton, primary ? styles.primaryButton : styles.secondaryButton, pressed && styles.pressed]} onPress={onPress}>
      <Text style={[styles.actionIcon, primary ? styles.primaryButtonText : styles.secondaryButtonText]}>{icon}</Text>
      <Text style={primary ? styles.primaryButtonText : styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function RoleButton({ icon, title, description, secondary = false, onPress }: { icon: string; title: string; description: string; secondary?: boolean; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.roleButton, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.roleIcon, secondary && styles.roleIconSecondary]}><Text style={styles.roleIconText}>{icon}</Text></View>
      <View style={styles.roleCopy}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleDescription} numberOfLines={1}>{description}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcf9f4' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  intro: { alignItems: 'center', paddingBottom: 24 },
  logoOuter: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffd9e1', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#743b55', alignItems: 'center', justifyContent: 'center' },
  logoDrop: { color: '#fff', fontSize: 25 },
  logoPlus: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  plus: { color: '#59253e', fontSize: 18, fontWeight: '700', lineHeight: 21 },
  programPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#ebe8e3', marginBottom: 8 },
  programDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#59253e' },
  programText: { color: '#514348', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  title: { fontFamily: 'Georgia', fontSize: 30, lineHeight: 38, fontWeight: '500', color: '#1c1c19', marginBottom: 4 },
  subtitle: { color: '#59253e', fontSize: 16, lineHeight: 24, fontWeight: '600', marginBottom: 10 },
  description: { maxWidth: 340, color: '#514348', textAlign: 'center', fontSize: 14, lineHeight: 22 },
  protocolCard: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#f6f3ee', marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  heroImage: { width: '100%', height: 144, backgroundColor: '#f0ede9' },
  protocolFooter: { minHeight: 50, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center' },
  protocolIcon: { color: '#1d3d33', fontSize: 20, fontWeight: '700', marginRight: 8 },
  protocolText: { flex: 1, color: '#1c1c19', fontSize: 12, fontWeight: '600' },
  activeTerm: { color: '#1d3d33', backgroundColor: '#c7eadc', fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  actions: { gap: 12, marginBottom: 24 },
  actionButton: { width: '100%', height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  primaryButton: { backgroundColor: '#743b55' },
  secondaryButton: { backgroundColor: '#fff' },
  actionIcon: { fontSize: 18, fontWeight: '700' },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryButtonText: { color: '#59253e', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  divider: { flex: 1, height: 1, backgroundColor: '#e5e2dd' },
  dividerLabel: { color: '#514348', backgroundColor: '#fcf9f4', paddingHorizontal: 12, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  roleList: { gap: 12, marginBottom: 32 },
  roleButton: { width: '100%', minHeight: 76, padding: 16, borderRadius: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  roleIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f0ede9', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  roleIconSecondary: { backgroundColor: '#f0ede9' },
  roleIconText: { color: '#59253e', fontSize: 21, fontWeight: '700' },
  roleCopy: { flex: 1, minWidth: 0 },
  roleTitle: { color: '#1c1c19', fontSize: 16, lineHeight: 24, fontWeight: '700' },
  roleDescription: { color: '#514348', fontSize: 12, lineHeight: 18 },
  chevron: { color: '#837378', fontSize: 28, lineHeight: 28, marginLeft: 8 },
  privacyCard: { padding: 14, borderRadius: 12, backgroundColor: '#f6f3ee', alignItems: 'center', gap: 6 },
  privacyTitle: { color: '#514348', fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  privacyText: { maxWidth: 340, color: '#514348', textAlign: 'center', fontSize: 12, lineHeight: 18 },
});
