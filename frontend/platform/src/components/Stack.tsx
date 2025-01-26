"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/nextjs";
import { Play, Pause, RotateCw, Trash2 } from "lucide-react";
import { VolumeControl } from "@/components/ui/volume-control";
import { ProgressBar } from "@/components/ui/progress-bar";
import InstrumentSidebar from "@/components/InstrumentSidebar";
import { useStack } from "@/contexts/StackContext";

interface Track {
  id: string;
  instrument: string;
  prompt: string;
  audioUrl: string;
  title?: string;
  tags?: string[];
}

const demoTracks: Track[] = [
  {
    id: "drums-1",
    instrument: "Drums",
    prompt: "A punchy hip-hop beat with heavy kicks",
    audioUrl: "/demos/bass.mp3",
    title: "Hip Hop Drums",
    tags: ["drums", "hip-hop"],
  },
  {
    id: "bass-1",
    instrument: "Bass",
    prompt: "Funky slap bass line",
    audioUrl: "/demos/bass.mp3",
    title: "Funky Bass",
    tags: ["bass", "funk"],
  },
  {
    id: "keys-1",
    instrument: "Keys",
    prompt: "Atmospheric pad sounds",
    audioUrl: "/demos/bass.mp3",
    title: "Atmospheric Keys",
    tags: ["keys", "ambient"],
  },
];

