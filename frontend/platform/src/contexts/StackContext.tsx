"use client";

import { createContext, useContext, useState } from "react";
import { GenerateTrackResponse } from "@/lib/api/tracks";

interface StackContextType {
  tracks: GenerateTrackResponse[];
  addTrack: (track: GenerateTrackResponse) => void;
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

  const addTrack = (track: GenerateTrackResponse) => {
    console.log("Adding track:", track); // Debug log
    setTracks((prev) => [...prev, track]);
  };

  return (
    <StackContext.Provider value={{ tracks, addTrack }}>
      {children}
    </StackContext.Provider>
  );
}
