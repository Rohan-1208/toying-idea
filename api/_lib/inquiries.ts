import { INQUIRY_STATUSES, INQUIRY_TYPES } from "./models/Inquiry.js";
import { optionalString, pickEnum, requireString, sanitizeRecord, normalizeEmail } from "./validate.js";

export function buildInquiryPayload(body: Record<string, unknown>) {
  const type = pickEnum(body.type, INQUIRY_TYPES, "inquiry type");
  const name = requireString(body.name, "Name");
  const email = normalizeEmail(body.email);
  const phone = optionalString(body.phone);
  const message = optionalString(body.message).slice(0, 4000);
  const legacy = sanitizeRecord(body.details);

  const payload: Record<string, unknown> = {
    type,
    name,
    email,
    phone,
    message,
    details: legacy,
  };

  if (type === "pyot") {
    const d = legacy;
    payload.pyot = {
      fileLinks: optionalString(d.fileLinks ?? body.fileLinks),
      fileNames: optionalString(d.fileNames ?? body.fileNames),
      material: optionalString(d.material ?? body.material) || "PLA",
      finish: optionalString(d.finish ?? body.finish) || "Matte",
      color: optionalString(d.color ?? body.color),
      quantity: optionalString(d.quantity ?? body.quantity) || "1",
      scale: optionalString(d.scale ?? body.scale),
    };
  }

  if (type === "gifting") {
    const d = legacy;
    payload.gifting = {
      occasion: optionalString(d.occasion ?? body.occasion),
      quantity: optionalString(d.quantity ?? body.quantity),
      budget: optionalString(d.budget ?? body.budget),
      brandingNotes: optionalString(d.brandingNotes ?? body.brandingNotes),
      deliveryDate: optionalString(d.deliveryDate ?? body.deliveryDate),
    };
  }

  if (type === "contact") {
    payload.contact = {
      subject: optionalString(legacy.subject ?? body.subject),
    };
  }

  return payload;
}

export function parseInquiryStatus(value: unknown) {
  return pickEnum(value, INQUIRY_STATUSES, "status");
}
