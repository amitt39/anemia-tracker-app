import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function HomeScreen() {
  return <ThemedView style={styles.container}><SafeAreaView style={styles.content}>
    <ThemedText type="title" style={styles.title}>Anemia Tracker</ThemedText>
    <ThemedText style={styles.subtitle}>Support healthier students through simple, consistent iron tablet tracking.</ThemedText>
    <ThemedText style={styles.info}>Create a school account to manage teachers, students, and tablet courses in one place.</ThemedText>
    <Link href={'/school/register' as any} asChild><Pressable style={styles.button}><ThemedText style={styles.buttonText}>Register your school</ThemedText></Pressable></Link>
    <Link href={'/school/login' as any}><ThemedText style={styles.link}>Already registered? Sign in</ThemedText></Link>
  </SafeAreaView></ThemedView>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  title: { textAlign: 'center', fontSize: 38 },
  subtitle: { textAlign: 'center', fontSize: 18, lineHeight: 27 },
  info: { textAlign: 'center', maxWidth: 460, lineHeight: 24 },
  button: { backgroundColor: '#1769aa', borderRadius: 10, paddingHorizontal: 22, paddingVertical: 15, marginTop: Spacing.two },
  buttonText: { color: '#fff', fontWeight: '700' },
  link: { color: '#1769aa', padding: Spacing.two },
});
