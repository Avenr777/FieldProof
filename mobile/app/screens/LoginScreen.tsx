import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../../hooks/useAuth";
import { isOperator } from "../navigation/RootNavigator";
import { colors } from "../../constants/theme";

type RoleDoor = "technician" | "operator";

export function LoginScreen() {
  const { login } = useAuth();
  const [door, setDoor] = useState<RoleDoor>("technician");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      return setError("Please enter your email and password.");
    }
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in. Check connection.");
    } finally {
      setLoading(false);
    }
  };

  const chooseDoor = (next: RoleDoor) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setDoor(next);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Glow accents */}
        <View style={[styles.glow, styles.glowTop]} />
        <View style={[styles.glow, styles.glowBottom]} />

        <View style={styles.content}>
          {/* Brand Header */}
          <View style={styles.brandRow}>
            <LinearGradient
              colors={["#FF7A3D", "#E8500F"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoBadge}
            >
              <Text style={styles.logoText}>FP</Text>
            </LinearGradient>
            <View>
              <Text style={styles.eyebrow}>AI FIELD DOCUMENTATION</Text>
              <View style={styles.brandTitleRow}>
                <Text style={styles.brand}>FieldProof</Text>
                <View style={styles.orangeDot} />
              </View>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Capture voice, photo labels, and job notes on site. Transcribe and sync in real time.
          </Text>

          {/* Login Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.formTitle}>
                {door === "technician" ? "Technician Sign In" : "Operator Sign In"}
              </Text>
              <Text style={styles.formHelp}>
                {door === "technician"
                  ? "Capture against templates assigned by your operator"
                  : "Monitor team uploads, documents, and compliance"}
              </Text>
            </View>

            {/* Role doors: two ways in */}
            <View style={styles.doorsRow}>
              <Pressable
                onPress={() => chooseDoor("technician")}
                style={({ pressed }) => [
                  styles.door,
                  door === "technician" && styles.doorActive,
                  pressed && styles.pillPressed
                ]}
              >
                <View style={[styles.doorIconWrap, door === "technician" && styles.doorIconWrapActive]}>
                  <Ionicons
                    name="construct"
                    size={18}
                    color={door === "technician" ? colors.orangeBright : colors.muted}
                  />
                </View>
                <Text style={[styles.doorTitle, door === "technician" && styles.doorTitleActive]}>
                  Technician
                </Text>
                <Text style={[styles.doorSub, door === "technician" && styles.doorSubActive]}>
                  Voice & photo capture
                </Text>
              </Pressable>

              <Pressable
                onPress={() => chooseDoor("operator")}
                style={({ pressed }) => [
                  styles.door,
                  door === "operator" && styles.doorActive,
                  pressed && styles.pillPressed
                ]}
              >
                <View style={[styles.doorIconWrap, door === "operator" && styles.doorIconWrapActive]}>
                  <Ionicons
                    name="shield-checkmark"
                    size={18}
                    color={door === "operator" ? colors.orangeBright : colors.muted}
                  />
                </View>
                <Text style={[styles.doorTitle, door === "operator" && styles.doorTitleActive]}>
                  Operator
                </Text>
                <Text style={[styles.doorSub, door === "operator" && styles.doorSubActive]}>
                  Console & approvals
                </Text>
              </Pressable>
            </View>

            {/* Input Fields */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <View
                style={[
                  styles.inputWrap,
                  emailFocused && styles.inputWrapFocused
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={16}
                  color={emailFocused ? colors.orangeBright : colors.subtle}
                  style={styles.inputIcon}
                />
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                  placeholder="technician@company.com"
                  placeholderTextColor={colors.subtle}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <View
                style={[
                  styles.inputWrap,
                  passwordFocused && styles.inputWrapFocused
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={passwordFocused ? colors.orangeBright : colors.subtle}
                  style={styles.inputIcon}
                />
                <TextInput
                  autoCapitalize="none"
                  autoComplete="password"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={submit}
                  style={styles.input}
                  placeholder="Enter password"
                  placeholderTextColor={colors.subtle}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
              </View>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.error}>{error}</Text>
              </View>
            )}

            <PrimaryButton
              title="Sign In to FieldProof"
              onPress={submit}
              loading={loading}
              variant="primary"
              style={styles.submitBtn}
            />
          </View>

          <View style={styles.footerRow}>
            <View style={styles.liveIndicator} />
            <Text style={styles.footer}>Ready for offline capture & live sync</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.black
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 32
  },
  glow: {
    position: "absolute",
    alignSelf: "center",
    height: 200,
    aspectRatio: 1.8,
    backgroundColor: colors.orange,
    opacity: 0.14,
    borderRadius: 999
  },
  glowTop: {
    top: -60
  },
  glowBottom: {
    bottom: -40,
    opacity: 0.08
  },
  content: {
    paddingHorizontal: 24,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center"
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 12
  },
  logoBadge: {
    width: 46,
    height: 46,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center"
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  eyebrow: {
    color: colors.orangeBright,
    letterSpacing: 1.6,
    fontSize: 10,
    fontWeight: "800"
  },
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4
  },
  brand: {
    color: "#FFFFFF",
    fontSize: 34,
    letterSpacing: -0.8,
    fontWeight: "900"
  },
  orangeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.orange
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 4,
    marginBottom: 28,
    lineHeight: 22
  },
  card: {
    backgroundColor: colors.darkSurface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    padding: 24,
    gap: 14
  },
  cardHeader: {
    marginBottom: 4
  },
  formTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800"
  },
  formHelp: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2
  },
  doorsRow: {
    flexDirection: "row",
    gap: 10
  },
  door: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.black,
    borderWidth: 1.5,
    borderColor: colors.darkBorder,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8
  },
  doorActive: {
    borderColor: colors.orange,
    backgroundColor: colors.orangeLight
  },
  doorIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.darkElevated,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 3
  },
  doorIconWrapActive: {
    backgroundColor: colors.orange
  },
  doorTitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "800"
  },
  doorTitleActive: {
    color: colors.orangeBright
  },
  doorSub: {
    color: colors.subtle,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center"
  },
  doorSubActive: {
    color: colors.textSecondary
  },
  pillPressed: {
    opacity: 0.75
  },
  fieldGroup: {
    gap: 6
  },
  label: {
    color: colors.textSecondary,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.5
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.darkBorder,
    borderRadius: 12,
    backgroundColor: colors.black,
    paddingHorizontal: 12,
    gap: 8
  },
  inputWrapFocused: {
    borderColor: colors.orange,
    backgroundColor: colors.darkSurface
  },
  inputIcon: {
    width: 18,
    alignItems: "center"
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: 10,
    borderRadius: 10
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
    flex: 1
  },
  submitBtn: {
    marginTop: 6
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.orange
  },
  footer: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: "600"
  }
});
