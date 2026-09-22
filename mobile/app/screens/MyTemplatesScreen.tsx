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
import { getMyTemplates, type Template } from "../../services/templates";
import { ApiError } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { colors } from "../../constants/theme";
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

export function MyTemplatesScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
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

  const renderTemplate = ({ item }: { item: Template }) => {
    const icon = TRADE_ICON[item.trade] || "documents";

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
          <View style={styles.actionPill}>
            <Text style={styles.actionText}>Capture</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.orangeBright} />
          </View>
        </View>

        <Text style={styles.templateName}>{item.name}</Text>

        <View style={styles.divider} />

        <View style={styles.footerRow}>
          <View style={styles.metaWrap}>
            <Ionicons name="list-outline" size={13} color={colors.subtle} />
            <Text style={styles.metaText}>{item.field_map.length} fields to fill</Text>
          </View>
          <View style={styles.metaWrap}>
            <Ionicons name="checkmark-done-outline" size={13} color={colors.subtle} />
            <Text style={styles.metaText}>Used {item.times_used}×</Text>
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
          <Text style={styles.greetingTitle}>
            Hello, {user?.full_name.split(" ")[0] || "Technician"}
          </Text>
          <Text style={styles.greetingSub}>
            Forms assigned to you by your operator — tap one to start capturing
          </Text>
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
          data={templates}
          keyExtractor={(template) => template.id}
          renderItem={renderTemplate}
          contentContainerStyle={templates.length ? styles.listContent : styles.emptyList}
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
              <Text style={styles.emptyTitle}>No templates assigned yet</Text>
              <Text style={styles.emptyHelp}>
                Your operator assigns forms from the dashboard. Once one is assigned to you it
                appears here and you can start capturing right away.
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.orange,
    justifyContent: "center",
    alignItems: "center"
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
    backgroundColor: colors.darkSurface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    borderLeftWidth: 4,
    borderLeftColor: colors.orange,
    padding: 16,
    gap: 10
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.orangeLight,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    justifyContent: "center",
    alignItems: "center"
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
  }
});
