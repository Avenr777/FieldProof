import { useEffect, useRef, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Audio } from "expo-av";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { colors, gradients } from "../../constants/theme";
import { uploadCapture, type LocalCaptureFile } from "../../services/capture";
import { formatDuration } from "../../utils/format";
import { PrimaryButton } from "../components/PrimaryButton";
import { Screen } from "../components/Screen";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Capture">;
type Photo = LocalCaptureFile;

function tap() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

export function CaptureScreen({ route, navigation }: Props) {
  const { job } = route.params;
  const [isRecording, setIsRecording] = useState(false);
  const [audio, setAudio] = useState<LocalCaptureFile | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const secondsRef = useRef(0);
  const stoppingRef = useRef(false);
  const uploadRef = useRef(false);

  // Unmount-only cleanup: release the mic, timer, and any loaded sound exactly once.
  // Uses refs (not state deps) so changing recording state never re-runs this and
  // never double-stops the active recorder mid-session.
  useEffect(() => {
    return () => {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      soundRef.current?.unloadAsync().catch(() => {});
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const startRecording = async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) return Alert.alert("Microphone required", "Allow microphone access to record a voice note.");
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const created = new Audio.Recording();
      await created.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await created.startAsync();
      recordingRef.current = created;
      setIsRecording(true);
      setSeconds(0);
      secondsRef.current = 0;
      timer.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
      }, 1000);
    } catch { Alert.alert("Recording unavailable", "We could not start recording on this device."); }
  };
  const stopRecording = async () => {
    const current = recordingRef.current;
    if (!current || stoppingRef.current) return;
    stoppingRef.current = true;
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    try {
      // Resolves with the final status, including the recording's real duration.
      const status = await current.stopAndUnloadAsync();
      const uri = current.getURI();
      const recorded = status?.durationMillis
        ? Math.max(1, Math.round(status.durationMillis / 1000))
        : Math.max(1, secondsRef.current);
      if (uri) {
        setAudio({
          uri,
          // Web recordings come from MediaRecorder (audio/webm); native produces .m4a.
          name: Platform.OS === "web" ? `voice-note-${Date.now()}.webm` : `voice-note-${Date.now()}.m4a`,
          mimeType: Platform.OS === "web" ? "audio/webm" : "audio/m4a"
        });
        setAudioDuration(recorded);
      }
    } catch {
      Alert.alert("Recording error", "The voice note could not be saved.");
    } finally {
      recordingRef.current = null;
      setIsRecording(false);
      stoppingRef.current = false;
    }
  };
  const playAudio = async () => {
    if (!audio) return;
    try { await soundRef.current?.unloadAsync(); } catch { /* already unloaded */ }
    const { sound: next } = await Audio.Sound.createAsync({ uri: audio.uri });
    soundRef.current = next;
    await next.playAsync();
  };
  const pickGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Photo library required", "Allow photo-library access to select job-site photos.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] as never, allowsMultipleSelection: true, quality: 0.85 });
    if (!result.canceled) setPhotos((current) => [...current, ...result.assets.map((asset, index) => ({ uri: asset.uri, name: asset.fileName || `gallery-photo-${Date.now()}-${index}.jpg`, mimeType: asset.mimeType || "image/jpeg" }))]);
  };
  const uploadAll = async () => {
    if (uploadRef.current) return; // ignore double-taps while an upload is in flight
    const queue: Array<{ kind: "voice" | "photo"; file: LocalCaptureFile }> = [ ...(audio ? [{ kind: "voice" as const, file: audio }] : []), ...photos.map((file) => ({ kind: "photo" as const, file })) ];
    if (!queue.length) {
      setUploadStatus("Nothing to upload — record a voice note or add at least one photo first.");
      return;
    }
    uploadRef.current = true;
    setUploading(true);
    setUploadStatus(`Uploading 1 of ${queue.length} · 0%`);
    try {
      for (let i = 0; i < queue.length; i++) {
        const entry = queue[i];
        await uploadCapture(job.id, entry.kind, entry.file, (fraction) => setUploadStatus(`Uploading ${i + 1} of ${queue.length} · ${Math.round(fraction * 100)}%`));
      }
      setUploadStatus("All captures uploaded and queued for processing."); setAudio(null); setPhotos([]); setSeconds(0); setAudioDuration(0); secondsRef.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (Platform.OS === "web") {
        // Alert.alert is not rendered by react-native-web; navigate straight back.
        setTimeout(() => navigation.goBack(), 900);
      } else {
        Alert.alert("Upload complete", "Your job-site captures are queued for processing.", [{ text: "Done", onPress: () => navigation.goBack() }]);
      }
    } catch (e) {
      // Keep audio/photos so the technician can simply tap Submit again to retry.
      const reason = e instanceof Error ? e.message : "Please try again.";
      setUploadStatus(`Upload failed: ${reason} — tap Submit to retry.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      uploadRef.current = false;
      setUploading(false);
    }
  };
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.screen}>
      {/* Job Context Header */}
      <LinearGradient
        colors={gradients.sheen}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.jobCard}
      >
        <View style={styles.jobBadge}>
          <Text style={styles.jobBadgeText}>JOB SITE</Text>
        </View>
        <Text style={styles.jobCustomer}>{job.customer}</Text>
        <View style={styles.jobAddressWrap}>
          <Ionicons name="location-outline" size={13} color={colors.muted} />
          <Text style={styles.jobAddress}>{job.site_address || job.job_type}</Text>
        </View>
      </LinearGradient>

      {/* Voice Note Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconBox}>
            <Ionicons name="mic" size={17} color={colors.orangeBright} />
          </View>
          <View style={styles.sectionTitleBlock}>
            <Text style={styles.sectionTitle}>Voice Documentation</Text>
            <Text style={styles.caption}>
              Speak notes, voltmeter readings, and materials used.
            </Text>
          </View>
        </View>

        {isRecording ? (
          <LinearGradient
            colors={["#1C1917", "#0C0A09"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.recordingBox}
          >
            <View style={styles.recordingTop}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTimer}>
                Recording {formatDuration(seconds)}
              </Text>
            </View>

            {/* Visualizer Waveform */}
            <View style={styles.waveformContainer}>
              {[8, 18, 10, 26, 14, 30, 20, 12, 24, 10, 22, 16, 9, 28, 14, 18].map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      height: Math.min(36, Math.max(6, (h * ((seconds % 3) + 1)) / 1.8)),
                      backgroundColor: i % 2 === 0 ? colors.orange : colors.amber
                    }
                  ]}
                />
              ))}
            </View>

            <PrimaryButton
              title="Stop & Save Voice Note"
              onPress={stopRecording}
              variant="dark"
              style={styles.stopBtn}
            />
          </LinearGradient>
        ) : (
          <PrimaryButton
            title={audio ? "Re-record Voice Note" : "Start Voice Recording"}
            onPress={startRecording}
            variant={audio ? "secondary" : "primary"}
          />
        )}

        {audio && !isRecording && (
          <View style={styles.audioPreviewCard}>
            <View style={styles.audioMeta}>
              <Ionicons name="play-circle" size={22} color={colors.orangeBright} />
              <View>
                <Text style={styles.audioReadyText}>Voice note ready</Text>
                <Text style={styles.audioDurationText}>{formatDuration(audioDuration)} duration</Text>
              </View>
            </View>
            <View style={styles.audioActions}>
              <Pressable onPress={playAudio} style={({ pressed }) => [styles.previewBtn, pressed && { opacity: 0.75 }]}>
                <Text style={styles.previewBtnText}>Play preview</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAudio(null);
                  setAudioDuration(0);
                  setSeconds(0);
                  secondsRef.current = 0;
                }}
                style={({ pressed }) => [styles.removeAudioBtn, pressed && { opacity: 0.75 }]}
              >
                <Text style={styles.removeAudioText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Photo Capture Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconBox}>
            <Ionicons name="camera" size={17} color={colors.orangeBright} />
          </View>
          <View style={styles.sectionTitleBlock}>
            <Text style={styles.sectionTitle}>Site Photos & Labels</Text>
            <Text style={styles.caption}>
              Capture equipment nameplates, serials, meters, and finished work.
            </Text>
          </View>
        </View>

        <View style={styles.photoActions}>
          <Pressable
            style={({ pressed }) => [styles.photoActionBtn, pressed && styles.actionPressed]}
            onPress={() => {
              tap();
              setCameraOpen(true);
            }}
          >
            <Ionicons name="camera-outline" size={16} color={colors.orangeBright} />
            <Text style={styles.photoActionLabel}>Take photo</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.photoActionBtn, pressed && styles.actionPressed]}
            onPress={() => {
              tap();
              pickGallery();
            }}
          >
            <Ionicons name="images-outline" size={16} color={colors.orangeBright} />
            <Text style={styles.photoActionLabel}>Choose gallery</Text>
          </Pressable>
        </View>

        {photos.length > 0 && (
          <View style={styles.grid}>
            {photos.map((photo, index) => (
              <View key={`${photo.uri}-${index}`} style={styles.thumbnail}>
                <Image source={{ uri: photo.uri }} style={styles.image} />
                <Pressable
                  style={styles.remove}
                  onPress={() => setPhotos((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Upload Status & Submit */}
      {uploadStatus && (
        <View style={styles.uploadStatusCard}>
          <View style={styles.uploadStatusDot} />
          <Text style={styles.uploadStatusText}>{uploadStatus}</Text>
        </View>
      )}

      <PrimaryButton
        title={`Submit ${[audio, ...photos].filter(Boolean).length} Site Capture${
          [audio, ...photos].filter(Boolean).length === 1 ? "" : "s"
        }`}
        onPress={uploadAll}
        loading={uploading}
        disabled={isRecording || [audio, ...photos].filter(Boolean).length === 0}
        variant="primary"
        style={styles.uploadBtn}
      />

      <CameraModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onPhoto={(photo) => setPhotos((items) => [...items, photo])}
      />
    </ScrollView>
    </Screen>
  );
}

function CameraModal({ visible, onClose, onPhoto }: { visible: boolean; onClose: () => void; onPhoto: (photo: Photo) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const ref = useRef<CameraView>(null);

  const takePhoto = async () => {
    const photo = await ref.current?.takePictureAsync({ quality: 0.85 });
    if (photo?.uri) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onPhoto({ uri: photo.uri, name: `camera-photo-${Date.now()}.jpg`, mimeType: "image/jpeg" });
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {!permission ? (
        <View style={styles.center}><Text style={styles.permissionText}>Checking camera permission…</Text></View>
      ) : !permission.granted ? (
        <View style={styles.center}>
          <View style={styles.permissionIconWrap}>
            <Ionicons name="camera-outline" size={26} color={colors.orangeBright} />
          </View>
          <Text style={styles.permissionText}>Camera access is needed to take job-site photos.</Text>
          <PrimaryButton title="Allow camera" onPress={requestPermission} variant="primary" />
          <Pressable onPress={onClose} style={{ marginTop: 14 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.cameraScreen}>
          <CameraView ref={ref} style={styles.camera} facing="back" />
          <View style={styles.cameraControls}>
            <Pressable onPress={onClose}>
              <Text style={styles.cameraText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={takePhoto} style={styles.shutter}>
              <LinearGradient colors={gradients.brand} style={styles.shutterInner} />
            </Pressable>
            <View style={{ width: 54 }} />
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 16,
    gap: 16,
    backgroundColor: colors.black
  },
  jobCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    gap: 6
  },
  jobBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.orangeLight,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  jobBadgeText: {
    color: colors.orangeBright,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  jobCustomer: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4
  },
  jobAddressWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  jobAddress: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
  },
  section: {
    backgroundColor: colors.darkSurface,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    borderRadius: 18,
    padding: 18,
    gap: 14
  },
  sectionHeaderRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.orangeLight,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    justifyContent: "center",
    alignItems: "center"
  },
  sectionTitleBlock: {
    flex: 1,
    gap: 2
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  caption: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17
  },
  recordingBox: {
    borderRadius: 16,
    padding: 18,
    gap: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.orangeBorder
  },
  recordingTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.orange
  },
  recordingTimer: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 42,
    width: "100%",
    paddingHorizontal: 12
  },
  waveBar: {
    width: 4,
    borderRadius: 2
  },
  stopBtn: {
    width: "100%",
    backgroundColor: colors.darkElevated,
    borderWidth: 1,
    borderColor: colors.darkBorder
  },
  audioPreviewCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.darkElevated,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.darkBorder
  },
  audioMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  audioReadyText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700"
  },
  audioDurationText: {
    color: colors.muted,
    fontSize: 11
  },
  audioActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  previewBtn: {
    backgroundColor: colors.orangeLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  previewBtnText: {
    color: colors.orangeBright,
    fontSize: 12,
    fontWeight: "700"
  },
  removeAudioBtn: {
    padding: 4
  },
  removeAudioText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700"
  },
  photoActions: {
    flexDirection: "row",
    gap: 10
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.darkBorder,
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: colors.darkElevated
  },
  actionPressed: {
    backgroundColor: colors.orangeLight,
    borderColor: colors.orange
  },
  photoActionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  thumbnail: {
    width: 96,
    height: 96,
    position: "relative",
    borderRadius: 12,
    overflow: "visible"
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.darkBorder
  },
  remove: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "center"
  },
  uploadStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.orangeLight,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    padding: 12,
    borderRadius: 12
  },
  uploadStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.orange
  },
  uploadStatusText: {
    color: colors.orangeBright,
    fontSize: 13,
    fontWeight: "700"
  },
  uploadBtn: {
    marginBottom: 20
  },
  center: {
    flex: 1,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: colors.black
  },
  permissionIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.orangeLight,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    justifyContent: "center",
    alignItems: "center"
  },
  permissionText: {
    textAlign: "center",
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22
  },
  cancelText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600"
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: "#000000"
  },
  camera: {
    flex: 1
  },
  cameraControls: {
    height: 120,
    backgroundColor: "rgba(0,0,0,0.85)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28
  },
  cameraText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15
  },
  shutter: {
    height: 72,
    width: 72,
    borderWidth: 4,
    borderColor: colors.orange,
    borderRadius: 36,
    padding: 5,
    justifyContent: "center",
    alignItems: "center"
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26
  }
});
