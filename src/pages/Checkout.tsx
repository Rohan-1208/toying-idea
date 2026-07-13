import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { api } from "../lib/api";
import { formatINR } from "../lib/format";
import { Button, Input } from "../components/ui";
import { PageHeader } from "../components/Layout";

export default function Checkout() {
  const { lines, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    paymentMethod: "cod",
    notes: "",
  });

  const [paymentStep, setPaymentStep] = useState<"idle" | "input" | "processing" | "verifying" | "success">("idle");
  const [cardDetails, setCardDetails] = useState({ number: "", expiry: "", cvv: "" });
  const [upiId, setUpiId] = useState("");
  const [otp, setOtp] = useState("");

  const shipping = subtotal >= 1500 || subtotal === 0 ? 0 : 99;
  const total = subtotal + shipping;
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (paymentStep === "processing") {
      const timer = setTimeout(() => {
        setPaymentStep("verifying");
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [paymentStep]);

  useEffect(() => {
    if (paymentStep === "success") {
      const timer = setTimeout(() => {
        createActualOrder();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [paymentStep]);

  if (lines.length === 0 && !submitting) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-32 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">Nothing to check out</h1>
        <Button to="/shop" className="mt-6">Browse the collection</Button>
      </div>
    );
  }

  const createActualOrder = async () => {
    setSubmitting(true);
    try {
      const { order } = await api.orders.create({
        customer: { name: form.name, email: form.email, phone: form.phone },
        shippingAddress: {
          line1: form.line1,
          line2: form.line2,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          country: "India",
        },
        items: lines.map((l) => ({
          productId: l.productId,
          slug: l.slug,
          qty: l.qty,
          options: l.options,
        })),
        paymentMethod: form.paymentMethod,
        notes: form.notes,
      });
      clear();
      setPaymentStep("idle");
      navigate("/order-confirmed", { state: { order } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place order. Please try again.");
      setPaymentStep("idle");
      setSubmitting(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email) {
      setError("Please fill in your name and email.");
      return;
    }

    if (form.paymentMethod !== "cod") {
      setPaymentStep("input");
      return;
    }

    await createActualOrder();
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentStep("processing");
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentStep("success");
  };

  return (
    <div className="relative pb-28 md:pb-16">
      <PageHeader eyebrow="Checkout" title="Almost yours" />
      <form id="checkout-form" onSubmit={submit} className="mx-auto mt-6 grid max-w-7xl gap-10 px-5 md:grid-cols-[1.6fr_1fr] md:px-8">
        <div className="space-y-8">
          <section>
            <h3 className="mb-4 font-display text-lg font-bold text-ink">Contact</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" value={form.name} onChange={(e) => set("name", e.target.value)} required autoComplete="name" />
              <Input label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required autoComplete="email" inputMode="email" />
              <Input label="Phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="sm:col-span-2" autoComplete="tel" inputMode="tel" placeholder="10-digit mobile" />
            </div>
          </section>

          <section>
            <h3 className="mb-4 font-display text-lg font-bold text-ink">Shipping address</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Address line 1" value={form.line1} onChange={(e) => set("line1", e.target.value)} className="sm:col-span-2" required autoComplete="address-line1" />
              <Input label="Address line 2" value={form.line2} onChange={(e) => set("line2", e.target.value)} className="sm:col-span-2" autoComplete="address-line2" />
              <Input label="City" value={form.city} onChange={(e) => set("city", e.target.value)} required autoComplete="address-level2" />
              <Input label="State" value={form.state} onChange={(e) => set("state", e.target.value)} required autoComplete="address-level1" />
              <Input label="PIN code" value={form.pincode} onChange={(e) => set("pincode", e.target.value)} required autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} />
            </div>
          </section>

          <section>
            <h3 className="mb-4 font-display text-lg font-bold text-ink">Payment</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { id: "cod", label: "Cash on delivery", hint: "Pay when it arrives" },
                { id: "upi", label: "UPI", hint: "GPay, PhonePe, Paytm" },
                { id: "card", label: "Card", hint: "Debit / credit" },
                { id: "bank", label: "Bank transfer", hint: "NEFT / IMPS" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => set("paymentMethod", m.id)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    form.paymentMethod === m.id
                      ? "border-clay bg-clay/10"
                      : "border-ink/15 bg-white/50 hover:border-ink/25"
                  }`}
                >
                  <p className="font-semibold text-ink">{m.label}</p>
                  <p className="mt-0.5 text-xs text-ink/50">{m.hint}</p>
                </button>
              ))}
            </div>
            {form.paymentMethod !== "cod" && (
              <p className="mt-3 text-xs text-ink/50">Online payments use a secure sandbox for now.</p>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-3xl border border-ink/10 bg-cream-100 p-6 md:sticky md:top-24">
          <h3 className="font-display text-xl font-bold text-ink">Order summary</h3>
          <div className="mt-4 max-h-48 space-y-3 overflow-y-auto md:max-h-none">
            {lines.map((l) => (
              <div key={l.key} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 text-ink/70">
                  {l.name} <span className="text-ink/40">× {l.qty}</span>
                </span>
                <span className="shrink-0 font-medium text-ink">{formatINR(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-ink/10 pt-4 text-sm">
            <div className="flex justify-between text-ink/70">
              <span>Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink/70">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Free" : formatINR(shipping)}</span>
            </div>
            {subtotal > 0 && subtotal < 1500 && (
              <p className="text-xs text-clay-deep">Add {formatINR(1500 - subtotal)} more for free shipping</p>
            )}
            <div className="flex justify-between border-t border-ink/10 pt-2">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-display text-xl font-bold text-ink">{formatINR(total)}</span>
            </div>
          </div>

          {error && <p className="mt-4 rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay-deep">{error}</p>}

          <Button size="lg" className="mt-5 hidden w-full md:inline-flex">
            {submitting ? "Processing…" : form.paymentMethod === "cod" ? "Place order" : "Proceed to Payment"}
          </Button>
          <p className="mt-3 hidden text-center text-xs text-ink/45 md:block">
            You'll receive an order number to track your build.
          </p>
        </aside>
      </form>

      {/* Mobile sticky checkout bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-cream/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink/50">Total</p>
            <p className="font-display text-xl font-bold text-ink">{formatINR(total)}</p>
          </div>
          <Button
            type="submit"
            form="checkout-form"
            size="lg"
            className="min-h-[48px] min-w-[10rem] flex-1"
            disabled={submitting}
          >
            {submitting ? "Processing…" : form.paymentMethod === "cod" ? "Place order" : "Pay now"}
          </Button>
        </div>
      </div>

      {/* Payment Overlay Modal */}
      {paymentStep !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/75 p-0 backdrop-blur-sm animate-fade-in md:items-center md:p-5">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-ink/10 bg-cream-50 shadow-2xl animate-slide-up md:rounded-3xl md:animate-scale-in">
            
            {/* Step: Input Card/UPI details */}
            {paymentStep === "input" && (
              <form onSubmit={handlePaymentSubmit} className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="font-display text-xl font-bold text-ink">Secure Payment</h4>
                  <button 
                    type="button" 
                    onClick={() => setPaymentStep("idle")} 
                    className="text-ink/40 hover:text-ink text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>

                <p className="mb-6 text-sm text-ink/60">
                  Paying <strong className="text-ink">{formatINR(total)}</strong> to <span className="text-clay font-semibold">Toying Idea</span>
                </p>

                {form.paymentMethod === "card" && (
                  <div className="space-y-4">
                    <Input 
                      label="Card Number" 
                      placeholder="4111 2222 3333 4444" 
                      value={cardDetails.number}
                      onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
                      required 
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input 
                        label="Expiry Date" 
                        placeholder="MM/YY" 
                        value={cardDetails.expiry}
                        onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                        required 
                      />
                      <Input 
                        label="CVV" 
                        type="password" 
                        placeholder="•••" 
                        maxLength={3}
                        value={cardDetails.cvv}
                        onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })}
                        required 
                      />
                    </div>
                  </div>
                )}

                {form.paymentMethod === "upi" && (
                  <div className="space-y-6">
                    <Input 
                      label="UPI ID" 
                      placeholder="username@upi" 
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      required 
                    />
                    
                    <div className="flex flex-col items-center justify-center border border-ink/10 rounded-2xl bg-white p-4">
                      <p className="text-xs text-ink/45 mb-2">Or scan QR Code to Pay</p>
                      <div className="h-36 w-36 bg-ink/5 flex items-center justify-center rounded-xl border border-dashed border-ink/20">
                        {/* simulated QR code */}
                        <svg width="100" height="100" viewBox="0 0 100 100" className="opacity-80">
                          <path d="M0,0h40v40H0V0z M10,10v20h20V10H10z M60,0h40v40H60V0z M70,10v20h20V10H70z M0,60h40v40H0V60z M10,70v20h20V70H10z M60,60h10v10H60V60z M70,70h10v10H70V70z M80,80h10v10H80V80z M90,90h10v10H90V90z M60,80h10v10H60V80z M80,60h20v10H80V60z" fill="currentColor"/>
                        </svg>
                      </div>
                      <span className="text-[10px] text-teal-deep bg-teal/10 px-2 py-0.5 rounded-full mt-2 font-medium">Sandbox Mode Active</span>
                    </div>
                  </div>
                )}

                {form.paymentMethod === "bank" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-ink/10 bg-white p-4 text-sm space-y-2">
                      <div className="flex justify-between"><span className="text-ink/50">Bank:</span><span className="font-semibold">HDFC Bank Ltd</span></div>
                      <div className="flex justify-between"><span className="text-ink/50">Account Name:</span><span className="font-semibold">Toying Idea Pvt Ltd</span></div>
                      <div className="flex justify-between"><span className="text-ink/50">Account No:</span><span className="font-semibold">50200048120349</span></div>
                      <div className="flex justify-between"><span className="text-ink/50">IFSC Code:</span><span className="font-semibold">HDFC0000128</span></div>
                    </div>
                    <p className="text-xs text-ink/50 italic">
                      Verify these transfer details and click below to simulate the transaction.
                    </p>
                  </div>
                )}

                <Button size="lg" className="mt-6 w-full">
                  Pay {formatINR(total)}
                </Button>
              </form>
            )}

            {/* Step: Processing */}
            {paymentStep === "processing" && (
              <div className="p-12 text-center space-y-6">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-ink/10 border-t-clay" />
                <div>
                  <h4 className="font-display text-lg font-bold text-ink">Authorizing Transaction</h4>
                  <p className="mt-1 text-sm text-ink/50">Connecting to secure gateway. Please do not close or refresh this page...</p>
                </div>
              </div>
            )}

            {/* Step: Verifying */}
            {paymentStep === "verifying" && (
              <div className="p-8">
                {form.paymentMethod === "card" ? (
                  <form onSubmit={handleOtpSubmit} className="space-y-4">
                    <h4 className="font-display text-xl font-bold text-ink mb-2">Enter OTP</h4>
                    <p className="text-sm text-ink/60">
                      We've sent a simulated 6-digit OTP code to your registered mobile number for authentication.
                    </p>
                    <Input 
                      label="One-Time Password (OTP)" 
                      placeholder="123456" 
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required 
                    />
                    <Button size="lg" className="w-full">
                      Verify & Approve
                    </Button>
                  </form>
                ) : (
                  <div className="p-4 text-center space-y-6">
                    <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-teal/15 flex items-center justify-center text-teal-deep">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="5" y="2" width="14" height="20" rx="2" />
                        <line x1="12" y1="18" x2="12" y2="18" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-display text-lg font-bold text-ink">Awaiting Push Approval</h4>
                      <p className="mt-1 text-sm text-ink/50">
                        {form.paymentMethod === "upi" 
                          ? `Please open your UPI app and approve the request for ${formatINR(total)}.` 
                          : "Simulating bank confirmation check. This will take a moment..."}
                      </p>
                    </div>
                    <Button onClick={() => setPaymentStep("success")} variant="dark" size="sm" className="mt-2">
                      Simulate Approval
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Step: Success */}
            {paymentStep === "success" && (
              <div className="p-12 text-center space-y-6">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal/15 text-teal-deep">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-scale-in">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-display text-xl font-bold text-ink">Payment Successful</h4>
                  <p className="mt-1 text-sm text-ink/50">Your transaction has been approved. Finalizing your order...</p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
