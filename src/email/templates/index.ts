import {
  ownerDetailsUpdateHtml,
  ownerDetailsUpdateText,
  ownerNewLeadHtml,
  ownerNewLeadText,
  ownerRelayHtml,
  ownerRelayText,
  visitorFollowupHtml,
  visitorFollowupText,
} from "@/email/templates/generated";

export const visitorFollowupTemplates = {
  html: visitorFollowupHtml,
  text: visitorFollowupText,
};

export const ownerNewLeadTemplates = {
  html: ownerNewLeadHtml,
  text: ownerNewLeadText,
};

export const ownerDetailsUpdateTemplates = {
  html: ownerDetailsUpdateHtml,
  text: ownerDetailsUpdateText,
};

export const ownerRelayTemplates = {
  html: ownerRelayHtml,
  text: ownerRelayText,
};
