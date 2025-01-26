"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import PromptModal from "./PromptModal";
import { GenerateTrackResponse } from "@/lib/api/tracks";
import { useStack } from "@/contexts/StackContext";

const instruments = [
  {
    id: "drums",
    name: "Drums",
    icon: "🥁",
    description: "Create rhythmic patterns and beats",
    placeholder:
      "e.g., 'A punchy hip-hop beat with heavy kicks and crisp hi-hats'",
  },
  {
    id: "bass",
    name: "Bass",
    icon: "🎸",
    description: "Add deep, groovy basslines",
    placeholder: "e.g., 'A funky slap bass line with walking patterns'",
  },
  {
    id: "keys",
    name: "Keys",
    icon: "🎹",
    description: "Layer melodic harmonies",
    placeholder: "e.g., 'Atmospheric pad sounds with gentle arpeggios'",
  },
  {
    id: "vocals",
    name: "Vocals",
    icon: "🎤",
    description: "Add vocal elements and melodies",
    placeholder: "e.g., 'Ethereal vocal harmonies with reverb'",
  },
];

export default function InstrumentSidebar() {
  const { addTrack } = useStack();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<
    (typeof instruments)[0] | null
  >(null);

  const handleInstrumentClick = (instrument: (typeof instruments)[0]) => {
    setSelectedInstrument(instrument);
    setIsModalOpen(true);
  };

  const handleTrackGenerated = (track: GenerateTrackResponse) => {
    addTrack(track);
    setIsModalOpen(false);
    setSelectedInstrument(null);
  };

  return (
    <>
      <div className="w-80 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm p-6 border-r border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold mb-6">Instruments</h2>
        <div className="grid grid-cols-2 gap-4">
          {instruments.map((instrument) => (
            <Button
              key={instrument.id}
              variant="outline"
              className="flex flex-col items-center justify-center h-32 p-4 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group relative border border-gray-200 dark:border-gray-700"
              onClick={() => handleInstrumentClick(instrument)}
            >
              <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                {instrument.icon}
              </span>
              <span className="font-medium text-sm">{instrument.name}</span>
            </Button>
          ))}
        </div>
      </div>

      <PromptModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedInstrument(null);
        }}
        instrument={selectedInstrument}
        onTrackGenerated={handleTrackGenerated}
      />
    </>
  );
}
