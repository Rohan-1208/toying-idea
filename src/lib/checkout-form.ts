import { INDIAN_STATES, normalizeIndianState } from "../data/indian-states";

export interface CheckoutFormData {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: string;
  notes: string;
}

export function validateCheckoutForm(form: CheckoutFormData): string | null {
  if (!form.name.trim()) return "Please enter your full name.";
  if (!form.email.trim()) return "Please enter your email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Please enter a valid email.";
  if (!form.phone.trim()) return "Please enter your mobile number.";
  if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ""))) {
    return "Enter a valid 10-digit Indian mobile number.";
  }
  if (!form.line1.trim()) return "Please enter your street address.";
  if (!/^\d{6}$/.test(form.pincode.trim())) return "Enter a valid 6-digit PIN code.";
  if (!form.city.trim()) return "Please enter your city.";
  if (!form.state.trim()) return "Please select your state.";
  return null;
}

export { INDIAN_STATES, normalizeIndianState };
