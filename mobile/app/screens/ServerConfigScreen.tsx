import { useCallback, useRef, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { parseQrPayload, type QrPayload } from "../../utils/qr";
import { readScannedUrl, writeScannedUrl } from "../../constants/config";
import { request } from "../../services/api";
import { colors } from "../../constants/theme";
import { Screen } from "../components/Screen";
import { PrimaryButton } from "../components/PrimaryButton";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ServerConfig">;

function tap() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

export function ServerConfigScreen({ navigation }: Props) {
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [manualUrl, setManualUrl] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<QrPayload | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const processingRef = useRef(false);

  // Verify the currently scanned-or-manual URL pings the backend before saving.
  const verifyAndSave = useCallback(
    async (url: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      try {
        await request("/", { authenticated: false });
        await writeScannedUrl(url);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert(
          "Server connected",
          "FieldProof is now pointing at the right server. Pulling your data…",
          [
            { text: "OK", onPress: () => navigation.reset({ index: 0, routes: [{ name: "Login" }] }) },
          ]
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not reach the server.";
        setManualError(msg);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        Alert.alert("Can't reach that server", `${msg}\n\nTry a different URL or check that the backend is running on the LAN.`);
      } finally {
        processingRef.current = false;
      }
    },
    [navigation]
  );

  const handleScan = useCallback(
    (raw: string) => {
      const payload = parseQrPayload(raw);
      setScanResult(payload);

      if (payload.kind === "api-url") {
        tap();
        setManualUrl(payload.url);
        setManualError(null);
        setCameraOpen(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (payload.kind === "login") {
        tap();
        setManualUrl("");
        setManualError("This is a login QR. Point the app at the server URL first.");
        setCameraOpen(false);
      } else {
        setManualError(`Unrecognized QR: ${payload.raw.slice(0, 40)}${payload.raw.length > 40 ? "…" : ""}`);
      }
    },
    []
  );

  const startScan = async () => {
    const perm = await requestCameraPermission();
    if (!perm.granted) {
      return Alert.alert("Camera required", "Allow camera access so FieldProof can read the server QR code.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => { perm.canAskAgain && requestCameraPermission(); } },
      ]);
    }
    setScanning(true);
    setScanResult(null);
    setManualError(null);
    setCameraOpen(true);
  };

  const stopScan = () => {
    setCameraOpen(false);
    setScanning(false);
    setScanResult(null);
  };

  const submitManual = () => {
    const url = manualUrl.trim().replace(/\/+$/, "");
    if (!url) return setManualError("Enter a server URL.");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return setManualError("URL must start with http:// or https://");
    }
    verifyAndSave(url);
  };

  return (
    <Screen style={styles.outer}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="close-outline" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Connect to Server</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Mode toggle */}
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => { tap(); setMode("scan"); setManualError(null); setScanResult(null); }}
          style={({ pressed }) => [styles.toggleBtn, mode === "scan" && styles.toggleBtnActive, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="qr-code-outline" size={16} color={mode === "scan" ? colors.orangeBright : colors.muted} />
          <Text style={[styles.toggleText, mode === "scan" && styles.toggleTextActive]}>Scan QR</Text>
        </Pressable>
        <Pressable
          onPress={() => { tap(); setMode("manual"); setManualError(null); }}
          style={({ pressed }) => [styles.toggleBtn, mode === "manual" && styles.toggleBtnActive, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="keypad" size={16} color={mode === "manual" ? colors.orangeBright : colors.muted} />
          <Text style={[styles.toggleText, mode === "manual" && styles.toggleTextActive]}>Type URL</Text>
        </Pressable>
      </View>

      {mode === "scan" ? (
        <>
          {/* How-to card */}
          <View style={styles.hintCard}>
            <View style={styles.hintRow}>
              <View style={styles.hintIcon}>
                <Ionicons name="qr-code-outline" size={18} color={colors.orangeBright} />
              </View>
              <View style={styles.hintText}>
                <Text style={styles.hintTitle}>Scan the server QR</Text>
                <Text style={styles.hintSub}>
                  Your operator prints a QR that encodes the API URL. Point the camera at it and FieldProof configures itself.
                </Text>
              </View>
            </View>
          </View>

          {/* Camera */}
          {cameraPermission?.granted ? (
            <View style={styles.cameraWrap}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                onBarcodeScanned={scanning ? ((e: BarcodeScanningResult | null) => {
                  if (e?.data) handleScan(e.data);
                }) : undefined}
                barcodeScannerSettings={{
                  barcodeTypes: ["qr"],
                }}
              />

              {/* Scan frame overlay */}
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.scanInstruction}>Point at the server QR code</Text>
              </View>

              {scanResult && (
                <View style={styles.scanResultCard}>
                  <Ionicons name={scanResult.kind === "api-url" ? "checkmark-circle" : "alert-circle"} size={20} color={scanResult.kind === "api-url" ? colors.success : colors.danger} />
                  <Text style={styles.scanResultText}>
                    {scanResult.kind === "api-url"
                      ? `API URL found: ${scanResult.url}`
                      : scanResult.kind === "login"
                      ? "Login QR — set the server URL first"
                      : "Unrecognized code"}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.permissionCard}>
              <View style={styles.permissionIcon}>
                <Ionicons name="camera" size={32} color={colors.orangeBright} />
              </View>
              <Text style={styles.permissionText}>Camera access is needed to scan the server QR code.</Text>
              <PrimaryButton title="Allow Camera" onPress={startScan} variant="primary" />
            </View>
          )}

          <Pressable onPress={stopScan} style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.manualWrap}
        >
          <View style={styles.hintCard}>
            <View style={styles.hintRow}>
              <View style={styles.hintIcon}>
                <Ionicons name="laptop" size={18} color={colors.orangeBright} />
              </View>
              <View style={styles.hintText}>
                <Text style={styles.hintTitle}>Find the backend URL</Text>
                <Text style={styles.hintSub}>
                  On the machine running the backend, open a terminal and run ipconfig (Windows) or ifconfig (Mac/Linux) to find the LAN IP, then use http://YOUR_LAN_IP:8000.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>API SERVER URL</Text>
            <View style={[styles.inputWrap, manualError && styles.inputError]}>
              <Ionicons
                name="flash"
                size={16}
                color={manualError ? colors.danger : colors.subtle}
              />
              <TextInput
                value={manualUrl}
                onChangeText={(v) => { setManualUrl(v); if (manualError) setManualError(null); }}
                onSubmitEditing={submitManual}
                style={styles.input}
                placeholder="http://192.168.1.42:8000"
                placeholderTextColor={colors.subtle}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                textContentType="URL"
              />
            </View>
            {manualError && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={13} color={colors.danger} />
                <Text style={styles.errorText}>{manualError}</Text>
              </View>
            )}
          </View>

          <PrimaryButton
            title="Connect"
            onPress={submitManual}
            loading={processingRef.current}
            disabled={!manualUrl.trim()}
            variant="primary"
            style={styles.submitBtn}
          />
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingTop: 50,
    paddingBottom: 12
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.darkElevated,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.darkBorder
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.darkSurface,
    borderWidth: 1,
    borderColor: colors.darkBorder
  },
  toggleBtnActive: {
    backgroundColor: colors.orangeLight,
    borderColor: colors.orange
  },
  toggleText: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  toggleTextActive: { color: colors.orangeBright },

  hintCard: {
    backgroundColor: colors.darkSurface,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.darkBorder
  },
  hintRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  hintIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.orangeLight,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    justifyContent: "center",
    alignItems: "center"
  },
  hintText: { flex: 1, gap: 3 },
  hintTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  hintSub: { color: colors.muted, fontSize: 12, lineHeight: 17 },

  cameraWrap: { flex: 1, position: "relative" },
  camera: { flex: 1 },
  scanOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)"
  },
  scanFrame: {
    width: 240,
    height: 240,
    position: "relative"
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: colors.orangeBright,
    borderWidth: 3
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  scanInstruction: {
    position: "absolute",
    bottom: 40,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999
  },
  scanResultCard: {
    position: "absolute",
    bottom: 20,
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
  scanResultText: { color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 },

  permissionCard: {
    flex: 1,
    justifyContent: "center",
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

  cancelBtn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: colors.darkElevated,
    borderWidth: 1,
    borderColor: colors.darkBorder
  },
  cancelText: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },

  manualWrap: { flex: 1 },
  inputCard: {
    backgroundColor: colors.darkSurface,
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    gap: 10
  },
  inputLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
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
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerLight },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    fontWeight: "600"
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2
  },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: "600" },
  submitBtn: { marginHorizontal: 16, marginBottom: 24 }
});
