import { getSupabase, publicStorageUrl } from "./supabase.js";
import { throwIf } from "./map.js";

export async function uploadImageBytes(bytes: Buffer, filename: string, contentType: string): Promise<string> {
  const sb = getSupabase();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "image.png";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const { error } = await sb.storage.from("product-images").upload(path, bytes, {
    contentType: contentType || "image/png",
    upsert: false,
  });
  throwIf(error);
  return publicStorageUrl(path);
}

export async function openaiJson<T>(system: string, user: string): Promise<T> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || `OpenAI error (${res.status})`);
  const content = json.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content) as T;
}

export async function openaiImages(prompt: string, n: number): Promise<string[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return [];
  const urls: string[] = [];
  const count = Math.min(Math.max(n, 0), 3);
  for (let i = 0; i < count; i += 1) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message || `OpenAI image error (${res.status})`);
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) continue;
    const url = await uploadImageBytes(Buffer.from(b64, "base64"), `gen-${i}.png`, "image/png");
    urls.push(url);
  }
  return urls;
}
