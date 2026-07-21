import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  CreateLeadRecordInput,
  LeadRecord,
} from "./types.js";
import type { LeadListOptions, LeadRepository } from "./lead-repository.js";
import { deriveSubmittedLeadStatus } from "./lead-status.js";

export class FileLeadRepository implements LeadRepository {
  constructor(private readonly filePath: string) {}

  async list(options: LeadListOptions = {}): Promise<LeadRecord[]> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(contents);

      const leads = Array.isArray(parsed) ? parsed.map(coerceLeadRecord) : [];
      const filtered = leads
        .filter((lead) => !options.botId || lead.botId === options.botId)
        .filter((lead) => !options.clientId || lead.clientId === options.clientId)
        .filter((lead) => !options.from || lead.createdAt >= options.from)
        .filter((lead) => !options.to || lead.createdAt <= options.to)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      return options.limit ? filtered.slice(0, options.limit) : filtered;
    } catch (error) {
      if (isMissingFileError(error)) {
        return [];
      }

      throw error;
    }
  }

  async create(input: CreateLeadRecordInput): Promise<LeadRecord> {
    const now = new Date().toISOString();
    const lead: LeadRecord = {
      ...input,
      id: randomUUID(),
      status: deriveSubmittedLeadStatus(input),
      createdAt: now,
      updatedAt: now,
    };
    const leads = await this.list();

    leads.push(lead);
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(leads, null, 2)}\n`, "utf8");

    return lead;
  }

  async findById(id: string): Promise<LeadRecord | null> {
    return (await this.list()).find((lead) => lead.id === id) ?? null;
  }

  async updateStatus(
    id: string,
    status: LeadRecord["status"],
  ): Promise<LeadRecord | null> {
    const leads = await this.list();
    const index = leads.findIndex((lead) => lead.id === id);
    if (index < 0) return null;
    const updated: LeadRecord = {
      ...leads[index],
      status,
      updatedAt: new Date().toISOString(),
    };
    leads[index] = updated;
    await writeFile(this.filePath, `${JSON.stringify(leads, null, 2)}\n`, "utf8");
    return updated;
  }
}

function coerceLeadRecord(value: unknown): LeadRecord {
  return value as LeadRecord;
}

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
