import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { colors } from "../../constants/theme";
import { CaptureScreen } from "../screens/CaptureScreen";
import { MyTemplatesScreen } from "../screens/MyTemplatesScreen";
import { OperatorHomeScreen } from "../screens/OperatorHomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Owners and admins get the operator console; technicians get capture. */
export function isOperator(role: string | undefined | null): boolean {
  return role === "Owner" || role === "Admin";
}

export function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.black }}>
        <ActivityIndicator size="large" color={colors.orange} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.black },
          headerTintColor: colors.orangeBright,
          headerTitleStyle: { color: "#FFFFFF", fontWeight: "800", fontSize: 17 },
          contentStyle: { backgroundColor: colors.black }
        }}
      >
        {user ? (
          isOperator(user.role) ? (
            // Owner / Admin: team console with uploads & document status.
            <Stack.Screen
              name="OperatorHome"
              component={OperatorHomeScreen}
              options={{ headerShown: false }}
            />
          ) : (
            // Technician: assigned templates -> field capture.
            <>
              <Stack.Screen
                name="MyTemplates"
                component={MyTemplatesScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Capture"
                component={CaptureScreen}
                options={{ title: "Field Capture" }}
              />
            </>
          )
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
