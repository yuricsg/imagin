import type { CreateLeadRecordInput, LeadRecord } from "./types.js";

export type LeadRepository = {
  list(): Promise<LeadRecord[]>;
  create(input: CreateLeadRecordInput): Promise<LeadRecord>;
  findById(id: string): Promise<LeadRecord | null>;
  updateStatus(id: string, status: LeadRecord["status"]): Promise<LeadRecord | null>;
};
