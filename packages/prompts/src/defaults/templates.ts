import type {
  DirectMessageStep,
  SequenceStep,
} from "@relanmo/domain/contracts";

import { ruleSource } from "./source";
import type { LeadAgentRuleSource } from "./source";

export const ALLOWED_TEMPLATE_VARIABLES = [
  "company",
  "craft",
  "dm2Detail",
  "dm2Fact",
  "dm3Detail",
  "dm3Fact",
  "firstName",
  "hiringRole",
  "sharedConnection",
  "signalDetail",
  "signalFact",
] as const;

export type AllowedTemplateVariable =
  (typeof ALLOWED_TEMPLATE_VARIABLES)[number];

export const DM1_HOOKS = [
  "RECRUITMENT",
  "FUNDING",
  "INBOUND_COMMENT",
  "INBOUND_LIKE",
  "MIGRATION",
  "NEUTRAL",
  "SHARED_CONNECTION",
  "ROLE_CHANGE",
  "PROSPECT_POST",
] as const;

export type Dm1Hook = (typeof DM1_HOOKS)[number];

export const FOLLOW_UP_HOOKS = [
  "DM2_OFFER",
  "DM2_PROSPECT_POST",
  "DM2_RELEASE",
  "DM2_NEUTRAL",
  "DM3_PRODUCT",
  "DM3_SPEAKING",
  "DM3_NEUTRAL",
  "DM4_LIGHT_NUDGE",
  "DM5_CLOSE",
] as const;

export type FollowUpHook = (typeof FOLLOW_UP_HOOKS)[number];
export type MessageHook = Dm1Hook | FollowUpHook | "INVITATION_WITHOUT_NOTE";

export type MessageTemplate = Readonly<{
  body: string;
  hook: MessageHook;
  id: string;
  maxCharacters: number | null;
  source: LeadAgentRuleSource;
  step: SequenceStep;
}>;

const PROFILE_TEMPLATES = ruleSource(
  "setup",
  "templates/lead-profile.example.md"
);
const HUNT_INVITATION = ruleSource("hunt", "skills/hunt/SKILL.md");
const DM_SKILL = ruleSource("dm", "skills/dm/SKILL.md");

export const FRENCH_WRITING_DEFAULTS = Object.freeze({
  dm1AllowsPitch: false,
  dm1AllowsSalesCta: false,
  forbiddenPhrases: Object.freeze([
    "je me permets de",
    "je serais ravi de vous accompagner",
    "n'hésitez pas",
  ]),
  greetings: Object.freeze(["Salut", "Hello"]),
  hiringSignalRequiredForIcpMatch: false,
  invitationHasNote: false,
  language: "fr-FR",
  maxCharactersByStep: Object.freeze({
    DM1: 300,
    DM2: 300,
    DM3: 300,
    DM4: 250,
    DM5: 250,
  } satisfies Record<DirectMessageStep, number>),
  source: PROFILE_TEMPLATES,
});

export const INVITATION_TEMPLATE: MessageTemplate = Object.freeze({
  body: "",
  hook: "INVITATION_WITHOUT_NOTE",
  id: "invitation-without-note",
  maxCharacters: null,
  source: HUNT_INVITATION,
  step: "INVITATION",
});

