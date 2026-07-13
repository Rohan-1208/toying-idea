export interface PincodeResult {
  pincode: string;
  city: string;
  state: string;
  district: string;
  postOffices: string[];
}

type PostalResponse = {
  Status: string;
  Message: string;
  PostOffice?: Array<{
    Name: string;
    District: string;
    State: string;
    Pincode: string;
  }>;
};

export async function lookupPincode(pincode: string): Promise<PincodeResult | null> {
  const pin = pincode.replace(/\D/g, "").slice(0, 6);
  if (pin.length !== 6) return null;

  const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error("Could not look up PIN code");

  const data = (await res.json()) as PostalResponse[];
  const block = data[0];
  if (!block || block.Status !== "Success" || !block.PostOffice?.length) {
    return null;
  }

  const first = block.PostOffice[0];
  return {
    pincode: pin,
    city: first.District,
    state: first.State,
    district: first.District,
    postOffices: block.PostOffice.map((p) => p.Name).slice(0, 8),
  };
}
