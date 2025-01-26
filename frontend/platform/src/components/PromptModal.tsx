"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTrackGeneration } from "@/hooks/useTrackGeneration";
import { Loader2 } from "lucide-react";

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  instrument: any;
  onTrackGenerated?: (track: any) => void;
}

export default function PromptModal({
  isOpen,
  onClose,
  instrument,
  onTrackGenerated,
}: PromptModalProps) {
  const [prompt, setPrompt] = useState("");
  const { generate, isGenerating, error } = useTrackGeneration();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instrument || !prompt.trim()) return;

    const track = await generate(instrument.name, prompt);
    if (track && onTrackGenerated) {
      onTrackGenerated(track);
      onClose();
      setPrompt("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate {instrument?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <textarea
            className="w-full p-2 rounded-md border mb-4 dark:bg-gray-700 dark:border-gray-600"
            placeholder={instrument?.placeholder}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
          />
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isGenerating || !prompt.trim()}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
