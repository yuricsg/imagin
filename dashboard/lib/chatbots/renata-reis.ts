import type { Chatbot } from "./types";
import { defaultFlowForTemplate } from "./flows";
import { DEFAULT_WHATSAPP_MESSAGE_TEMPLATE } from "./whatsapp";

const flowDefaults = defaultFlowForTemplate("patient-capture");

/**
 * Seed bot shipped with the dashboard — demonstrates a live catalog entry with
 * leads, flow config and optional GA tracking. Not editable from the UI.
 */
export const renataReis: Chatbot = {
  id: "dra-renata-reis",
  name: "Dra. Renata Reis",
  clientId: "clinica-renata-reis",
  clientName: "Clínica Renata Reis",
  status: "active",
  specialty: "Captação de pacientes — Dermatologia",
  accent: "indigo",
  createdAt: "2026-01-12T09:00:00.000Z",
  flow: {
    templateId: flowDefaults.templateId,
    tone: flowDefaults.tone,
    greeting: "",
    collectFields: flowDefaults.collectFields,
  },
  tracking: {
    gaMeasurementId: "G-RENATA-DEMO1",
    metaPixelId: "",
  },
  whatsapp: {
    enabled: false,
    phoneNumber: "",
    messageTemplate: DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  },
  embed: {
    apiBaseUrl: "https://api.imagin.app",
    appBaseUrl: "https://app.imagin.app",
    scriptPath: "/embed/widget.js",
  },
};
