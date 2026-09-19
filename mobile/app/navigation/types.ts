import type { Job } from "../../services/jobs";

export type RootStackParamList = {
  Login: undefined;
  Jobs: undefined;
  JobDetails: { job: Job };
  Capture: { job: Job };
};
