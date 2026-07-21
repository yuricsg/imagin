import type { CreateLeadRecordInput, LeadRecord } from "./types.js";

export type LeadListOptions = {
  botId?: string;
  clientId?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export type LeadRepository = {
  list(options?: LeadListOptions): Promise<LeadRecord[]>;
  create(input: CreateLeadRecordInput): Promise<LeadRecord>;
  findById(id: string): Promise<LeadRecord | null>;
  updateStatus(id: string, status: LeadRecord["status"]): Promise<LeadRecord | null>;
};
