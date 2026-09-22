import type { Job } from "../../services/jobs";
import type { Template } from "../../services/templates";

export type RootStackParamList = {
  Login: undefined;
  Jobs: undefined;
  JobDetails: { job: Job };
  MyTemplates: undefined;
  OperatorHome: undefined;
  Capture: { job?: Job; template?: Template; templateId?: string; jobId?: string };
  Templates: undefined;
  FillTemplate: { template: Template; preselectedJobId?: string };
};
