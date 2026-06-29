import type { CreateLeadRecordInput, LeadRecord } from "./types.js";

export type LeadRepository = {
  list(): Promise<LeadRecord[]>;
  create(input: CreateLeadRecordInput): Promise<LeadRecord>;
};
