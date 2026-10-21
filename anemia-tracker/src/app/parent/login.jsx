import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import {
  requestParentOtp,
  validateIndianMobileNumber,
  verifyParentOtp,
} from "../school/api";
export default function ParentLogin() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit() {
    if (busy) return;
    const validation = validateIndianMobileNumber(phone);
    if (!validation.valid)
      return setMessage(
        validation.reason === "incomplete"
          ? "Enter a complete 10-digit Indian mobile number."
          : validation.reason === "prefix"
            ? "Indian mobile numbers must start with 6, 7, 8, or 9."
            : "Enter a valid Indian mobile number.",
      );
    if (sent && !/^\d{6}$/.test(otp))
      return setMessage("Enter the 6-digit OTP.");
    setBusy(true);
    setMessage("");
    try {
      if (!sent) {
        await requestParentOtp(validation.normalized);
        setSent(true);
        setMessage("OTP sent.");
      } else {
        const r = await verifyParentOtp(validation.normalized, otp);
        await AsyncStorage.setItem("parent_token", r.token);
        await AsyncStorage.setItem("parent_id", String(r.parent_id));
        await AsyncStorage.setItem("parent_phone", validation.normalized);
        router.replace("/parent/dashboard");
      }
    } catch (e) {
      setMessage(e.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={s.page}>
      <View style={s.card}>
        {[
          <Text key="title" style={s.title}>
            Parent sign in
          </Text>,
          <TextInput
            key="phone"
            style={s.input}
            placeholder="Phone number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />,
          sent ? (
            <TextInput
              key="otp"
              style={s.input}
              placeholder="6-digit OTP"
              keyboardType="numeric"
              value={otp}
              onChangeText={setOtp}
            />
          ) : null,
          message ? (
            <Text key="message" style={s.message}>
              {message}
            </Text>
          ) : null,
          <Pressable
            key="submit"
            disabled={busy}
            style={s.button}
            onPress={submit}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.buttonText}>
                {sent ? "Verify OTP" : "Send OTP"}
              </Text>
            )}
          </Pressable>,
        ]}
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#f5f7fa",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 12,
    gap: 12,
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
  },
  title: { fontSize: 26, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#d0d5dd",
    borderRadius: 8,
    padding: 12,
  },
  button: {
    backgroundColor: "#1769aa",
    padding: 13,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  message: { color: "#b42318" },
});
