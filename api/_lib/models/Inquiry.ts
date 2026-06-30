import mongoose, { Schema, type InferSchemaType } from "mongoose";

const PyotDetailsSchema = new Schema(
  {
    fileLinks: { type: String, default: "" },
    fileNames: { type: String, default: "" },
    material: { type: String, default: "PLA" },
    finish: { type: String, default: "Matte" },
    color: { type: String, default: "" },
    quantity: { type: String, default: "1" },
    scale: { type: String, default: "" },
  },
  { _id: false }
);

const GiftingDetailsSchema = new Schema(
  {
    occasion: { type: String, default: "" },
    quantity: { type: String, default: "" },
    budget: { type: String, default: "" },
    brandingNotes: { type: String, default: "" },
    deliveryDate: { type: String, default: "" },
  },
  { _id: false }
);

const ContactDetailsSchema = new Schema(
  {
    subject: { type: String, default: "" },
  },
  { _id: false }
);

const QuoteSchema = new Schema(
  {
    amount: { type: Number, min: 0 },
    currency: { type: String, default: "INR" },
    note: { type: String, default: "" },
    validUntil: { type: Date, default: null },
  },
  { _id: false }
);

export const INQUIRY_TYPES = ["pyot", "gifting", "contact"] as const;
export const INQUIRY_STATUSES = [
  "new",
  "in-review",
  "quoted",
  "approved",
  "printing",
  "completed",
  "closed",
] as const;

/** PYOT, gifting, and contact requests (greenfield database). */
const InquirySchema = new Schema(
  {
    type: { type: String, enum: INQUIRY_TYPES, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    message: { type: String, default: "" },

    pyot: { type: PyotDetailsSchema, default: undefined },
    gifting: { type: GiftingDetailsSchema, default: undefined },
    contact: { type: ContactDetailsSchema, default: undefined },

    /** @deprecated use typed fields above — kept for backward reads */
    details: { type: Schema.Types.Mixed, default: {} },

    quote: { type: QuoteSchema, default: undefined },
    status: { type: String, enum: INQUIRY_STATUSES, default: "new" },
  },
  { timestamps: true, collection: "inquiries" }
);

InquirySchema.index({ type: 1, status: 1, createdAt: -1 });
InquirySchema.index({ email: 1, createdAt: -1 });

export type InquiryDoc = InferSchemaType<typeof InquirySchema>;

export const Inquiry =
  (mongoose.models.Inquiry as mongoose.Model<InquiryDoc>) ||
  mongoose.model<InquiryDoc>("Inquiry", InquirySchema);
