import { SafeAreaView, StyleSheet, View, ViewStyle } from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors } from "../../constants/theme";

type Props = {
  children: React.ReactNode;
  /** Extra padding around the scroll/content area */
  padded?: boolean;
  style?: ViewStyle;
};

/** Consistent dark SafeArea shell for every screen. */
export function Screen({ children, padded = false, style }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={[styles.fill, padded && styles.padded, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.black
  },
  fill: {
    flex: 1,
    backgroundColor: colors.black
  },
  padded: {
    padding: 18
  }
});
