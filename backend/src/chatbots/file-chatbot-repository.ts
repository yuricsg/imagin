import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  staticChatbotDefinitions,
  toPublicChatbotConfig,
} from "./catalog.js";
import { getConversationFlow } from "./conversation-flows.js";
import {
  defaultButtonTexts,
  defaultConsultationDecisions,
  defaultConsultationNeeds,
  defaultExamOptions,
  defaultMedicalRequestOptions,
  formatStandardWhatsAppMessage,
} from "./standard-flow.js";
import type {
  ChatbotDefinition,
  CreateChatbotInput,
  PublicChatbotConfig,
} from "./types.js";

export type ChatbotRepository = {
  list(): Promise<ChatbotDefinition[]>;
  listPublic(): Promise<PublicChatbotConfig[]>;
  get(botId: string): Promise<ChatbotDefinition | null>;
  create(input: CreateChatbotInput): Promise<PublicChatbotConfig>;
  update?(botId: string, input: Partial<CreateChatbotInput>): Promise<PublicChatbotConfig | null>;
  delete?(botId: string): Promise<boolean>;
};

type StoredChatbot = Omit<ChatbotDefinition, "formatWhatsAppMessage">;

export class FileChatbotRepository implements ChatbotRepository {
  constructor(private readonly filePath: string) {}

  async list(): Promise<ChatbotDefinition[]> {
    const customChatbots = await this.readCustomChatbots();

    return [
      ...staticChatbotDefinitions,
      ...customChatbots.map(toChatbotDefinition),
    ];
  }

  async listPublic(): Promise<PublicChatbotConfig[]> {
    return (await this.list()).map(toPublicChatbotConfig);
  }

  async get(botId: string): Promise<ChatbotDefinition | null> {
    return (await this.list()).find((chatbot) => chatbot.botId === botId) ?? null;
  }

  async create(input: CreateChatbotInput): Promise<PublicChatbotConfig> {
    const existing = await this.get(input.botId);

    if (existing) {
      throw new Error("CHATBOT_ALREADY_EXISTS");
    }

    const customChatbots = await this.readCustomChatbots();
    const storedChatbot = normalizeStoredChatbot(input);

    customChatbots.push(storedChatbot);
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(
      this.filePath,
      `${JSON.stringify(customChatbots, null, 2)}\n`,
      "utf8",
    );

    return toPublicChatbotConfig(toChatbotDefinition(storedChatbot));
  }

  private async readCustomChatbots(): Promise<StoredChatbot[]> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(contents);

      return Array.isArray(parsed) ? parsed.map(normalizeStoredChatbot) : [];
    } catch (error) {
      if (isMissingFileError(error)) {
        return [];
      }

      throw error;
    }
  }
}

function normalizeStoredChatbot(input: CreateChatbotInput | StoredChatbot) {
  const tracking = input.tracking ?? {};
  const meta = tracking.meta ?? {};
  const googleAnalytics = tracking.googleAnalytics ?? {};

  return {
    botId: input.botId,
    name: input.name,
    clientId: input.clientId,
    clientName: input.clientName,
    status: normalizeStatus(input.status),
    flowKey: getConversationFlow(input.flowKey).key,
    description: input.description ?? "",
    whatsappPhone: input.whatsappPhone ?? "",
    tracking: {
      meta: {
        pixelId: meta.pixelId,
        accessToken: meta.accessToken,
        testEventCode: meta.testEventCode,
      },
      googleAnalytics: {
        measurementId: googleAnalytics.measurementId,
        apiSecret: googleAnalytics.apiSecret,
      },
    },
    buttonTexts: normalizeStringList(input.buttonTexts, defaultButtonTexts),
    examOptions: normalizeStringList(input.examOptions, defaultExamOptions),
    medicalRequestOptions: normalizeStringList(
      input.medicalRequestOptions,
      defaultMedicalRequestOptions,
    ),
    consultationNeeds: normalizeStringList(
      input.consultationNeeds,
      defaultConsultationNeeds,
    ),
    consultationDecisions: normalizeStringList(
      input.consultationDecisions,
      defaultConsultationDecisions,
    ),
    dashboardConfig:
      "dashboardConfig" in input ? input.dashboardConfig : undefined,
  } satisfies StoredChatbot;
}

function toChatbotDefinition(chatbot: StoredChatbot): ChatbotDefinition {
  return {
    ...chatbot,
    formatWhatsAppMessage: (lead) =>
      formatStandardWhatsAppMessage(lead, chatbot.dashboardConfig),
  };
}

function normalizeStatus(status: unknown): StoredChatbot["status"] {
  return status === "draft" || status === "archived" ? status : "active";
}

function normalizeStringList(value: unknown, fallback: string[]) {
  const normalized = Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  return normalized.length > 0 ? normalized : fallback;
}

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
