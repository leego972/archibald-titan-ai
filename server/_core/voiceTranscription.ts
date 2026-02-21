/**
 * Voice transcription helper — supports OpenAI Whisper API and Manus Forge proxy
 */
import { ENV } from "./env";

export type TranscribeOptions = {
  audioUrl: string;
  language?: string;
  prompt?: string;
};

export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
};

export type TranscriptionResponse = WhisperResponse;

export type TranscriptionError = {
  error: string;
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "UPLOAD_FAILED" | "SERVICE_ERROR";
  details?: string;
};

function getTranscriptionUrl(): string {
  if (process.env.OPENAI_API_KEY) {
    return "https://api.openai.com/v1/audio/transcriptions";
  }
  if (ENV.forgeApiUrl) {
    const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
    return new URL("v1/audio/transcriptions", baseUrl).toString();
  }
  return "https://api.openai.com/v1/audio/transcriptions";
}

function getTranscriptionKey(): string {
  return process.env.OPENAI_API_KEY || ENV.forgeApiKey || "";
}

export async function transcribeAudio(
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    const apiKey = getTranscriptionKey();
    if (!apiKey) {
      return { error: "Voice transcription not configured", code: "SERVICE_ERROR", details: "Set OPENAI_API_KEY" };
    }

    // Download audio from URL
    let audioBuffer: Buffer;
    let mimeType: string;
    try {
      const response = await fetch(options.audioUrl);
      if (!response.ok) {
        return { error: "Failed to download audio file", code: "INVALID_FORMAT", details: `HTTP ${response.status}` };
      }
      audioBuffer = Buffer.from(await response.arrayBuffer());
      mimeType = response.headers.get('content-type') || 'audio/mpeg';
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        return { error: "Audio file exceeds 16MB limit", code: "FILE_TOO_LARGE", details: `${sizeMB.toFixed(2)}MB` };
      }
    } catch (error) {
      return { error: "Failed to fetch audio", code: "SERVICE_ERROR", details: error instanceof Error ? error.message : "Unknown" };
    }

    // Create FormData
    const formData = new FormData();
    const ext = getFileExtension(mimeType);
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", audioBlob, `audio.${ext}`);
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");

    const prompt = options.prompt || (
      options.language ? `Transcribe in ${getLanguageName(options.language)}` : "Transcribe the audio"
    );
    formData.append("prompt", prompt);

    const response = await fetch(getTranscriptionUrl(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "Accept-Encoding": "identity",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return { error: "Transcription failed", code: "TRANSCRIPTION_FAILED", details: `${response.status}: ${errorText}` };
    }

    const whisperResponse = await response.json() as WhisperResponse;
    if (!whisperResponse.text || typeof whisperResponse.text !== 'string') {
      return { error: "Invalid response", code: "SERVICE_ERROR", details: "Invalid format" };
    }
    return whisperResponse;
  } catch (error) {
    return { error: "Transcription failed", code: "SERVICE_ERROR", details: error instanceof Error ? error.message : "Unknown" };
  }
}

function getFileExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/webm': 'webm', 'audio/mp3': 'mp3', 'audio/mpeg': 'mp3',
    'audio/wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg',
    'audio/m4a': 'm4a', 'audio/mp4': 'm4a',
  };
  return map[mimeType] || 'audio';
}

function getLanguageName(langCode: string): string {
  const map: Record<string, string> = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
    'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
    'ko': 'Korean', 'zh': 'Chinese', 'ar': 'Arabic', 'hi': 'Hindi',
  };
  return map[langCode] || langCode;
}
