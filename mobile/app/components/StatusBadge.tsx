import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../constants/theme";

type StatusConfig = {
  bg: string;
  text: string;
  border: string;
  dot: string;
};

const STATUS_MAP: Record<string, StatusConfig> = {
  "Awaiting Review": {
    bg: colors.warningLight,
    text: colors.warning,
    border: colors.warningBorder,
    dot: colors.amber
  },
  "Pending Review": {
    bg: colors.warningLight,
    text: colors.warning,
    border: colors.warningBorder,
    dot: colors.amber
  },
  "In Progress": {
    bg: colors.orangeLight,
    text: colors.orangeBright,
    border: colors.orangeBorder,
    dot: colors.orange
  },
  "Compliance Flag": {
    bg: colors.dangerLight,
    text: colors.danger,
    border: colors.dangerBorder,
    dot: colors.danger
  },
  "Completed": {
    bg: colors.successLight,
    text: colors.success,
    border: colors.successBorder,
    dot: colors.success
  },
  "Approved": {
    bg: colors.successLight,
    text: colors.success,
    border: colors.successBorder,
    dot: colors.success
  },
  "Scheduled": {
    bg: colors.darkElevated,
    text: colors.textSecondary,
    border: colors.darkBorder,
    dot: colors.subtle
  }
};

const DEFAULT_CONFIG: StatusConfig = {
  bg: colors.darkElevated,
  text: colors.textSecondary,
  border: colors.darkBorder,
  dot: colors.subtle
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_MAP[status] || DEFAULT_CONFIG;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
      <View style={[styles.dot, { backgroundColor: config.dot }]} />
      <Text style={[styles.text, { color: config.text }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2
  }
});
