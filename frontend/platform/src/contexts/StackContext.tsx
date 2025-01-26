"use client";

import { createContext, useContext, useState } from "react";
import { GenerateTrackResponse } from "@/lib/api/tracks";
import { addTrackToStack, removeTrackFromStack } from "@/lib/db/stacks";

interface StackContextType {
  tracks: GenerateTrackResponse[];
  addTrack: (track: GenerateTrackResponse) => Promise<void>;
  removeTrack: (trackId: string) => Promise<void>;
  currentStackId: string | null;
  setCurrentStackId: (id: string | null) => void;
}

export const StackContext = createContext<StackContextType | undefined>(
  undefined
);

export function useStack() {
  const context = useContext(StackContext);
  if (!context) {
    throw new Error("useStack must be used within a StackProvider");
  }
  return context;
}

export function StackProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<GenerateTrackResponse[]>([]);
  const [currentStackId, setCurrentStackId] = useState<string | null>(null);

  const addTrack = async (track: GenerateTrackResponse) => {
    if (currentStackId) {
      await addTrackToStack(currentStackId, track);
    }
    setTracks((prev) => [...prev, track]);
  };

  const removeTrack = async (trackId: string) => {
    if (currentStackId) {
      await removeTrackFromStack(trackId);
    }
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  return (
    <StackContext.Provider
      value={{
        tracks,
        addTrack,
        removeTrack,
        currentStackId,
        setCurrentStackId,
      }}
    >
      {children}
    </StackContext.Provider>
  );
}
