import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getAssignedTemplates, type Template } from "../../services/templates";
import { ApiError } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { colors, shadows, radius, spacing } from "../../constants/theme";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Templates">;

export function TemplatesScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setTemplates(await getAssignedTemplates());
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openTemplate = (template: Template) => {
    navigation.navigate("FillTemplate", { template });
  };

  const renderTemplate = ({ item }: { item: Template }) => {
    const fieldsCount = item.field_map ? item.field_map.length : 0;
    return (
      <Pressable
        onPress={() => openTemplate(item)}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Ionicons name="document-text-outline" size={24} color={colors.orangeBright} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.templateName}>{item.name}</Text>
            <View style={styles.tradeBadge}>
              <Text style={styles.tradeText}>{item.trade}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.fieldsText}>
            <Ionicons name="list-outline" size={14} color="#8E8E93" /> {fieldsCount} Detected Fields
          </Text>
          <View style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Fill Form</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.subHeader}>
        <Text style={styles.subtitle}>
          Select a template assigned to you by your admin to document your work.
        </Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.orange} />
          <Text style={styles.loadingText}>Loading assigned templates...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.orange} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          renderItem={renderTemplate}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.orange}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={56} color="#444" />
              <Text style={styles.emptyTitle}>No Templates Assigned</Text>
              <Text style={styles.emptySubtitle}>
                Your administrator has not assigned any document templates to your technician account yet.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black
  },
  subHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1C1C1E"
  },
  subtitle: {
    color: "#8E8E93",
    fontSize: 13,
    lineHeight: 18
  },
  listContent: {
    padding: 16,
    gap: 14
  },
  card: {
    backgroundColor: colors.glass,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadows.card
  },
  cardPressed: {
    opacity: 0.85,
    borderColor: colors.orange
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.orangeLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.orangeBorder,
    ...shadows.softGlow
  },
  headerInfo: {
    flex: 1
  },
  templateName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4
  },
  tradeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  tradeText: {
    color: colors.orangeBright,
    fontSize: 11,
    fontWeight: "600"
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#222"
  },
  fieldsText: {
    color: "#8E8E93",
    fontSize: 12
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.orange,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    ...shadows.orangeGlow
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  loadingText: {
    color: "#8E8E93",
    marginTop: 12,
    fontSize: 14
  },
  errorText: {
    color: "#FF453A",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 16,
    fontSize: 14
  },
  retryBtn: {
    backgroundColor: colors.orange,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    ...shadows.orangeGlow
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8
  },
  emptySubtitle: {
    color: "#8E8E93",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18
  }
});
