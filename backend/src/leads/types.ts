export type LeadIntent =
  | "schedule_exam"
  | "schedule_consultation"
  | "severe_symptoms";

export type LeadSource = {
  pageUrl?: string;
  landingPageUrl?: string;
  referrer?: string;
  parentOrigin?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
    id?: string;
  };
  clickIds?: {
    fbclid?: string;
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    msclkid?: string;
  };
  cookies?: {
    fbp?: string;
    fbc?: string;
    gaClientId?: string;
  };
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
  /** Optional contact fields from custom dialogue mapsTo. */
  phone?: string;
  email?: string;
  message?: string;
  /** Custom saveAs categories from the dialogue builder. */
  customFields?: Record<string, string>;
  /** Step answers from the custom dialogue interpreter (bots with dialogue v1). */
  answers?: Record<string, string | string[]>;
  /** When "custom_dialogue", intent branching rules are relaxed. */
  flowMode?: "legacy" | "custom_dialogue";
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
