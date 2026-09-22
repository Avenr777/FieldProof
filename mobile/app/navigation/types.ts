import type { Template } from "../../services/templates";

export type RootStackParamList = {
  Login: undefined;
  /** Technician home: templates assigned by the operator. */
  MyTemplates: undefined;
  /** Operator/owner home: team uploads & document status console. */
  OperatorHome: undefined;
  Capture: { template: Template };
};
