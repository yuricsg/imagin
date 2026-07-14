import assert from "node:assert/strict";
import test from "node:test";
import {
  applySessionEvent,
  deriveAutomaticLeadStatus,
  isAppointmentRequestText,
  isNotInterestedText,
} from "./session-state.js";
import type { ChatSessionRecord } from "./types.js";

const openedAt = "2026-07-14T12:00:00.000Z";

function session(overrides: Partial<ChatSessionRecord> = {}): ChatSessionRecord {
  return {
    id: "session-1",
    botId: "bot-1",
    clientId: "client-1",
    flowMode: "legacy",
    answers: {},
    source: {},
    openedAt,
    lastActivityAt: openedAt,
    createdAt: openedAt,
    updatedAt: openedAt,
    events: [],
    ...overrides,
  };
}

test("derives new and abandoned from the 30 minute inactivity window", () => {
  assert.equal(
    deriveAutomaticLeadStatus(session(), Date.parse(openedAt) + 29 * 60_000),
    "new",
  );
  assert.equal(
    deriveAutomaticLeadStatus(session(), Date.parse(openedAt) + 30 * 60_000),
    "abandoned",
  );
});

test("uses the strongest automatic funnel outcome", () => {
  assert.equal(
    deriveAutomaticLeadStatus(session({ whatsappClickedAt: openedAt })),
    "whatsapp_handoff",
  );
  assert.equal(
    deriveAutomaticLeadStatus(
      session({ whatsappClickedAt: openedAt, appointmentRequestedAt: openedAt }),
    ),
    "appointment_requested",
  );
  assert.equal(
    deriveAutomaticLeadStatus(
      session({ appointmentRequestedAt: openedAt, notInterestedAt: openedAt }),
    ),
    "not_interested",
  );
  assert.equal(
    deriveAutomaticLeadStatus(
      session({ notInterestedAt: openedAt, convertedAt: openedAt }),
    ),
    "converted",
  );
});

test("applies captured data and classifies explicit answers", () => {
  const named = applySessionEvent(
    session(),
    { type: "name_captured", name: "  Guilherme  ", stepId: "name" },
    "2026-07-14T12:01:00.000Z",
  );
  assert.equal(named.visitorName, "Guilherme");
  assert.equal(named.currentStep, "name");

  const requested = applySessionEvent(
    named,
    {
      type: "answer_submitted",
      stepId: "decision",
      label: "Quero agendar uma consulta",
      value: "schedule",
    },
    "2026-07-14T12:02:00.000Z",
  );
  assert.equal(requested.appointmentRequestedAt, "2026-07-14T12:02:00.000Z");
  assert.equal(requested.answers.decision, "schedule");

  const declined = applySessionEvent(
    requested,
    {
      type: "answer_submitted",
      stepId: "decision",
      label: "Não tenho interesse no momento",
      value: "no",
    },
    "2026-07-14T12:03:00.000Z",
  );
  assert.equal(deriveAutomaticLeadStatus(declined), "not_interested");
});

test("recognizes scheduling and no-interest copy without accents", () => {
  assert.equal(isAppointmentRequestText("Quero agendar uma consulta"), true);
  assert.equal(isAppointmentRequestText("Tenho dúvidas"), false);
  assert.equal(isNotInterestedText("Não tenho interesse no momento"), true);
  assert.equal(isAppointmentRequestText("Não quero agendar"), false);
});
