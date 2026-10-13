import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { colors } from "../../constants/theme";
import { CaptureScreen } from "../screens/CaptureScreen";
import { JobDetailsScreen } from "../screens/JobDetailsScreen";
import { MyTemplatesScreen } from "../screens/MyTemplatesScreen";
import { OperatorHomeScreen } from "../screens/OperatorHomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { TemplatesScreen } from "../screens/TemplatesScreen";
import { FillTemplateScreen } from "../screens/FillTemplateScreen";
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
            <>
              <Stack.Screen
                name="OperatorHome"
                component={OperatorHomeScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="JobDetails"
                component={JobDetailsScreen}
                options={{ title: "Job Details" }}
              />
              <Stack.Screen
                name="Capture"
                component={CaptureScreen}
                options={{ title: "Job-Site Capture" }}
              />
              <Stack.Screen
                name="Templates"
                component={TemplatesScreen}
                options={{ title: "Assigned Templates" }}
              />
              <Stack.Screen
                name="FillTemplate"
                component={FillTemplateScreen}
                options={{ title: "Fill Template" }}
              />
            </>
          ) : (
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
              <Stack.Screen
                name="FillTemplate"
                component={FillTemplateScreen}
                options={{ title: "Fill Template" }}
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
