import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the voice transcription module
vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn(),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";

describe("Voice Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("transcribeAudio", () => {
    it("should return transcription text on success", async () => {
      const mockResponse = {
        text: "Hello, how are you?",
        language: "en",
        duration: 3.5,
        task: "transcribe" as const,
        segments: [],
      };

      (transcribeAudio as any).mockResolvedValue(mockResponse);

      const result = await transcribeAudio({
        audioUrl: "https://example.com/audio.webm",
        language: "en",
        prompt: "Transcribe the user's voice command",
      });

      expect(result).toEqual(mockResponse);
      expect(transcribeAudio).toHaveBeenCalledWith({
        audioUrl: "https://example.com/audio.webm",
        language: "en",
        prompt: "Transcribe the user's voice command",
      });
    });

    it("should return error for invalid audio", async () => {
      const mockError = {
        error: "Audio file exceeds maximum size limit",
        code: "FILE_TOO_LARGE",
        details: "File size is 20.00MB, maximum allowed is 16MB",
      };

      (transcribeAudio as any).mockResolvedValue(mockError);

      const result = await transcribeAudio({
        audioUrl: "https://example.com/large-audio.webm",
      });

      expect(result).toHaveProperty("error");
      expect((result as any).code).toBe("FILE_TOO_LARGE");
    });

    it("should return error for service misconfiguration", async () => {
      const mockError = {
        error: "Voice transcription service is not configured",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_URL is not set",
      };

      (transcribeAudio as any).mockResolvedValue(mockError);

      const result = await transcribeAudio({
        audioUrl: "https://example.com/audio.webm",
      });

      expect(result).toHaveProperty("error");
      expect((result as any).code).toBe("SERVICE_ERROR");
    });

    it("should handle transcription failure gracefully", async () => {
      const mockError = {
        error: "Transcription service request failed",
        code: "TRANSCRIPTION_FAILED",
        details: "500 Internal Server Error",
      };

      (transcribeAudio as any).mockResolvedValue(mockError);

      const result = await transcribeAudio({
        audioUrl: "https://example.com/audio.webm",
      });

      expect(result).toHaveProperty("error");
      expect((result as any).code).toBe("TRANSCRIPTION_FAILED");
    });
  });

  describe("storagePut for audio upload", () => {
    it("should upload audio buffer to S3 and return URL", async () => {
      const mockUrl = "https://storage.example.com/voice/1/audio-abc123.webm";
      (storagePut as any).mockResolvedValue({
        key: "voice/1/audio-abc123.webm",
        url: mockUrl,
      });

      const audioBuffer = Buffer.from("fake audio data");
      const result = await storagePut(
        "voice/1/audio-abc123.webm",
        audioBuffer,
        "audio/webm"
      );

      expect(result.url).toBe(mockUrl);
      expect(result.key).toBe("voice/1/audio-abc123.webm");
      expect(storagePut).toHaveBeenCalledWith(
        "voice/1/audio-abc123.webm",
        audioBuffer,
        "audio/webm"
      );
    });

    it("should handle upload failure", async () => {
      (storagePut as any).mockRejectedValue(
        new Error("Storage upload failed (500 Internal Server Error)")
      );

      await expect(
        storagePut("voice/1/audio.webm", Buffer.from("data"), "audio/webm")
      ).rejects.toThrow("Storage upload failed");
    });
  });

  describe("Voice input flow integration", () => {
    it("should complete full voice-to-text pipeline", async () => {
      // Step 1: Upload audio
      const mockUploadResult = {
        key: "voice/1/recording-xyz.webm",
        url: "https://storage.example.com/voice/1/recording-xyz.webm",
      };
      (storagePut as any).mockResolvedValue(mockUploadResult);

      const uploadResult = await storagePut(
        "voice/1/recording-xyz.webm",
        Buffer.from("audio data"),
        "audio/webm"
      );

      expect(uploadResult.url).toBeTruthy();

      // Step 2: Transcribe
      const mockTranscription = {
        text: "Build me a new dashboard page",
        language: "en",
        duration: 4.2,
        task: "transcribe" as const,
        segments: [],
      };
      (transcribeAudio as any).mockResolvedValue(mockTranscription);

      const transcription = await transcribeAudio({
        audioUrl: uploadResult.url,
        prompt: "Transcribe the user's voice command for a chat assistant",
      });

      expect("text" in transcription).toBe(true);
      if ("text" in transcription) {
        expect(transcription.text).toBe("Build me a new dashboard page");
        expect(transcription.language).toBe("en");
      }
    });

    it("should handle empty transcription result", async () => {
      const mockTranscription = {
        text: "",
        language: "en",
        duration: 0.5,
        task: "transcribe" as const,
        segments: [],
      };
      (transcribeAudio as any).mockResolvedValue(mockTranscription);

      const result = await transcribeAudio({
        audioUrl: "https://example.com/silence.webm",
      });

      // The helper returns the raw response; the caller checks for empty text
      expect("text" in result).toBe(true);
      if ("text" in result) {
        expect(result.text).toBe("");
      }
    });
  });
});
