import "server-only";
import OpenAI from "openai";

const baseURL = process.env.MUBIT_BASE_URL?.trim();
const apiKey = process.env.MUBIT_API_KEY?.trim();

if (!baseURL || !apiKey) {
  throw new Error("MUBIT_BASE_URL and MUBIT_API_KEY must be set");
}

export const mubit = new OpenAI({
  baseURL,
  apiKey,
  defaultHeaders: {
    Authorization: `Bearer ${apiKey}`,
  },
});