export default function Stack() {
  const { user } = useUser();
  const { tracks } = useStack();
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [duration, setDuration] = useState<{ [key: string]: number }>({});
  const [volumes, setVolumes] = useState<{ [key: string]: number }>(
    Object.fromEntries(demoTracks.map((track) => [track.id, 0.8]))
  );
  const [mutedTracks, setMutedTracks] = useState<{ [key: string]: boolean }>(
    Object.fromEntries(demoTracks.map((track) => [track.id, false]))
  );
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const canvasRefs = useRef<{ [key: string]: HTMLCanvasElement }>({});
  const animationFrames = useRef<{ [key: string]: number }>({});
  const audioContextRef = useRef<AudioContext>();
  const analyserRefs = useRef<{ [key: string]: AnalyserNode }>({});
  const sourceRefs = useRef<{ [key: string]: MediaElementAudioSourceNode }>({});

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext ||
      (window as any).webkitAudioContext)();

    return () => {
      Object.values(animationFrames.current).forEach((frameId) => {
        cancelAnimationFrame(frameId);
      });
      audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    tracks.forEach((track) => {
      if (!audioRefs.current[track.id]) {
        const audio = new Audio(track.audioUrl);
        audio.volume = volumes[track.id] || 0.8;

        audio.addEventListener("loadedmetadata", () => {
          setDuration((prev) => ({ ...prev, [track.id]: audio.duration }));
        });

        audio.addEventListener("ended", () => handleAudioEnded(track.id));

        const handleTimeUpdate = () => {
          setProgress((prev) => ({ ...prev, [track.id]: audio.currentTime }));
        };

        audio.addEventListener("timeupdate", handleTimeUpdate);
        audioRefs.current[track.id] = audio;

        const cleanup = () => {
          audio.removeEventListener("timeupdate", handleTimeUpdate);
          audio.removeEventListener("ended", () => handleAudioEnded(track.id));
          audio.removeEventListener("loadedmetadata", () => {});
        };

        return cleanup;
      }
    });
  }, [tracks]);

  const setupAudioNode = async (trackId: string) => {
    const audio = audioRefs.current[trackId];
    if (!audio || !audioContextRef.current) return;

    try {
      // Resume audio context if it's suspended
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      // Only create new nodes if they don't exist
      if (!sourceRefs.current[trackId]) {
        const source = audioContextRef.current.createMediaElementSource(audio);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 128;

        source.connect(analyser);
        analyser.connect(audioContextRef.current.destination);

        sourceRefs.current[trackId] = source;
        analyserRefs.current[trackId] = analyser;
      }
    } catch (error) {
      console.error("Error setting up audio node:", error);
    }
  };

  const updateProgress = (trackId: string) => {
    const audio = audioRefs.current[trackId];
    if (!audio) return;

    setProgress((prev) => ({ ...prev, [trackId]: audio.currentTime }));

    if (playing === trackId) {
      // Update visualization
      visualize(trackId);
      // Request next frame only if still playing
      requestAnimationFrame(() => updateProgress(trackId));
    }
  };

  const togglePlay = async (trackId: string) => {
    const audio = audioRefs.current[trackId];
    if (!audio) {
      console.error("No audio element found for track:", trackId);
      return;
    }

    try {
      if (playing === trackId) {
        audio.pause();
        setPlaying(null);
        cancelAnimationFrame(animationFrames.current[trackId]);
      } else {
        if (playing && audioRefs.current[playing]) {
          audioRefs.current[playing].pause();
          cancelAnimationFrame(animationFrames.current[playing]);
        }

        await setupAudioNode(trackId);
        await audio.play();
        setPlaying(trackId);
        // Start progress tracking immediately
        requestAnimationFrame(() => updateProgress(trackId));
      }
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  };

  const handleAudioEnded = (trackId: string) => {
    setPlaying(null);
    setProgress((prev) => ({ ...prev, [trackId]: 0 }));
    cancelAnimationFrame(animationFrames.current[trackId]);
  };

  const visualize = (trackId: string) => {
    const canvas = canvasRefs.current[trackId];
    const analyser = analyserRefs.current[trackId];
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw visualization
    const barWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      ctx.fillStyle = `rgba(255, 255, 255, ${barHeight / canvas.height})`;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth;
    }
  };

  const handleSeek = (trackId: string, value: number) => {
    const audio = audioRefs.current[trackId];
    if (!audio) return;

    // Update the audio's current time
    audio.currentTime = value;
    setProgress((prev) => ({ ...prev, [trackId]: value }));

    // If not playing, start visualization
    if (playing === trackId) {
      visualize(trackId);
    }
  };

  const handleVolumeChange = (trackId: string, value: number) => {
    const audio = audioRefs.current[trackId];
    if (!audio) return;

    setVolumes((prev) => ({ ...prev, [trackId]: value }));

    // Only update volume if track is not muted
    if (!mutedTracks[trackId]) {
      audio.volume = value;
    }
  };

  const handleMute = (trackId: string) => {
    const audio = audioRefs.current[trackId];
    if (!audio) return;

    setMutedTracks((prev) => {
      const newMuted = { ...prev, [trackId]: !prev[trackId] };

      // Store the current volume before muting
      if (newMuted[trackId]) {
        // If muting, set volume to 0
        audio.volume = 0;
      } else {
        // If unmuting, restore to previous volume
        audio.volume = volumes[trackId] || 0.8;
      }

      return newMuted;
    });
  };

  const removeTrack = (trackId: string) => {
    // Stop and cleanup audio if playing
    if (playing === trackId) {
      const audio = audioRefs.current[trackId];
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setPlaying(null);
      cancelAnimationFrame(animationFrames.current[trackId]);
    }

    // Cleanup audio resources
    if (sourceRefs.current[trackId]) {
      sourceRefs.current[trackId].disconnect();
      delete sourceRefs.current[trackId];
    }
    if (analyserRefs.current[trackId]) {
      analyserRefs.current[trackId].disconnect();
      delete analyserRefs.current[trackId];
    }
    if (audioRefs.current[trackId]) {
      delete audioRefs.current[trackId];
    }

    // Remove track from state
    setProgress((prev) => {
      const newProgress = { ...prev };
      delete newProgress[trackId];
      return newProgress;
    });
    setDuration((prev) => {
      const newDuration = { ...prev };
      delete newDuration[trackId];
      return newDuration;
    });
    setVolumes((prev) => {
      const newVolumes = { ...prev };
      delete newVolumes[trackId];
      return newVolumes;
    });
    setMutedTracks((prev) => {
      const newMuted = { ...prev };
      delete newMuted[trackId];
      return newMuted;
    });
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 p-6 space-y-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Demo Stack</h1>
            <p className="text-sm text-muted-foreground">
              Created by {user?.fullName || user?.username}
            </p>
          </div>
          <Button>Save</Button>
        </div>

        {tracks.map((track) => (
          <div
            key={track.id}
            className="flex flex-col gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full hover:scale-110 transition-transform z-10"
                    onClick={() => togglePlay(track.id)}
                  >
                    {playing === track.id ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <canvas
                    ref={(el) => {
                      if (el) canvasRefs.current[track.id] = el;
                    }}
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
                <div>
                  <h3 className="font-medium">{track.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {track.instrument}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <VolumeControl
                  volume={volumes[track.id] || 0.8}
                  onVolumeChange={(value) =>
                    handleVolumeChange(track.id, value)
                  }
                  onMute={() => handleMute(track.id)}
                  isMuted={mutedTracks[track.id] || false}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTrack(track.id)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ProgressBar
              progress={progress[track.id] || 0}
              duration={duration[track.id] || 0}
              onSeek={(value) => handleSeek(track.id, value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
