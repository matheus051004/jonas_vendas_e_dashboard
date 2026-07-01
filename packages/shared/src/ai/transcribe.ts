import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { getSettings } from "../settings";

export async function transcribeAudioBase64(audioBase64: string, mimeType = "audio/ogg"): Promise<string> {
  const settings = await getSettings();
  const openai = new OpenAI({ apiKey: settings.openAiApiKey || process.env.OPENAI_API_KEY });

  const buffer = Buffer.from(audioBase64, "base64");
  const extension = mimeType.split("/")[1] ?? "ogg";
  const file = await toFile(buffer, `audio.${extension}`, { type: mimeType });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });

  return transcription.text;
}
