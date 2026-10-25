import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getMyTemplates, type RequiredProofType, type Template } from "../../services/templates";
import { ApiError } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { colors, shadows, radius, spacing } from "../../constants/theme";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "MyTemplates">;

const TRADE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Electrical: "flash",
  Plumbing: "water",
  HVAC: "thermometer",
  "Fire Safety": "flame",
  Solar: "sunny",
  General: "business"
};

function tap() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

function proofLabel(proof: RequiredProofType, minPhotos?: number | null) {
  switch (proof) {
    case "photo":
      return `Photos${minPhotos && minPhotos > 1 ? ` (min. ${minPhotos})` : ""}`;
    case "voice":
      return "Voice note";
    case "form_fill":
      return "Complete form";
    case "text_note":
      return "Text note";
  }
}

export function MyTemplatesScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filterTab, setFilterTab] = useState<"all" | "one_time" | "repeating">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setTemplates(await getMyTemplates());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load assigned templates.");
      if (e instanceof ApiError && e.status === 401) {
        await logout();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  // Refresh when returning to this screen (e.g. after an upload) and periodically
  useFocusEffect(
    useCallback(() => {
      load();
      const syncTimer = setInterval(() => load(true), 20000);
      return () => clearInterval(syncTimer);
    }, [load])
  );

  const openCapture = (template: Template) => {
    tap();
    navigation.navigate("Capture", { template });
  };

  const filteredTemplates = templates.filter((tpl) => {
    if (filterTab === "one_time") return tpl.assignment_type === "one_time";
    if (filterTab === "repeating") return tpl.assignment_type === "repeating";
    return true;
  });

  const getScheduleLabel = (tpl: Template) => {
    if (tpl.assignment_type === "one_time" || !tpl.frequency) {
      return { text: "⚡ One-Time / As Needed", isRepeating: false };
    }
    const freq = (tpl.frequency || "").toLowerCase();
    const details = tpl.frequency_details || {};
    if (freq === "daily") return { text: "📅 Daily Schedule", isRepeating: true };
    if (freq === "weekly") {
      const days = (details.days_of_week || []).join(", ");
      return { text: days ? `📅 Weekly (${days})` : "📅 Weekly Schedule", isRepeating: true };
    }
    if (freq === "monthly") return { text: `📅 Monthly (Day ${details.day_of_month || 1})`, isRepeating: true };
    return { text: "📅 Scheduled Document", isRepeating: true };
  };

  const renderTemplate = ({ item }: { item: Template }) => {
    const icon = TRADE_ICON[item.trade] || "documents";
    const schedule = getScheduleLabel(item);
    const proofLabels = (item.required_proof_types || []).map((proof) => proofLabel(proof, item.min_photos));

    return (
      <Pressable
        onPress={() => openCapture(item)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.tradeBadge}>
            <Ionicons name={icon} size={14} color={colors.orangeBright} />
            <Text style={styles.tradeText}>{item.trade}</Text>
          </View>
          <View style={[styles.scheduleBadge, schedule.isRepeating ? styles.scheduleRepeating : styles.scheduleOneTime]}>
            <Text style={[styles.scheduleText, schedule.isRepeating ? styles.scheduleTextRepeating : styles.scheduleTextOneTime]}>
              {schedule.text}
            </Text>
          </View>
        </View>

        <Text style={styles.templateName}>{item.name}</Text>

        {item.due_date ? (
          <View style={styles.dueDateRow}>
            <Ionicons name="calendar-outline" size={12} color={colors.muted} />
            <Text style={styles.dueDateText}>Due: {new Date(item.due_date).toLocaleDateString()}</Text>
          </View>
        ) : null}

        {item.notes ? (
          <View style={styles.notesBox}>
            <Ionicons name="information-circle-outline" size={13} color={colors.orangeBright} />
            <Text style={styles.notesText} numberOfLines={2}>{item.notes}</Text>
          </View>
        ) : null}

        {(proofLabels.length > 0 || item.technician_instructions) ? (
          <View style={styles.requirementsBox}>
            {proofLabels.length > 0 ? (
              <Text style={styles.requirementsText}>Required: {proofLabels.join(", ")}</Text>
            ) : null}
            {item.technician_instructions ? (
              <Text style={styles.requirementsText}>Instructions: {item.technician_instructions}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.footerRow}>
          <View style={styles.metaWrap}>
            <Ionicons name="list-outline" size={13} color={colors.subtle} />
            <Text style={styles.metaText}>{item.field_map.length} fields to fill</Text>
          </View>
          <View style={styles.actionPill}>
            <Text style={styles.actionText}>Capture</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.orangeBright} />
          </View>
        </View>

        {/* Capture mode strip: what this session collects */}
        <View style={styles.captureModes}>
          <View style={styles.modeChip}>
            <Ionicons name="mic" size={12} color={colors.orangeBright} />
            <Text style={styles.modeText}>Voice</Text>
          </View>
          <View style={styles.modeChip}>
            <Ionicons name="camera" size={12} color={colors.orangeBright} />
            <Text style={styles.modeText}>Photos</Text>
          </View>
          <Text style={styles.modeHint}>Uploaded under your name</Text>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.orange} />
        <Text style={styles.loadingText}>Loading assigned templates…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Dark Brand Topbar */}
      <View style={styles.welcome}>
        <View style={styles.topRow}>
          <View style={styles.brandGroup}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>FP</Text>
            </View>
            <View>
              <Text style={styles.brandTitle}>FIELDPROOF</Text>
              <View style={styles.statusChip}>
                <View style={styles.statusDot} />
                <Text style={styles.statusChipText}>Active · Technician</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => {
                tap();
                navigation.navigate("Templates");
              }}
              style={({ pressed }) => [styles.templatesBtn, pressed && styles.pillPressed]}
            >
              <Ionicons name="document-text-outline" size={14} color={colors.orangeBright} />
              <Text style={styles.templatesText}>Templates</Text>
            </Pressable>

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
        </View>

        <View style={styles.userGreetingRow}>
          <Text style={styles.greetingTitle}>
            Hello, {user?.full_name.split(" ")[0] || "Technician"}
          </Text>
          <Text style={styles.greetingSub}>
            Forms assigned to you by your operator — tap one to start capturing
          </Text>
        </View>

        {/* Filter Chips Bar */}
        <View style={styles.filterRow}>
          {[
            { id: "all", label: `All (${templates.length})` },
            { id: "one_time", label: "⚡ One-Time" },
            { id: "repeating", label: "📅 Scheduled" },
          ].map((tab) => {
            const active = filterTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  tap();
                  setFilterTab(tab.id as any);
                }}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
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
        <FlatList
          data={filteredTemplates}
          keyExtractor={(template) => template.id}
          renderItem={renderTemplate}
          contentContainerStyle={filteredTemplates.length ? styles.listContent : styles.emptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.orange}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="documents-outline" size={26} color={colors.orangeBright} />
              </View>
              <Text style={styles.emptyTitle}>No assigned forms found</Text>
              <Text style={styles.emptyHelp}>
                {templates.length === 0
                  ? "Your operator assigns forms from the dashboard. Once one is assigned to you it appears here."
                  : "No assigned forms match the selected schedule filter."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.black
  },
  welcome: {
    backgroundColor: colors.glass,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    gap: spacing.lg,
    ...shadows.card
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.orange,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.orangeGlow
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900"
  },
  brandTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    letterSpacing: 1.6,
    fontWeight: "900"
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success
  },
  statusChipText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  templatesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(242, 98, 42, 0.4)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(242, 98, 42, 0.12)"
  },
  templatesText: {
    color: colors.orangeBright,
    fontSize: 12,
    fontWeight: "700"
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.darkElevated
  },
  signOutText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  pillPressed: {
    opacity: 0.7
  },
  userGreetingRow: {
    gap: 3
  },
  greetingTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.4
  },
  greetingSub: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center"
  },
  card: {
    backgroundColor: colors.glass,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderLeftWidth: 4,
    borderLeftColor: colors.orange,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }]
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  tradeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.orangeLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  tradeText: {
    color: colors.orangeBright,
    fontSize: 12,
    fontWeight: "700"
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.orangeLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  actionText: {
    color: colors.orangeBright,
    fontSize: 12,
    fontWeight: "800"
  },
  templateName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800"
  },
  divider: {
    height: 1,
    backgroundColor: colors.darkBorder
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  metaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  metaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600"
  },
  captureModes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap"
  },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.darkElevated,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999
  },
  modeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700"
  },
  modeHint: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: "600",
    marginLeft: "auto"
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12
  },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    justifyContent: "center",
    alignItems: "center"
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600"
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: "center"
  },
  retryBtn: {
    backgroundColor: colors.orange,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13
  },
  emptyContainer: {
    alignItems: "center",
    padding: 36,
    gap: 10
  },
  emptyIconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.orangeLight,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.softGlow
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800"
  },
  emptyHelp: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 18
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.darkElevated,
    borderWidth: 1,
    borderColor: colors.darkBorder
  },
  filterChipActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange
  },
  filterChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  scheduleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1
  },
  scheduleOneTime: {
    backgroundColor: "rgba(251, 191, 107, 0.12)",
    borderColor: "rgba(251, 191, 107, 0.3)"
  },
  scheduleRepeating: {
    backgroundColor: "rgba(242, 98, 42, 0.15)",
    borderColor: "rgba(242, 98, 42, 0.4)"
  },
  scheduleText: {
    fontSize: 11,
    fontWeight: "700"
  },
  scheduleTextOneTime: {
    color: "#FBBF6B"
  },
  scheduleTextRepeating: {
    color: colors.orangeBright
  },
  dueDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  dueDateText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600"
  },
  notesBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.darkElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.darkBorder
  },
  notesText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "500",
    flex: 1
  },
  requirementsBox: {
    gap: 4,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.amberLight,
    borderWidth: 1,
    borderColor: colors.warningBorder
  },
  requirementsText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15
  }
});
