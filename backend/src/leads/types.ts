export type LeadIntent =
  | "schedule_exam"
  | "schedule_consultation"
  | "severe_symptoms";

export type LeadSource = {
  pageUrl?: string;
  referrer?: string;
  parentOrigin?: string;
};

export type LeadSubmission = {
  botId: string;
  clientId: string;
  name: string;
  intent: LeadIntent;
  selectedExams?: string[];
  medicalRequestStatus?: string;
  consultationNeed?: string;
  consultationDecision?: string;
  source: LeadSource;
};

export type CreateLeadRecordInput = LeadSubmission & {
  whatsappMessage: string;
  whatsappUrl: string;
};

export type LeadRecord = CreateLeadRecordInput & {
  id: string;
  status: "new" | "contacted" | "archived";
  createdAt: string;
  updatedAt: string;
};
