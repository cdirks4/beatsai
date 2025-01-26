import { useState } from "react";
import { generateTrack, GenerateTrackResponse } from "@/lib/api/tracks";

export function useTrackGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (instrument: string, prompt: string) => {
    setIsGenerating(true);
    setError(null);

    try {
      const track = await generateTrack(instrument, prompt);
      return track;
    } catch (err) {
      console.error("Generation error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate track");
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generate,
    isGenerating,
    error,
  };
}
