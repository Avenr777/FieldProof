import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { getJobs, type Job } from "../../services/jobs";
import { ApiError } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { colors } from "../../constants/theme";
import { formatDate } from "../../utils/format";
import { StatusBadge } from "../components/StatusBadge";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Jobs">;

const FILTER_TABS = ["All", "Scheduled", "Awaiting Review", "Completed"] as const;
type FilterTab = typeof FILTER_TABS[number];

function tap() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

export function JobsScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setJobs(await getJobs());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load jobs.");
      if (e instanceof ApiError && e.status === 401) {
        await logout();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  // Refresh periodically and when navigating back to this screen
  useFocusEffect(
    useCallback(() => {
      load();
      const syncTimer = setInterval(() => load(true), 20000);
      return () => clearInterval(syncTimer);
    }, [load])
  );

  const filteredJobs = useMemo(() => {
    if (activeFilter === "All") return jobs;
    return jobs.filter((job) => job.status.toLowerCase() === activeFilter.toLowerCase());
  }, [jobs, activeFilter]);

  const openJob = (job: Job) => {
    tap();
    navigation.navigate("JobDetails", { job });
  };

  const renderJob = ({ item }: { item: Job }) => {
    const isPriority = item.status === "Awaiting Review" || item.status === "In Progress";

    return (
      <Pressable
        onPress={() => openJob(item)}
        style={({ pressed }) => [
          styles.card,
          isPriority && styles.cardPriority,
          pressed && styles.cardPressed
        ]}
      >
        {/* Top Header Row */}
        <View style={styles.cardHeader}>
          <View style={styles.customerBlock}>
            <Text style={styles.customer}>{item.customer}</Text>
            <View style={styles.jobIdBadge}>
              <Text style={styles.jobIdText}>{item.id}</Text>
            </View>
          </View>
          <StatusBadge status={item.status} />
        </View>

        {/* Trade & Description */}
        <View style={styles.tradeRow}>
          <View style={styles.tradeBadge}>
            <Ionicons name="flash" size={12} color={colors.orangeBright} />
            <Text style={styles.tradeText}>{item.job_type}</Text>
          </View>
          {item.scheduled_at && (
            <View style={styles.scheduledWrap}>
              <Ionicons name="time-outline" size={12} color={colors.muted} />
              <Text style={styles.scheduledText}>{formatDate(item.scheduled_at)}</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Address & Quick Action */}
        <View style={styles.footerRow}>
          <View style={styles.addressWrap}>
            <Ionicons name="location-outline" size={13} color={colors.subtle} />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.site_address || "On-site job"}
            </Text>
          </View>
          <View style={styles.actionPill}>
            <Text style={styles.actionText}>Open</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.orangeBright} />
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.orange} />
        <Text style={styles.loadingText}>Loading assigned jobs…</Text>
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
            Ready to capture voice notes and job-site photos
          </Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTER_TABS.map((tab) => {
            const count = tab === "All"
              ? jobs.length
              : jobs.filter((j) => j.status.toLowerCase() === tab.toLowerCase()).length;
            const active = activeFilter === tab;

            return (
              <Pressable
                key={tab}
                onPress={() => {
                  tap();
                  setActiveFilter(tab);
                }}
                style={({ pressed }) => [
                  styles.filterTab,
                  active && styles.filterTabActive,
                  pressed && styles.pillPressed
                ]}
              >
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                  {tab}
                </Text>
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Jobs List / Empty / Error */}
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
          data={filteredJobs}
          keyExtractor={(job) => job.id}
          renderItem={renderJob}
          contentContainerStyle={filteredJobs.length ? styles.listContent : styles.emptyList}
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
                <Ionicons name="clipboard-outline" size={26} color={colors.orangeBright} />
              </View>
              <Text style={styles.emptyTitle}>No jobs found</Text>
              <Text style={styles.emptyHelp}>
                {activeFilter === "All"
                  ? "You have no assigned jobs in the system right now."
                  : `No jobs currently matching "${activeFilter}".`}
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
  filtersSection: {
    paddingVertical: 12,
    backgroundColor: colors.black
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.darkSurface,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    gap: 6
  },
  filterTabActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary
  },
  filterTabTextActive: {
    color: "#FFFFFF"
  },
  filterCount: {
    backgroundColor: colors.darkElevated,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999
  },
  filterCountActive: {
    backgroundColor: "rgba(0,0,0,0.25)"
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted
  },
  filterCountTextActive: {
    color: "#FFFFFF"
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12
  },
  card: {
    backgroundColor: colors.darkSurface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    padding: 16,
    gap: 10
  },
  cardPriority: {
    borderLeftWidth: 4,
    borderLeftColor: colors.orange
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }]
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10
  },
  customerBlock: {
    flex: 1,
    gap: 4
  },
  customer: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800"
  },
  jobIdBadge: {
    backgroundColor: colors.darkElevated,
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  jobIdText: {
    color: colors.subtle,
    fontSize: 10,
    fontWeight: "700"
  },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8
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
  scheduledWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  scheduledText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600"
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
  addressWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1
  },
  addressText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    flex: 1
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
  emptyList: {
    flexGrow: 1,
    justifyContent: "center"
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
