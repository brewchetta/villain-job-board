// The (fictional) human the HR chatbot hands off to. Change it here only.
export const HR_CONTACT = {
  name: "Mortimer Gloom",
  title: "Director of Henchperson Relations",
  phone: "(555) 010-0142",
};

export const HR_CONTACT_LINE = `${HR_CONTACT.name}, ${HR_CONTACT.title}, at ${HR_CONTACT.phone}`;

// Shown when the bot can't answer at all (outage, refusal), so the user still gets a way forward.
export const HR_FALLBACK_MESSAGE = `I can't answer that right now. Please call ${HR_CONTACT_LINE}.`;
