import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  getConsoleSummary,
  getDocuments,
  getTechnicianDetail,
  getTechnicians,
  type AnalyticsSummary,
  type ConsoleDocument,
  type Technician,
  type TechnicianDetail
} from "../../services/console";
import { ApiError } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { colors } from "../../constants/theme";

const STATUS_DOT: Record<string, string> = {
  "On Site": colors.success,
  "Available": colors.info,
  "Off Duty": colors.subtle
};

function tap() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

export function OperatorHomeScreen() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [techs, setTechs] = useState<Technician[]>([]);
  const [docs, setDocs] = useState<ConsoleDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TechnicianDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [s, t, d] = await Promise.all([getConsoleSummary(), getTechnicians(), getDocuments()]);
      setSummary(s);
      setTechs(t);
      setDocs(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the console.");
      if (e instanceof ApiError && e.status === 401) {
        await logout();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(() => load(true), 20000);
      return () => clearInterval(timer);
    }, [load])
  );

  const openTech = async (tech: Technician) => {
    tap();
    setDetailLoading(true);
    try {
      setDetail(await getTechnicianDetail(tech.id));
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const pendingDocs = docs.filter((d) => d.status === "Pending Review");

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.orange} />
        <Text style={styles.loadingText}>Loading operator console…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.welcome}>
        <View style={styles.topRow}>
          <View style={styles.brandGroup}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>FP</Text>
            </View>
            <View>
              <Text style={styles.brandTitle}>FIELDPROOF</Text>
              <View style={styles.statusChip}>
                <View style={[styles.statusDot, { backgroundColor: colors.orange }]} />
                <Text style={styles.statusChipText}>Operator · {user?.role || "Owner"}</Text>
              </View>
            </View>
          </View>
          <Pressable
            onPress={() => {
              tap();
              logout();
            }}
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.pillPressed]}
          >
            <Ionicons name="log-out-outline" size={14} color="#D6D3D1" />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
        <View style={styles.userGreetingRow}>
          <Text style={styles.greetingTitle}>Hello, {user?.full_name.split(" ")[0] || "Operator"}</Text>
          <Text style={styles.greetingSub}>Team activity, uploads, and document approvals at a glance</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.center}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
          </View>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pillPressed]}>
            <Text style={styles.retryText}>Retry Connection</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.orange} />}
        >
          {/* Summary chips */}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Ionicons name="people" size={16} color={colors.orangeBright} />
              <Text style={styles.summaryValue}>{techs.length}</Text>
              <Text style={styles.summaryLabel}>Technicians</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="cloud-upload" size={16} color={colors.orangeBright} />
              <Text style={styles.summaryValue}>
                {techs.reduce((sum, t) => sum + (t.uploads_count || 0), 0)}
              </Text>
              <Text style={styles.summaryLabel}>Uploads</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="hourglass" size={16} color={colors.orangeBright} />
              <Text style={styles.summaryValue}>{pendingDocs.length}</Text>
              <Text style={styles.summaryLabel}>Pending review</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="shield-checkmark" size={16} color={colors.orangeBright} />
              <Text style={styles.summaryValue}>{summary?.avg_documentation_accuracy ?? "—"}%</Text>
              <Text style={styles.summaryLabel}>AI accuracy</Text>
            </View>
          </View>

          {/* Team */}
          <Text style={styles.sectionTitle}>Team & their uploads</Text>
          {techs.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => openTech(t)}
              style={({ pressed }) => [styles.techCard, pressed && styles.cardPressed]}
            >
              <View style={styles.techAvatar}>
                <Text style={styles.techAvatarText}>
                  {t.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </Text>
              </View>
              <View style={styles.techMeta}>
                <Text style={styles.techName}>{t.name}</Text>
                <Text style={styles.techSub}>{t.trade} · {t.active_jobs} active · {t.docs_this_week} docs/wk</Text>
              </View>
              <View style={styles.techRight}>
                <View style={[styles.statusDotLg, { backgroundColor: STATUS_DOT[t.status] || colors.subtle }]} />
                <Text style={styles.uploadsBadge}>{t.uploads_count || 0}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.subtle} />
              </View>
            </Pressable>
          ))}
          {techs.length === 0 && (
            <Text style={styles.emptyLine}>No technicians yet — invite them from the dashboard.</Text>
          )}

          {/* Recent documents */}
          <Text style={styles.sectionTitle}>Recent documents</Text>
          {docs.slice(0, 6).map((d) => (
            <View key={d.id} style={styles.docRow}>
              <View style={styles.docIcon}>
                <Ionicons name="document-text" size={15} color={colors.orangeBright} />
              </View>
              <View style={styles.docMeta}>
                <Text style={styles.docName}>{d.name}</Text>
                <Text style={styles.docSub}>{Math.round(d.overall_confidence)}% confidence</Text>
              </View>
              <View style={[styles.docPill, d.status === "Approved" || d.status === "Sent" ? styles.docPillOk : styles.docPillPending]}>
                <Text style={[styles.docPillText, d.status === "Approved" || d.status === "Sent" ? styles.docPillTextOk : null]}>
                  {d.status}
                </Text>
              </View>
            </View>
          ))}
          {docs.length === 0 && (
            <Text style={styles.emptyLine}>No documents generated yet.</Text>
          )}
        </ScrollView>
      )}

      {/* Technician drill-down */}
      <Modal visible={detail !== null || detailLoading} animationType="slide" transparent={false} onRequestClose={() => setDetail(null)}>
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setDetail(null)} style={({ pressed }) => [styles.modalClose, pressed && styles.pillPressed]}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
              <Text style={styles.modalCloseText}>Console</Text>
            </Pressable>
          </View>
          {detailLoading || !detail ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.orange} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.modalTechHeader}>
                <View style={[styles.techAvatar, styles.techAvatarLg]}>
                  <Text style={styles.techAvatarText}>
                    {detail.technician.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </Text>
                </View>
                <View style={styles.techMeta}>
                  <Text style={styles.techName}>{detail.technician.name}</Text>
                  <Text style={styles.techSub}>{detail.technician.trade} · {detail.technician.compliance_pct}% compliance</Text>
                </View>
              </View>

              {detail.assigned_templates.length > 0 && (
                <View style={styles.chipRow}>
                  {detail.assigned_templates.map((t) => (
                    <View key={t.id} style={styles.templateChip}>
                      <Ionicons name="document-text" size={11} color={colors.orangeBright} />
                      <Text style={styles.templateChipText}>{t.name}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.modalSection}>Uploads ({detail.captures.length})</Text>
              {detail.captures.map((c) => (
                <View key={c.id} style={styles.captureRow}>
                  <View style={styles.captureIcon}>
                    <Ionicons name={c.kind === "voice" ? "mic" : "camera"} size={15} color={colors.orangeBright} />
                  </View>
                  <View style={styles.captureMeta}>
                    <Text style={styles.captureTitle}>{c.kind === "voice" ? "Voice note" : "Photo"} · {c.id}</Text>
                    <Text style={styles.captureSub}>
                      {c.kind === "voice" && c.transcript ? `"${c.transcript.slice(0, 50)}${c.transcript.length > 50 ? "…" : ""}"` : "—"}
                    </Text>
                  </View>
                  <Text style={[styles.captureState, { color: c.processed ? colors.success : colors.muted }]}>
                    {c.processed ? "Processed" : "Queued"}
                  </Text>
                </View>
              ))}
              {detail.captures.length === 0 && <Text style={styles.emptyLine}>No uploads yet.</Text>}

              <Text style={styles.modalSection}>Document status ({detail.documents.length})</Text>
              {detail.documents.map((d) => (
                <View key={d.id} style={styles.captureRow}>
                  <View style={styles.captureIcon}>
                    <Ionicons name="document-text" size={15} color={colors.orangeBright} />
                  </View>
                  <View style={styles.captureMeta}>
                    <Text style={styles.captureTitle}>{d.name}</Text>
                    <Text style={styles.captureSub}>{Math.round(d.overall_confidence)}% confidence</Text>
                  </View>
                  <View style={[styles.docPill, d.status === "Approved" || d.status === "Sent" ? styles.docPillOk : styles.docPillPending]}>
                    <Text style={[styles.docPillText, d.status === "Approved" || d.status === "Sent" ? styles.docPillTextOk : null]}>
                      {d.status}
                    </Text>
                  </View>
                </View>
              ))}
              {detail.documents.length === 0 && <Text style={styles.emptyLine}>No documents yet.</Text>}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12, backgroundColor: colors.black },
  loadingText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  welcome: {
    backgroundColor: colors.darkSurface,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkBorder,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    gap: 16
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandGroup: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.orange, justifyContent: "center", alignItems: "center" },
  logoText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  brandTitle: { color: "#FFFFFF", fontSize: 14, letterSpacing: 1.6, fontWeight: "900" },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotLg: { width: 8, height: 8, borderRadius: 4 },
  statusChipText: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  signOutBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1,
    borderColor: colors.darkBorder, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 7, backgroundColor: colors.darkElevated
  },
  signOutText: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  pillPressed: { opacity: 0.7 },
  userGreetingRow: { gap: 3 },
  greetingTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", letterSpacing: -0.4 },
  greetingSub: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  listContent: { padding: 16, paddingBottom: 40, gap: 10 },
  summaryGrid: { flexDirection: "row", gap: 8 },
  summaryCard: {
    flex: 1, backgroundColor: colors.darkSurface, borderWidth: 1, borderColor: colors.darkBorder,
    borderRadius: 14, padding: 10, gap: 2, alignItems: "flex-start"
  },
  summaryValue: { color: colors.text, fontSize: 17, fontWeight: "900" },
  summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 8 },
  techCard: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.darkSurface,
    borderWidth: 1, borderColor: colors.darkBorder, borderLeftWidth: 3, borderLeftColor: colors.orange,
    borderRadius: 14, padding: 12
  },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  techAvatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.darkElevated,
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.orangeBorder
  },
  techAvatarLg: { width: 48, height: 48, borderRadius: 24 },
  techAvatarText: { color: colors.orangeBright, fontSize: 12, fontWeight: "900" },
  techMeta: { flex: 1, gap: 1 },
  techName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  techSub: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  techRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  uploadsBadge: {
    color: colors.orangeBright, fontSize: 12, fontWeight: "900", backgroundColor: colors.orangeLight,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden", minWidth: 26, textAlign: "center"
  },
  emptyLine: { color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 8 },
  docRow: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.darkSurface,
    borderWidth: 1, borderColor: colors.darkBorder, borderRadius: 12, padding: 10
  },
  docIcon: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: colors.orangeLight,
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.orangeBorder
  },
  docMeta: { flex: 1, gap: 1 },
  docName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  docSub: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  docPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  docPillPending: { backgroundColor: colors.orangeLight, borderColor: colors.orangeBorder },
  docPillOk: { backgroundColor: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.35)" },
  docPillText: { color: colors.orangeBright, fontSize: 10, fontWeight: "800" },
  docPillTextOk: { color: colors.success },
  errorIconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.dangerLight,
    borderWidth: 1, borderColor: colors.dangerBorder, justifyContent: "center", alignItems: "center"
  },
  errorText: { color: colors.danger, fontSize: 14, textAlign: "center" },
  retryBtn: { backgroundColor: colors.orange, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  retryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  modalScreen: { flex: 1, backgroundColor: colors.black },
  modalHeader: {
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.darkSurface, borderBottomWidth: 1, borderBottomColor: colors.darkBorder
  },
  modalClose: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalCloseText: { color: colors.text, fontSize: 15, fontWeight: "800" },
  modalBody: { padding: 16, gap: 10 },
  modalTechHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  templateChip: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.orangeLight,
    borderWidth: 1, borderColor: colors.orangeBorder, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999
  },
  templateChipText: { color: colors.orangeBright, fontSize: 11, fontWeight: "700" },
  modalSection: { color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 10 },
  captureRow: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.darkSurface,
    borderWidth: 1, borderColor: colors.darkBorder, borderRadius: 12, padding: 10
  },
  captureIcon: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: colors.orangeLight,
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.orangeBorder
  },
  captureMeta: { flex: 1, gap: 1 },
  captureTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  captureSub: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  captureState: { fontSize: 11, fontWeight: "800" }
});
