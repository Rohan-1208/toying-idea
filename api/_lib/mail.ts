import { promises as fs } from "node:fs";
import path from "node:path";
import type { OrderDoc } from "./models/Order.js";

// Load Resend configuration if set
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "Toying Idea <onboarding@resend.dev>";
const APP_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

// Helper to format currency
function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Generate the common email HTML wrapper
function getEmailLayout(title: string, bodyContent: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #FBF6EC;
            color: #2B2018;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .wrapper {
            width: 100%;
            table-layout: fixed;
            background-color: #FBF6EC;
            padding: 40px 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #E8E2D5;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 4px 10px rgba(43, 32, 24, 0.03);
          }
          .header {
            background-color: #2B2018;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            color: #FBF6EC;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .content {
            padding: 40px 30px;
          }
          .footer {
            background-color: #FBF6EC;
            border-top: 1px solid #E8E2D5;
            padding: 24px;
            text-align: center;
            font-size: 12px;
            color: #2B2018;
            opacity: 0.6;
          }
          .btn {
            display: inline-block;
            background-color: #E8731E;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 99px;
            font-weight: 600;
            font-size: 14px;
            margin: 20px 0;
            text-align: center;
          }
          table.order-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          table.order-table th {
            text-align: left;
            border-bottom: 1px solid #E8E2D5;
            padding: 10px 0;
            font-size: 13px;
            color: #2B2018;
            opacity: 0.6;
          }
          table.order-table td {
            padding: 12px 0;
            border-bottom: 1px solid #F3EFE6;
            font-size: 14px;
          }
          .totals-row td {
            border: none !important;
            padding: 6px 0;
          }
          .totals-row.grand-total td {
            border-top: 1px solid #E8E2D5 !important;
            padding-top: 12px;
            font-size: 16px;
            font-weight: 700;
          }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            background-color: #F2B705;
            color: #2B2018;
            border-radius: 99px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <h1>TOYING IDEA</h1>
            </div>
            <div class="content">
              ${bodyContent}
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} Toying Idea. Printed with precision, built for collectors.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

// Send email helper
async function sendEmail(to: string, subject: string, html: string, orderNumber: string, templateType: string) {
  // If API key is set, send via Resend REST API
  if (RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [to],
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend API Error: ${response.status} - ${errorText}`);
      }
      console.log(`✓ Email sent successfully via Resend API to ${to} (${subject})`);
      return;
    } catch (err) {
      console.error(`✗ Failed to send email via Resend:`, err);
    }
  }

  // Local development fallback: Log email details and write html output file
  const localDir = path.join("/tmp", "ti-emails");
  const fileName = `${orderNumber}-${templateType}-${Date.now()}.html`;
  const filePath = path.join(localDir, fileName);

  try {
    await fs.mkdir(localDir, { recursive: true });
    await fs.writeFile(filePath, html, "utf8");
    console.log(`\n=================== [MOCK EMAIL SENT] ===================`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Saved To: file://${filePath}`);
    console.log(`==========================================================\n`);
  } catch (err) {
    console.error("✗ Failed to write mock email to disk:", err);
  }
}

