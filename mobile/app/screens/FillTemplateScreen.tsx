import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getJobs, type Job } from "../../services/jobs";
import {
  fillTemplate,
  getTemplateFields,
  type TemplateField
} from "../../services/templates";
import { colors } from "../../constants/theme";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "FillTemplate">;

export function FillTemplateScreen({ route, navigation }: Props) {
  const { template, preselectedJobId } = route.params;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(preselectedJobId || "");
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successDoc, setSuccessDoc] = useState<any | null>(null);

  // Voice dictation modal state
  const [activeVoiceField, setActiveVoiceField] = useState<TemplateField | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const [dictatedText, setDictatedText] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [jobsList, extraction] = await Promise.all([
          getJobs(),
          getTemplateFields(template.id)
        ]);
        setJobs(jobsList);
        if (jobsList.length > 0 && !selectedJobId) {
          setSelectedJobId(jobsList[0].id);
        }
        setFields(extraction.fields || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load template fields");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [template.id]);

  const handleValueChange = (fieldId: string, val: any) => {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
  };

  const handleStartVoice = (field: TemplateField) => {
    setActiveVoiceField(field);
    setDictatedText(values[field.field_id] || "");
    setIsDictating(true);
  };

  const handleSaveVoice = () => {
    if (activeVoiceField) {
      handleValueChange(activeVoiceField.field_id, dictatedText);
    }
    setIsDictating(false);
    setActiveVoiceField(null);
  };

  const handleSubmit = async () => {
    if (!selectedJobId) {
      Alert.alert("Job Required", "Please select a job to link this document to.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const doc = await fillTemplate(template.id, selectedJobId, values);
      setSuccessDoc(doc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate document");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.orange} />
        <Text style={styles.loadingText}>Extracting form fields...</Text>
      </View>
    );
  }

  if (successDoc) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIconBadge}>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" />
          </View>
          <Text style={styles.successTitle}>Document Submitted!</Text>
          <Text style={styles.successSubtitle}>
            Form "{template.name}" was filled and saved for job {selectedJobId}.
          </Text>

          <Pressable
            style={styles.primaryBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.primaryBtnText}>Return to Capture</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.templateTitle}>{template.name}</Text>
      <Text style={styles.templateMeta}>{template.trade} Form · {fields.length} Fields</Text>

      {/* Job Picker */}
      <View style={styles.sectionCard}>
        <Text style={styles.fieldLabel}>Attached Job</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.jobPickerScroll}>
          {jobs.map((job) => {
            const isSelected = job.id === selectedJobId;
            return (
              <Pressable
                key={job.id}
                onPress={() => setSelectedJobId(job.id)}
                style={[styles.jobChip, isSelected && styles.jobChipSelected]}
              >
                <Text style={[styles.jobChipText, isSelected && styles.jobChipTextSelected]}>
                  {job.id} · {job.customer}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color="#FF453A" />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Form Fields */}
      <View style={styles.formContainer}>
        {fields.map((f) => {
          const fieldType = f.field_type || "text";
          const label = f.label || f.field_id;
          const val = values[f.field_id];

          if (fieldType === "checkbox") {
            return (
              <View key={f.field_id} style={styles.checkboxRow}>
                <View style={styles.checkboxLabelContainer}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <Text style={styles.fieldTypeTag}>Checkbox</Text>
                </View>
                <Switch
                  value={!!val}
                  onValueChange={(checked) => handleValueChange(f.field_id, checked)}
                  trackColor={{ false: "#333", true: colors.orange }}
                  thumbColor="#FFF"
                />
              </View>
            );
          }

          const isMultiline = fieldType === "multiline_text" || Boolean(f.kind?.includes("multiline"));

          return (
            <View key={f.field_id} style={styles.inputCard}>
              <View style={styles.inputHeader}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <Pressable
                  onPress={() => handleStartVoice(f)}
                  style={styles.voiceBtn}
                >
                  <Ionicons name="mic" size={14} color={colors.orangeBright} />
                  <Text style={styles.voiceBtnText}>Voice</Text>
                </Pressable>
              </View>

              <TextInput
                style={[styles.input, isMultiline && styles.multilineInput]}
                multiline={isMultiline}
                numberOfLines={isMultiline ? 3 : 1}
                placeholder={`Enter ${label.toLowerCase()}...`}
                placeholderTextColor="#555"
                value={val !== undefined ? String(val) : ""}
                onChangeText={(t) => handleValueChange(f.field_id, t)}
              />
            </View>
          );
        })}
      </View>

      {/* Submit Button */}
      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        style={[styles.primaryBtn, submitting && styles.disabledBtn]}
      >
        {submitting ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Ionicons name="send" size={18} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Submit & Generate Document</Text>
          </>
        )}
      </Pressable>

      {/* Voice Dictation Modal */}
      <Modal visible={isDictating} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="mic-circle" size={32} color={colors.orange} />
              <Text style={styles.modalTitle}>Voice Input: {activeVoiceField?.label}</Text>
            </View>

            <Text style={styles.modalHint}>
              Speak or type to dictating field value:
            </Text>

            <TextInput
              style={styles.dictationInput}
              multiline
              value={dictatedText}
              onChangeText={setDictatedText}
              placeholder="Dictated text will appear here..."
              placeholderTextColor="#666"
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setIsDictating(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalSaveBtn}
                onPress={handleSaveVoice}
              >
                <Text style={styles.modalSaveText}>Apply to Field</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.black
  },
  loadingText: {
    color: "#8E8E93",
    marginTop: 12,
    fontSize: 14
  },
  templateTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4
  },
  templateMeta: {
    color: colors.orangeBright,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 16
  },
  sectionCard: {
    backgroundColor: colors.darkSurface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#28282C"
  },
  jobPickerScroll: {
    marginTop: 8,
    flexDirection: "row"
  },
  jobChip: {
    backgroundColor: "#222",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#333"
  },
  jobChipSelected: {
    backgroundColor: colors.orange,
    borderColor: colors.orange
  },
  jobChipText: {
    color: "#AAA",
    fontSize: 12,
    fontWeight: "600"
  },
  jobChipTextSelected: {
    color: "#FFF"
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 69, 58, 0.15)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8
  },
  errorBannerText: {
    color: "#FF453A",
    fontSize: 13,
    flex: 1
  },
  formContainer: {
    gap: 12,
    marginBottom: 20
  },
  inputCard: {
    backgroundColor: colors.darkSurface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#28282C"
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  fieldLabel: {
    color: "#DDD",
    fontSize: 13,
    fontWeight: "600"
  },
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(242, 98, 42, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  voiceBtnText: {
    color: colors.orangeBright,
    fontSize: 11,
    fontWeight: "700"
  },
  input: {
    backgroundColor: "#1A1A1E",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#333"
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: "top"
  },
  checkboxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.darkSurface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#28282C"
  },
  checkboxLabelContainer: {
    flex: 1
  },
  fieldTypeTag: {
    color: "#666",
    fontSize: 10,
    marginTop: 2
  },
  primaryBtn: {
    backgroundColor: colors.orange,
    borderRadius: 25,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800"
  },
  disabledBtn: {
    opacity: 0.6
  },
  secondaryBtn: {
    backgroundColor: "#222",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12
  },
  secondaryBtnText: {
    color: "#DDD",
    fontSize: 14,
    fontWeight: "600"
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  successIconBadge: {
    marginBottom: 16
  },
  successTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8
  },
  successSubtitle: {
    color: "#AAA",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end"
  },
  modalContent: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700"
  },
  modalHint: {
    color: "#8E8E93",
    fontSize: 12,
    marginBottom: 12
  },
  dictationInput: {
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    padding: 14,
    color: "#FFF",
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 16
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  modalCancelText: {
    color: "#8E8E93",
    fontWeight: "600"
  },
  modalSaveBtn: {
    backgroundColor: colors.orange,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18
  },
  modalSaveText: {
    color: "#FFF",
    fontWeight: "700"
  }
});
