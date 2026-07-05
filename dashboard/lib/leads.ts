import { getChatbotById } from "./chatbots/catalog";
import type { Lead, LeadAttribution, LeadStatus } from "./chatbots/types";

type LeadSeed = {
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  message: string;
  sourceUrl: string;
  attribution: LeadAttribution;
  botId: string;
  /** Minutes before the reference "now". Drives the period filters. */
  minutesAgo: number;
};

// Hand-authored so output is deterministic across renders. Recency is expressed
// as minutesAgo and resolved against a single "now" passed in by the caller,
// which keeps server and client on the same clock (no hydration drift).
const LEAD_SEEDS: LeadSeed[] = [
  {
    name: "Camila Andrade",
    email: "camila.andrade@gmail.com",
    phone: "+55 11 99812-4471",
    status: "new",
    message: "Gostaria de agendar uma avaliação de melasma.",
    sourceUrl: "clinicarenata.com.br/tratamentos",
    attribution: {
      channel: "google",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "dermatologia-sp",
    },
    botId: "dra-renata-reis",
    minutesAgo: 18,
  },
  {
    name: "Rafael Monteiro",
    email: "rafaelm@outlook.com",
    phone: "+55 11 99645-1180",
    status: "new",
    message: "Quanto custa o protocolo de skinbooster?",
    sourceUrl: "clinicarenata.com.br",
    attribution: {
      channel: "meta",
      utmSource: "facebook",
      utmMedium: "paid",
      utmCampaign: "skinbooster-mar",
    },
    botId: "dra-renata-reis",
    minutesAgo: 52,
  },
  {
    name: "Beatriz Lopes",
    email: "bia.lopes@hotmail.com",
    phone: "+55 21 98123-7740",
    status: "contacted",
    message: "Tenho interesse em laser para rosácea.",
    sourceUrl: "clinicarenata.com.br/laser",
    attribution: {
      channel: "organic",
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    },
    botId: "dra-renata-reis",
    minutesAgo: 190,
  },
  {
    name: "Thiago Ferreira",
    email: "thiago.f@gmail.com",
    phone: "+55 11 99230-5512",
    status: "qualified",
    message: "Quero remarcar minha consulta de retorno.",
    sourceUrl: "clinicarenata.com.br/contato",
    attribution: {
      channel: "direct",
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    },
    botId: "dra-renata-reis",
    minutesAgo: 540,
  },
  {
    name: "Larissa Pires",
    email: "larissapires@gmail.com",
    phone: "+55 11 98877-2031",
    status: "converted",
    message: "Fechei o pacote de 4 sessões, obrigada!",
    sourceUrl: "clinicarenata.com.br/promo",
    attribution: {
      channel: "google",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "promo-verao",
    },
    botId: "dra-renata-reis",
    minutesAgo: 1290,
  },
  {
    name: "Juliana Castro",
    email: "ju.castro@yahoo.com",
    phone: "+55 31 99411-8820",
    status: "new",
    message: "Atende plano de saúde?",
    sourceUrl: "clinicarenata.com.br",
    attribution: {
      channel: "referral",
      utmSource: "instagram",
      utmMedium: "social",
      utmCampaign: null,
    },
    botId: "dra-renata-reis",
    minutesAgo: 2880,
  },
  {
    name: "Marcos Vinícius",
    email: "marcosv@gmail.com",
    phone: "+55 11 99002-3344",
    status: "lost",
    message: "Achei o valor acima do meu orçamento.",
    sourceUrl: "clinicarenata.com.br/precos",
    attribution: {
      channel: "meta",
      utmSource: "instagram",
      utmMedium: "paid",
      utmCampaign: "precos-remarketing",
    },
    botId: "dra-renata-reis",
    minutesAgo: 5760,
  },
  {
    name: "Patrícia Gomes",
    email: "paty.gomes@gmail.com",
    phone: "+55 11 98456-9087",
    status: "qualified",
    message: "Quero entender o pós-procedimento.",
    sourceUrl: "clinicarenata.com.br/faq",
    attribution: {
      channel: "organic",
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    },
    botId: "dra-renata-reis",
    minutesAgo: 8640,
  },
];

function buildLeads(nowMs: number): Lead[] {
  return LEAD_SEEDS.map((seed, index) => {
    const bot = getChatbotById(seed.botId);
    const createdAt = new Date(nowMs - seed.minutesAgo * 60_000).toISOString();
    return {
      id: `lead-${String(index + 1).padStart(3, "0")}`,
      botId: seed.botId,
      clientId: bot?.clientId ?? seed.botId,
      name: seed.name,
      email: seed.email,
      phone: seed.phone,
      status: seed.status,
      message: seed.message,
      sourceUrl: seed.sourceUrl,
      attribution: seed.attribution,
      createdAt,
    };
  });
}

/**
 * Returns every lead, newest first. Async on purpose: swapping for `fetch`
 * against the Hono backend later keeps callers unchanged.
 */
export async function getLeads(nowMs: number = Date.now()): Promise<Lead[]> {
  return buildLeads(nowMs).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}