export const MESSAGE_TEMPLATES: readonly MessageTemplate[] = Object.freeze([
  INVITATION_TEMPLATE,
  Object.freeze({
    body: "Salut {{firstName}} ! Vu que vous cherchez un {{hiringRole}} en ce moment. Toujours le cas ?",
    hook: "RECRUITMENT",
    id: "dm1-recruitment",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM1",
  }),
  Object.freeze({
    body: "Salut {{firstName}} ! J'ai vu la levée de {{company}}. Qu'est-ce que ça change côté {{craft}} ?",
    hook: "FUNDING",
    id: "dm1-funding",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM1",
  }),
  Object.freeze({
    body: "Salut {{firstName}} ! Merci pour ton commentaire sur mon post sur {{signalFact}}. Quand tu dis « {{signalDetail}} », tu pensais à quel cas ?",
    hook: "INBOUND_COMMENT",
    id: "dm1-inbound-comment",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM1",
  }),
  Object.freeze({
    body: "Salut {{firstName}} ! Merci pour ton like sur mon post sur {{signalFact}}. C'est un sujet que vous rencontrez chez {{company}} ?",
    hook: "INBOUND_LIKE",
    id: "dm1-inbound-like",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM1",
  }),
  Object.freeze({
    body: "Salut {{firstName}} ! J'ai vu {{signalFact}} chez {{company}}. Ça avance comme prévu ?",
    hook: "MIGRATION",
    id: "dm1-migration",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM1",
  }),
  Object.freeze({
    body: "Salut {{firstName}} ! Tu travailles sur quoi côté {{craft}} chez {{company}} ?",
    hook: "NEUTRAL",
    id: "dm1-neutral",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM1",
  }),
  Object.freeze({
    body: "Salut {{firstName}} ! On a {{sharedConnection}} en commun côté {{craft}}. Tu travailles sur quoi chez {{company}} ?",
    hook: "SHARED_CONNECTION",
    id: "dm1-shared-connection",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM1",
  }),
  Object.freeze({
    body: "Salut {{firstName}} ! J'ai vu ta prise de poste chez {{company}}. Quel est le premier chantier côté {{craft}} ?",
    hook: "ROLE_CHANGE",
    id: "dm1-role-change",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM1",
  }),
  Object.freeze({
    body: "Salut {{firstName}} ! Ton post sur {{signalFact}} m'a parlé, surtout {{signalDetail}}. Tu le vois comment chez {{company}} ?",
    hook: "PROSPECT_POST",
    id: "dm1-prospect-post",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM1",
  }),
  Object.freeze({
    body: "Salut {{firstName}}, j'ai vu la nouvelle offre {{dm2Fact}} chez {{company}}. C'est un recrutement prioritaire en ce moment ?",
    hook: "DM2_OFFER",
    id: "dm2-offer",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM2",
  }),
  Object.freeze({
    body: "Salut {{firstName}}, ton post sur {{dm2Fact}} m'a fait penser à {{dm2Detail}}. Vous l'appliquez déjà chez {{company}} ?",
    hook: "DM2_PROSPECT_POST",
    id: "dm2-prospect-post",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM2",
  }),
  Object.freeze({
    body: "Salut {{firstName}}, j'ai vu {{dm2Fact}}. Quel retour vous avez depuis le lancement ?",
    hook: "DM2_RELEASE",
    id: "dm2-release",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM2",
  }),
  Object.freeze({
    body: "Salut {{firstName}}, petit retour sur mon message. Toujours d'actualité chez {{company}} ?",
    hook: "DM2_NEUTRAL",
    id: "dm2-neutral",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM2",
  }),
  Object.freeze({
    body: "Hello {{firstName}}, j'ai regardé {{dm3Fact}}. C'est aussi un sujet côté {{craft}} chez {{company}} ?",
    hook: "DM3_PRODUCT",
    id: "dm3-product",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM3",
  }),
  Object.freeze({
    body: "Hello {{firstName}}, dans ton {{dm3Fact}}, le point sur {{dm3Detail}} m'a intéressé. Vous en êtes où aujourd'hui ?",
    hook: "DM3_SPEAKING",
    id: "dm3-speaking",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM3",
  }),
  Object.freeze({
    body: "Hello {{firstName}}, petit up. Vous avez avancé de votre côté ?",
    hook: "DM3_NEUTRAL",
    id: "dm3-neutral",
    maxCharacters: 300,
    source: PROFILE_TEMPLATES,
    step: "DM3",
  }),
  Object.freeze({
    body: "Hello {{firstName}}, je vais finir par avoir l'air lourd ahah. C'est encore ouvert de votre côté ?",
    hook: "DM4_LIGHT_NUDGE",
    id: "dm4-light-nudge",
    maxCharacters: 250,
    source: PROFILE_TEMPLATES,
    step: "DM4",
  }),
  Object.freeze({
    body: "Salut {{firstName}}, je te laisse tranquille après ce message. Au plaisir d'échanger si un sujet {{craft}} se présente chez {{company}}.",
    hook: "DM5_CLOSE",
    id: "dm5-close",
    maxCharacters: 250,
    source: DM_SKILL,
    step: "DM5",
  }),
]);

export function templateByHook(hook: MessageHook): MessageTemplate {
  const found = MESSAGE_TEMPLATES.find((template) => template.hook === hook);
  if (found === undefined) {
    throw new Error(`missing French default template for hook ${hook}`);
  }
  return found;
}
