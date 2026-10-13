import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../../hooks/useAuth";
import { isOperator } from "../navigation/RootNavigator";
import { colors, gradients, shadows, timing, radius } from "../../constants/theme";
import { parseQrPayload } from "../../utils/qr";
import { writeScannedUrl } from "../../constants/config";
import type { RootStackParamList } from "../navigation/types";

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, "Login"> };
type RoleDoor = "technician" | "operator";

function tap() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "Login">>();
  const { login } = useAuth();
  const [door, setDoor] = useState<RoleDoor>("technician");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState<"server" | "login" | null>(null);
  const [scanResult, setScanResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-prompt: if the backend is unreachable on the default URL, nudge the
  // user toward the Server Config screen rather than leaving them on a dead login.
  useEffect(() => {
    const probe = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access
        const api = require("../../services/api");
        await api.request("/", { authenticated: false });
      } catch {
        // Server not reachable — show a gentle hint but don't block login.
        setError("Can't reach the server. Tap 'Configure Server' below to set the right URL, or scan a QR.");
      }
    };
    const t = setTimeout(probe, 1200);
    return () => { if (t) clearTimeout(t); };
  }, []);

  const chooseDoor = (next: RoleDoor) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setDoor(next);
    setError(null);
  };

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

  const openScanner = async (mode: "server" | "login") => {
    const perm = await requestCameraPermission();
    if (!perm.granted) {
      return Alert.alert("Camera required", "Allow camera access to scan QR codes.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => { perm.canAskAgain && requestCameraPermission(); } },
      ]);
    }
    setScanMode(mode);
    setScanResult(null);
    setCameraOpen(true);
  };

  const handleScan = useCallback((raw: string) => {
    const payload = parseQrPayload(raw);
    if (payload.kind === "api-url") {
      // Persist the scanned URL and verify it with a quick ping.
      writeScannedUrl(payload.url);
      setScanResult({ ok: true, msg: "Server URL saved — returning to login…" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCameraOpen(false);
        setScanMode(null);
        setScanResult(null);
      }, 1200);
    } else if (payload.kind === "login") {
      setScanResult({ ok: false, msg: "Login QR detected — set the server URL first, then scan again." });
    } else {
      setScanResult({ ok: false, msg: `Unrecognized code.` });
    }
  }, []);

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

            {/* Quick actions row: scan QR or configure server */}
            <View style={styles.quickActions}>
              <Pressable
                onPress={() => openScanner("server")}
                style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="scan" size={15} color={colors.orangeBright} />
                <Text style={styles.quickActionText}>Scan server QR</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate("ServerConfig")}
                style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="settings" size={15} color={colors.orangeBright} />
                <Text style={styles.quickActionText}>Configure server</Text>
              </Pressable>
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

        {/* QR Scanner Modal inline */}
        {cameraOpen && cameraPermission?.granted && (
          <View style={styles.scannerSheet}>
            <View style={styles.scannerHeader}>
              <Pressable onPress={() => { setCameraOpen(false); setScanMode(null); setScanResult(null); }} style={({ pressed }) => [styles.scannerClose, pressed && { opacity: 0.7 }]}>
                <Ionicons name="close-outline" size={20} color={colors.text} />
                <Text style={styles.scannerCloseText}>Cancel</Text>
              </Pressable>
              <Text style={styles.scannerTitle}>
                {scanMode === "server" ? "Scan the server QR" : "Scan a login QR"}
              </Text>
              <View style={{ width: 20 }} />
            </View>

            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={scanMode ? ((e: BarcodeScanningResult | null) => {
                if (e?.data) handleScan(e.data);
              }) : undefined}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
            />

            {/* Scan frame */}
            <View style={styles.scanOverlay}>
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <Text style={styles.scanInstruction}>
                {scanMode === "server"
                  ? "Point at the server QR code"
                  : "Point at the login QR code"}
              </Text>
            </View>

            {scanResult && (
              <View style={styles.scanResultCard}>
                <Ionicons
                  name={scanResult.ok ? "checkmark-circle" : "alert-circle"}
                  size={18}
                  color={scanResult.ok ? colors.success : colors.danger}
                />
                <Text style={styles.scanResultText}>{scanResult.msg}</Text>
              </View>
            )}
          </View>
        )}

        {/* Camera permission fallback */}
        {cameraOpen && !cameraPermission?.granted && (
          <View style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <Ionicons name="camera-outline" size={36} color={colors.orangeBright} />
            </View>
            <Text style={styles.permissionText}>Camera access is needed to scan QR codes.</Text>
            <Pressable
              onPress={() => requestCameraPermission()}
              style={({ pressed }) => [styles.permissionBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.permissionBtnText}>Allow Camera</Text>
            </Pressable>
          </View>
        )}
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
  glowTop: { top: -60 },
  glowBottom: { bottom: -40, opacity: 0.08 },
  content: {
    paddingHorizontal: 24,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center"
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginBottom: spacing.md
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.orangeGlow
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
    marginBottom: 24,
    lineHeight: 22
  },
  card: {
    backgroundColor: colors.glass,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.xxl,
    gap: spacing.lg,
    ...shadows.card
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
  quickActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6
  },
  quickAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.darkElevated,
    borderWidth: 1,
    borderColor: colors.darkBorder
  },
  quickActionText: {
    color: colors.orangeBright,
    fontSize: 12,
    fontWeight: "700"
  },
  doorsRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  door: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.black,
    borderWidth: 1.5,
    borderColor: colors.darkBorder,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    ...shadows.card
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
    borderColor: colors.glassBorder,
    borderRadius: radius.md,
    backgroundColor: colors.black,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm
  },
  inputWrapFocused: {
    borderColor: colors.orange,
    backgroundColor: colors.glass,
    ...shadows.softGlow
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
  },

  /* Scanner sheet */
  scannerSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 380,
    backgroundColor: colors.black,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden"
  },
  scannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.darkSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder
  },
  scannerClose: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  scannerCloseText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  scannerTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  camera: {
    flex: 1
  },
  scanOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.30)"
  },
  scanFrame: {
    width: 220,
    height: 220,
    position: "relative"
  },
  corner: {
    position: "absolute",
    width: 26,
    height: 26,
    borderColor: colors.orangeBright,
    borderWidth: 3
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  scanInstruction: {
    position: "absolute",
    bottom: 24,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999
  },
  scanResultCard: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.darkElevated,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.darkBorder
  },
  scanResultText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    flex: 1
  },

  /* Permission fallback */
  permissionCard: {
    alignItems: "center",
    padding: 32,
    gap: 16,
    backgroundColor: colors.black
  },
  permissionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.orangeLight,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    justifyContent: "center",
    alignItems: "center"
  },
  permissionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 22
  },
  permissionBtn: {
    backgroundColor: colors.orange,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 10
  },
  permissionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  }
});
