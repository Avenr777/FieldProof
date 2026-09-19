import { useCallback, useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { getJob, type Job } from "../../services/jobs";
import { colors, gradients } from "../../constants/theme";
import { formatDate } from "../../utils/format";
import { PrimaryButton } from "../components/PrimaryButton";
import { Screen } from "../components/Screen";
import { StatusBadge } from "../components/StatusBadge";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "JobDetails">;

export function JobDetailsScreen({ route, navigation }: Props) {
  const [job, setJob] = useState<Job>(route.params.job);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setJob(await getJob(route.params.job.id));
    } finally {
      setLoading(false);
    }
  }, [route.params.job.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.screen}>
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.orange} />
          <Text style={styles.loadingText}>Syncing job details…</Text>
        </View>
      )}

      {/* Main Job Overview Card */}
      <LinearGradient
        colors={gradients.sheen}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.topMeta}>
          <View style={styles.idChip}>
            <Text style={styles.idChipText}>{job.id}</Text>
          </View>
          <StatusBadge status={job.status} />
        </View>

        <Text style={styles.customerName}>{job.customer}</Text>
        <Text style={styles.jobTypeTag}>
          <Ionicons name="flash" size={13} color={colors.orangeBright} /> {job.job_type}
        </Text>

        <View style={styles.divider} />

        {/* Details Grid */}
        <View style={styles.detailsList}>
          <DetailItem
            icon="location-outline"
            label="SITE LOCATION"
            value={job.site_address || "Address not specified"}
          />
          <DetailItem
            icon="calendar-outline"
            label="SCHEDULED DATE"
            value={formatDate(job.scheduled_at)}
          />
          {job.notes ? (
            <DetailItem
              icon="document-text-outline"
              label="SPECIAL INSTRUCTIONS & NOTES"
              value={job.notes}
            />
          ) : null}
        </View>
      </LinearGradient>

      {/* Capture Action Banner */}
      <View style={styles.captureBanner}>
        <View style={styles.captureHeader}>
          <View style={styles.captureIconGroup}>
            <View style={styles.captureIconCircle}>
              <Ionicons name="mic" size={17} color={colors.orangeBright} />
            </View>
            <View style={styles.captureIconCircle}>
              <Ionicons name="camera" size={17} color={colors.orangeBright} />
            </View>
          </View>
          <View style={styles.captureTextGroup}>
            <Text style={styles.captureTitle}>Site Capture Ready</Text>
            <Text style={styles.captureSubtitle}>
              Record voice notes and capture equipment labels to build compliant field docs.
            </Text>
          </View>
        </View>

        <PrimaryButton
          title="Add Site Capture"
          onPress={() => navigation.navigate("Capture", { job })}
          variant="primary"
          style={styles.captureBtn}
        />
      </View>
      </ScrollView>
    </Screen>
  );
}

function DetailItem({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <View style={styles.detailIconBox}>
        <Ionicons name={icon} size={16} color={colors.orangeBright} />
      </View>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: colors.black,
    padding: 18,
    gap: 16
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6
  },
  loadingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600"
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    padding: 20,
    gap: 12
  },
  topMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  idChip: {
    backgroundColor: colors.darkElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  idChipText: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: "700"
  },
  customerName: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5
  },
  jobTypeTag: {
    color: colors.orangeBright,
    fontSize: 14,
    fontWeight: "800",
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  divider: {
    height: 1,
    backgroundColor: colors.darkBorder,
    marginVertical: 4
  },
  detailsList: {
    gap: 14
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  detailIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.orangeLight,
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2
  },
  detailContent: {
    flex: 1,
    gap: 2
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6
  },
  detailValue: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22
  },
  captureBanner: {
    backgroundColor: colors.darkSurface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    padding: 20,
    gap: 18
  },
  captureHeader: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start"
  },
  captureIconGroup: {
    flexDirection: "row",
    gap: 6
  },
  captureIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.orangeLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.orangeBorder
  },
  captureTextGroup: {
    flex: 1,
    gap: 4
  },
  captureTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800"
  },
  captureSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  captureBtn: {}
});
