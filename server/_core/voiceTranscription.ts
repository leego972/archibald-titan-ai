/**
   * Voice transcription helper — Venice (primary) / OpenAI Whisper (fallback)
   */

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

  /** Returns the best available transcription endpoint and key (Venice preferred, OpenAI fallback) */
  function getTranscriptionProvider(): { url: string; key: string } {
    const veniceKey = process.env.VENICE_API_KEY || "";
    if (veniceKey) {
      return { url: "https://api.venice.ai/api/v1/audio/transcriptions", key: veniceKey };
    }
    return { url: "https://api.openai.com/v1/audio/transcriptions", key: process.env.OPENAI_API_KEY || "" };
  }

  export async function transcribeAudio(
    options: TranscribeOptions
  ): Promise<TranscriptionResponse | TranscriptionError> {
    try {
      const { url, key } = getTranscriptionProvider();
      if (!key) {
        return { error: "Voice transcription not configured", code: "SERVICE_ERROR", details: "Set VENICE_API_KEY or OPENAI_API_KEY" };
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

      if (options.language && options.language !== 'auto') {
        formData.append("language", options.language);
      }

      const prompt = options.prompt || (
        options.language ? `Transcribe in ${getLanguageName(options.language)}` : "Transcribe the audio accurately"
      );
      formData.append("prompt", prompt);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "Accept-Encoding": "identity",
        },
        body: formData,
      });

      if (!response.ok) {
        // On 401/403 from Venice, retry automatically with OpenAI if available
        if ((response.status === 401 || response.status === 403) && url.includes("venice")) {
          const fallbackKey = process.env.OPENAI_API_KEY || "";
          if (fallbackKey) {
            const fallback = await fetch("https://api.openai.com/v1/audio/transcriptions", {
              method: "POST",
              headers: { authorization: `Bearer ${fallbackKey}`, "Accept-Encoding": "identity" },
              body: formData,
            });
            if (fallback.ok) {
              const fb = await fallback.json() as WhisperResponse;
              if (fb.text && typeof fb.text === "string") return fb;
            }
          }
        }
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
      'he': 'Hebrew',
    };
    return map[langCode] || langCode;
  }
  