// Send Order Confirmation Email
export async function sendOrderConfirmationEmail(order: OrderDoc) {
  const customer = order.customer;
  if (!customer) {
    throw new Error("Order customer details are missing");
  }
  const subject = `Order Confirmed - #${order.orderNumber}`;
  const trackUrl = `${APP_URL}/track?order=${order.orderNumber}&email=${encodeURIComponent(customer.email)}`;

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td>
          <strong style="color: #2B2018;">${item.name}</strong>
          ${item.options?.finish || item.options?.color ? `<br><span style="font-size: 11px; opacity: 0.6;">${item.options.finish || ""} ${item.options.color || ""}</span>` : ""}
        </td>
        <td style="text-align: center;">${item.qty}</td>
        <td style="text-align: right;">${formatINR(item.price * item.qty)}</td>
      </tr>
    `
    )
    .join("");

  const bodyContent = `
    <h2 style="margin-top: 0; font-size: 20px; font-weight: 700;">Thank you for your order, ${customer.name}!</h2>
    <p style="font-size: 15px; line-height: 1.5; color: #2B2018; opacity: 0.8;">
      We've successfully received your order and our 3D printers are getting ready. We'll send you updates as your build progresses!
    </p>

    <div style="background-color: #FBF6EC; border-radius: 16px; padding: 20px; margin: 25px 0;">
      <h3 style="margin-top: 0; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Order Summary</h3>
      <table style="width: 100%; font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #2B2018; opacity: 0.6;">Order Number:</td>
          <td style="padding: 4px 0; font-weight: 700; text-align: right;">#${order.orderNumber}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #2B2018; opacity: 0.6;">Payment Method:</td>
          <td style="padding: 4px 0; font-weight: 600; text-align: right; text-transform: uppercase;">${order.paymentMethod}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #2B2018; opacity: 0.6;">Payment Status:</td>
          <td style="padding: 4px 0; font-weight: 600; text-align: right; color: ${order.paymentStatus === "paid" ? "#2A8C97" : "#E8731E"};">${order.paymentStatus.toUpperCase()}</td>
        </tr>
      </table>
    </div>

    <h3 style="font-size: 15px; margin-bottom: 10px;">Items Ordered</h3>
    <table class="order-table">
      <thead>
        <tr>
          <th style="width: 60%;">Item</th>
          <th style="width: 15%; text-align: center;">Qty</th>
          <th style="width: 25%; text-align: right;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
        <tr class="totals-row">
          <td colspan="2" style="color: #2B2018; opacity: 0.6; padding-top: 15px;">Subtotal</td>
          <td style="text-align: right; padding-top: 15px;">${formatINR(order.subtotal)}</td>
        </tr>
        <tr class="totals-row">
          <td colspan="2" style="color: #2B2018; opacity: 0.6;">Shipping</td>
          <td style="text-align: right;">${order.shipping === 0 ? "Free" : formatINR(order.shipping)}</td>
        </tr>
        <tr class="totals-row grand-total">
          <td colspan="2">Total</td>
          <td style="text-align: right; color: #E8731E;">${formatINR(order.total)}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin: 25px 0;">
      <h3 style="font-size: 15px; margin-bottom: 6px;">Shipping Address</h3>
      <p style="font-size: 14px; margin: 0; opacity: 0.8; line-height: 1.4;">
        ${customer.name}<br>
        ${order.shippingAddress?.line1 || ""}<br>
        ${order.shippingAddress?.line2 ? `${order.shippingAddress.line2}<br>` : ""}
        ${order.shippingAddress?.city || ""}, ${order.shippingAddress?.state || ""} ${order.shippingAddress?.pincode || ""}<br>
        ${order.shippingAddress?.country || "India"}
      </p>
    </div>

    <center>
      <a href="${trackUrl}" class="btn">Track Your Build Progress</a>
    </center>
  `;

  const html = getEmailLayout(subject, bodyContent);
  await sendEmail(customer.email, subject, html, order.orderNumber, "confirmation");
}

// Send Order Status Update Email
export async function sendOrderStatusUpdateEmail(order: OrderDoc, note?: string) {
  const customer = order.customer;
  if (!customer) {
    throw new Error("Order customer details are missing");
  }
  const subject = `Order Status Update - #${order.orderNumber}`;
  const trackUrl = `${APP_URL}/track?order=${order.orderNumber}&email=${encodeURIComponent(customer.email)}`;

  const statusDescriptions: Record<string, string> = {
    pending: "Your order is pending review.",
    confirmed: "Your build order has been approved and scheduled.",
    printing: "Our 3D printers have started building your model!",
    shipped: "Your build is complete and has been handed to our courier partner.",
    delivered: "Your package has been successfully delivered!",
    cancelled: "Your order was cancelled.",
  };

  const statusNoteHtml = note 
    ? `<div style="border-left: 4px solid #E8731E; padding-left: 15px; margin: 20px 0; italic; opacity: 0.8; font-size: 14px;">"${note}"</div>`
    : "";

  const trackingInfoHtml = order.status === "shipped" && order.tracking?.number
    ? `
      <div style="background-color: #FBF6EC; border: 1px solid #E8E2D5; border-radius: 16px; padding: 20px; margin: 20px 0; font-size: 13px;">
        <h4 style="margin-top: 0; font-size: 13px; font-weight: 700; color: #2A8C97; text-transform: uppercase;">Shipment Details</h4>
        <p style="margin: 4px 0 0 0; opacity: 0.8;">
          Carrier: <strong>${order.tracking.carrier || "Standard Delivery"}</strong><br>
          Tracking Number: <strong>${order.tracking.number}</strong>
        </p>
        ${order.tracking.url ? `<p style="margin: 8px 0 0 0;"><a href="${order.tracking.url}" style="color: #E8731E; font-weight: 600;" target="_blank">Track Shipment Carrier Page &rarr;</a></p>` : ""}
      </div>
    `
    : "";

  const bodyContent = `
    <h2 style="margin-top: 0; font-size: 20px; font-weight: 700;">Order Progress Update</h2>
    <p style="font-size: 15px; line-height: 1.5;">
      Hi ${customer.name}, the status of your order <strong style="color: #2B2018;">#${order.orderNumber}</strong> has been updated to:
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <span class="badge" style="font-size: 16px; padding: 6px 16px; background-color: ${order.status === "cancelled" ? "#FFECEC" : "#E2F5F6"}; color: ${order.status === "cancelled" ? "#C53030" : "#2A8C97"};">
        ${order.status.toUpperCase()}
      </span>
      <p style="font-size: 14px; opacity: 0.6; margin-top: 10px;">
        ${statusDescriptions[order.status] || "Status updated."}
      </p>
    </div>

    ${statusNoteHtml}
    ${trackingInfoHtml}

    <p style="font-size: 14px; opacity: 0.7; line-height: 1.5; margin-top: 25px;">
      You can track the live progress, view printing photos (when available), and check estimated delivery dates on our customer tracking portal.
    </p>

    <center>
      <a href="${trackUrl}" class="btn">View Live Order Tracking</a>
    </center>
  `;

  const html = getEmailLayout(subject, bodyContent);
  await sendEmail(customer.email, subject, html, order.orderNumber, `status-${order.status}`);
}
