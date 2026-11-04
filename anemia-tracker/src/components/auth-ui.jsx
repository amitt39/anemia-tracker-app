import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export const AUTH = {
  background: '#fcf9f4',
  surface: '#ffffff',
  surfaceLow: '#f6f3ee',
  surfaceHigh: '#ebe8e3',
  surfaceHighest: '#e5e2dd',
  primary: '#59253e',
  primaryContainer: '#743b55',
  secondary: '#97425d',
  secondaryFixed: '#ffd9e1',
  tertiary: '#1d3d33',
  tertiaryFixed: '#c7eadc',
  text: '#1c1c19',
  muted: '#514348',
  outline: '#837378',
  outlineVariant: '#d5c2c7',
  error: '#ba1a1a',
};

export function AuthLayout({ children }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AuthHeader({ title, onBack }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerAvatar}><Text style={styles.headerAvatarText}>●</Text></View>
    </View>
  );
}

export function InputField({ label, hint, icon, value, onChangeText, placeholder, secureTextEntry, onToggleSecure, editable = true, keyboardType = 'default', autoCapitalize = 'sentences', autoComplete }) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      <View style={[styles.inputWrap, !editable && styles.inputDisabled]}>
        <Text style={styles.inputIcon}>{icon}</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={AUTH.outline}
          secureTextEntry={secureTextEntry}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
        />
        {onToggleSecure ? (
          <Pressable onPress={onToggleSecure} style={styles.eyeButton} accessibilityRole="button" accessibilityLabel="Toggle password visibility">
            <Text style={styles.eyeIcon}>{secureTextEntry ? '◉' : '○'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function PrimaryButton({ label, loading, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={loading} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, loading && styles.disabled]}>
      {loading ? <ActivityIndicator color="#fff" /> : <><Text style={styles.primaryButtonText}>{label}</Text><Text style={styles.buttonArrow}>→</Text></>}
    </Pressable>
  );
}

export function InfoCard({ icon, title, children, tone = 'low' }) {
  return (
    <View style={[styles.infoCard, tone === 'high' && styles.infoCardHigh]}>
      <View style={styles.infoIcon}><Text style={styles.infoIconText}>{icon}</Text></View>
      <View style={styles.infoCopy}><Text style={styles.infoTitle}>{title}</Text><Text style={styles.infoText}>{children}</Text></View>
    </View>
  );
}

export function FormCard({ children }) {
  return <View style={styles.formCard}>{children}</View>;
}

export function ErrorText({ children }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

export function HintText({ children, positive = false }) {
  return <Text style={[styles.hintText, positive && styles.positiveHint]}>{positive ? '✓  ' : '•  '}{children}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AUTH.background },
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 32 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: AUTH.primaryContainer, fontSize: 34, lineHeight: 36, fontWeight: '300' },
  headerTitle: { flex: 1, color: AUTH.primary, fontFamily: 'Georgia', fontSize: 20, fontWeight: '600', marginLeft: 2 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: AUTH.primary, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#fff', fontSize: 13 },
  hero: { backgroundColor: AUTH.surfaceLow, borderRadius: 16, padding: 20, marginBottom: 16, overflow: 'hidden' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: AUTH.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  heroIconText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  eyebrow: { color: AUTH.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  heroTitle: { color: AUTH.primary, fontFamily: 'Georgia', fontSize: 26, lineHeight: 34, fontWeight: '500' },
  heroText: { color: AUTH.muted, fontSize: 14, lineHeight: 22, marginTop: 10 },
  reminder: { flexDirection: 'row', gap: 10, backgroundColor: '#ebe8e3aa', padding: 14, borderRadius: 12, marginBottom: 16 },
  reminderIcon: { color: AUTH.secondary, fontSize: 18, fontWeight: '700' },
  reminderText: { flex: 1, color: AUTH.muted, fontSize: 12, lineHeight: 19 },
  reminderLink: { color: AUTH.primary, fontWeight: '700' },
  formCard: { backgroundColor: AUTH.surface, borderRadius: 16, padding: 20, shadowColor: AUTH.primary, shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 },
  institutionBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#f6f3eeaa', marginBottom: 16 },
  institutionIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: AUTH.tertiaryFixed, color: AUTH.tertiary, textAlign: 'center', textAlignVertical: 'center', fontSize: 18, fontWeight: '700' },
  institutionCopy: { flex: 1 },
  institutionTitle: { color: AUTH.primary, fontSize: 12, fontWeight: '700' },
  institutionText: { color: AUTH.muted, fontSize: 12, marginTop: 2 },
  inlineLink: { color: AUTH.secondary, textAlign: 'center', fontSize: 12, fontWeight: '700', marginTop: 14 },
  field: { marginBottom: 16 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  fieldLabel: { color: AUTH.text, fontSize: 14, fontWeight: '700' },
  fieldHint: { color: AUTH.muted, fontSize: 11 },
  fieldHelper: { color: AUTH.muted, fontSize: 12, lineHeight: 18, marginTop: -8, marginBottom: 14 },
  inputWrap: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: AUTH.outlineVariant, borderRadius: 12, backgroundColor: AUTH.surface },
  inputDisabled: { backgroundColor: AUTH.surfaceLow },
  inputIcon: { width: 42, textAlign: 'center', color: AUTH.outline, fontSize: 18 },
  input: { flex: 1, minHeight: 46, color: AUTH.text, fontSize: 14, paddingVertical: 10, paddingRight: 8 },
  eyeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  eyeIcon: { color: AUTH.muted, fontSize: 18 },
  hintText: { color: AUTH.muted, fontSize: 12, lineHeight: 18, marginTop: -8, marginBottom: 14 },
  positiveHint: { color: AUTH.tertiary },
  error: { color: AUTH.error, backgroundColor: '#ffdad6', padding: 10, borderRadius: 8, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  primaryButton: { minHeight: 48, borderRadius: 12, backgroundColor: AUTH.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: AUTH.primary, shadowOpacity: 0.18, shadowRadius: 5, elevation: 2 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  buttonArrow: { color: '#fff', fontSize: 19 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.7 },
  infoCard: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: AUTH.surfaceLow, marginTop: 20 },
  infoCardHigh: { backgroundColor: '#ebe8e3aa', marginTop: 0, marginBottom: 16 },
  infoIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: AUTH.secondaryFixed, alignItems: 'center', justifyContent: 'center' },
  infoIconText: { color: AUTH.primary, fontSize: 18, fontWeight: '700' },
  infoCopy: { flex: 1 },
  infoTitle: { color: AUTH.primary, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  infoText: { color: AUTH.muted, fontSize: 12, lineHeight: 18 },
  footerLinks: { alignItems: 'center', gap: 12, marginTop: 20 },
  footerLink: { color: AUTH.secondary, fontSize: 14, fontWeight: '700', paddingVertical: 4 },
  footerMuted: { color: AUTH.muted, fontSize: 12, paddingVertical: 4 },
  recoveryFooter: { color: AUTH.muted, textAlign: 'center', fontSize: 12, marginTop: 20 },
  section: { backgroundColor: AUTH.surface, borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: AUTH.primary, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AUTH.secondary },
  sectionTitle: { color: AUTH.primary, fontSize: 16, fontWeight: '700' },
  privacy: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 12, backgroundColor: AUTH.surfaceLow, marginBottom: 16 },
  privacyIcon: { color: AUTH.secondary, fontSize: 18, fontWeight: '700' },
  privacyText: { flex: 1, color: AUTH.muted, fontSize: 12, lineHeight: 18 },
  registrationIntro: { paddingTop: 8, paddingBottom: 20 },
  registrationBadge: { alignSelf: 'flex-start', backgroundColor: AUTH.secondaryFixed, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, color: '#3f001b', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  registrationTitle: { color: AUTH.primary, fontFamily: 'Georgia', fontSize: 28, lineHeight: 36, fontWeight: '500' },
  registrationText: { color: AUTH.muted, fontSize: 14, lineHeight: 22, marginTop: 8 },
  profileLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: AUTH.background },
  profileLoadingText: { color: AUTH.muted, fontSize: 13 },
  profileIntro: { paddingTop: 8, paddingBottom: 18 },
  profileSuccess: { backgroundColor: AUTH.tertiaryFixed, borderRadius: 10, padding: 11, marginBottom: 12 },
  profileSuccessText: { color: AUTH.tertiary, fontSize: 13, fontWeight: '600' },
  profileSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  profileSectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AUTH.secondary },
  profileSectionTitle: { color: AUTH.primary, fontSize: 16, fontWeight: '700' },
  profileSectionHint: { color: AUTH.muted, fontSize: 12, lineHeight: 18, marginTop: -8, marginBottom: 16 },
  profileAccountMeta: { paddingHorizontal: 4, paddingTop: 2, paddingBottom: 8 },
  profileAccountMetaTitle: { color: AUTH.primary, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  profileAccountMetaText: { color: AUTH.muted, fontSize: 12, lineHeight: 19 },
  profileSignOut: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: AUTH.outlineVariant, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 8 },
  profileSignOutText: { color: AUTH.secondary, fontSize: 14, fontWeight: '700' },
  profileCancelPassword: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  profileCancelPasswordText: { color: AUTH.muted, fontSize: 14, fontWeight: '600' },
});

export const authStyles = styles;
