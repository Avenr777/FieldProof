import { Platform, Pressable, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ActivityIndicator } from "react-native";
import { colors, gradients, shadows } from "../../constants/theme";

type ButtonVariant = "primary" | "dark" | "secondary" | "outline";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: object;
  textStyle?: object;
  icon?: React.ReactNode;
};

function tap() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  textStyle,
  icon
}: Props) {
  const isDisabled = loading || disabled;

  const handlePress = () => {
    if (isDisabled) return;
    tap();
    onPress();
  };

  const content = loading ? (
    <ActivityIndicator
      color={variant === "primary" ? "#FFFFFF" : colors.orangeBright}
      size="small"
    />
  ) : (
    <>
      {icon}
      <Text
        style={[
          styles.label,
          variant === "secondary" && styles.labelSecondary,
          variant === "outline" && styles.labelOutline,
          textStyle
        ]}
      >
        {title}
      </Text>
    </>
  );

  if (variant === "primary" && !isDisabled) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.base, pressed && styles.pressed, style]}
      >
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradientFill}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === "dark" && styles.dark,
        variant === "secondary" && styles.secondary,
        variant === "outline" && styles.outline,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 20,
    gap: 8,
    overflow: "hidden" as never,
    cursor: "pointer" as never
  },
  gradientFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    ...shadows.orangeGlow
  },
  dark: {
    backgroundColor: colors.darkSurface,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    ...shadows.card
  },
  secondary: {
    backgroundColor: colors.darkElevated,
    borderWidth: 1,
    borderColor: colors.darkBorder
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.orange
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }]
  },
  disabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0
  },
  label: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.2
  },
  labelSecondary: {
    color: colors.text
  },
  labelOutline: {
    color: colors.orangeBright
  }
});
