import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function parseSrt(srt: string) {
  // Basic SRT parser: returns array of {index, time, text}
  const blocks = srt.split(/\n\s*\n/);
  return blocks.map((block) => {
    const lines = block.trim().split("\n");
    if (lines.length < 3) return null;
    const [index, time, ...textLines] = lines;
    return {
      index: parseInt(index, 10),
      time,
      text: textLines.join(" ").replace(/\r/g, ""),
    };
  }).filter((b): b is { index: number; time: string; text: string } => b !== null);
}

function buildSrt(blocks: { index: number; time: string; text: string }[]) {
  return blocks
    .map((b) => `${b.index}\n${b.time}\n${b.text}\n`)
    .join("\n");
}

export default function SrtTranslatorPage() {
  const [srtText, setSrtText] = useState("");
  const [translated, setTranslated] = useState("");
  const [loading, setLoading] = useState(false);

  // Placeholder for AI translation integration
  async function translateBlocks(blocks: { index: number; time: string; text: string }[]) {
    // TODO: Replace with translategemma:4b API call
    // For now, just return the same text
    return await Promise.all(
      blocks.map(async (b) => ({ ...b, text: `[HE] ${b.text}` }))
    );
  }

  async function handleTranslate() {
    setLoading(true);
    try {
      const blocks = parseSrt(srtText);
      if (!blocks.length) {
        toast.error("Invalid SRT format");
        setLoading(false);
        return;
      }
      const translatedBlocks = await translateBlocks(blocks);
      setTranslated(buildSrt(translatedBlocks));
      toast.success("Translation complete");
    } catch (e) {
      toast.error("Translation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>SRT Translator (to Hebrew)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="block mb-1 font-medium">Paste .srt file contents (Arabic/English)</label>
            <Textarea
              rows={10}
              value={srtText}
              onChange={(e) => setSrtText(e.target.value)}
              placeholder="Paste your .srt file here..."
              className="mb-2"
            />
            <Button onClick={handleTranslate} disabled={loading || !srtText}>
              {loading ? "Translating..." : "Translate to Hebrew"}
            </Button>
          </div>
          <div className="mt-6">
            <label className="block mb-1 font-medium">Translated .srt (Hebrew)</label>
            <Textarea
              rows={10}
              value={translated}
              readOnly
              placeholder="Translation will appear here..."
              className="mb-2"
            />
            {translated && (
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(translated);
                  toast.success("Copied to clipboard");
                }}
              >
                Copy Translated SRT
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="text-xs text-muted-foreground mt-4">
        Built for easy integration with translategemma:4b. Replace <code>translateBlocks</code> with your API call.
      </div>
    </div>
  );
}
