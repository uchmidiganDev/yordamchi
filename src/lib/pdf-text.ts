import { extractText, getDocumentProxy } from "unpdf";

// PDF baytlaridan matn ajratib beradi. Serverless muhitda ishlaydigan `unpdf`
// (pdf.js'ning serverless build'i) ishlatiladi. Sahifalar bitta matnga
// birlashtiriladi.
export async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
