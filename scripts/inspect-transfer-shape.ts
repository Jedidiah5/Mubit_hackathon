import { collection, getDocs } from "firebase/firestore";
import { getDb } from "../lib/firebase";

async function main() {
  const docs = await getDocs(collection(getDb(), "enquiries"));
  const row = docs.docs[0]?.data() ?? {};
  console.log(JSON.stringify({
    count: docs.size,
    fields: Object.entries(row).map(([key, value]) => ({
      key,
      type: Array.isArray(value) ? "array" : value === null ? "null" : typeof value,
      length: typeof value === "string" ? value.length : undefined,
    })),
  }));
}
main().catch((error) => { console.error(error); process.exit(1); });
