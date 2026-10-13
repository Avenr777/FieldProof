import type { Job } from "../../services/jobs";
import type { Template } from "../../services/templates";

export type RootStackParamList = {
  Login: undefined;
<<<<<<< Updated upstream
  Jobs: undefined;
  JobDetails: { job: Job };
=======
  /** Set the API server URL by scanning a QR or typing it manually. */
  ServerConfig: undefined;
  /** Technician home: templates assigned by the operator. */
>>>>>>> Stashed changes
  MyTemplates: undefined;
  OperatorHome: undefined;
  Capture: { job?: Job; template?: Template; templateId?: string; jobId?: string };
  Templates: undefined;
  FillTemplate: { template: Template; preselectedJobId?: string };
};
