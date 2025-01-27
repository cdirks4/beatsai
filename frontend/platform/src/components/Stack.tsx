"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/nextjs";
import { Play, Pause, RotateCw, Trash2 } from "lucide-react";
import { VolumeControl } from "@/components/ui/volume-control";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useStack } from "@/contexts/StackContext";
import { combineAudioTracks } from "@/lib/api/tracks";

interface Track {
  id: string;
  instrument: string;
  prompt: string;
  audioUrl: string;
  title?: string;
  tags?: string[];
  blob?: Blob;
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
  const { tracks, removeTrack: removeTrackFromContext, addTrack } = useStack();
  console.log(tracks);
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
    // Create new audio elements for new tracks
    tracks.forEach((track) => {
      if (!audioRefs.current[track.id]) {
        const audio = new Audio(track.audioUrl);
        audio.volume = volumes[track.id] || 0.8;

        const handleLoadedMetadata = () => {
          setDuration((prev) => ({ ...prev, [track.id]: audio.duration }));
        };

        const handleEnded = () => handleAudioEnded(track.id);

        const handleTimeUpdate = () => {
          setProgress((prev) => ({ ...prev, [track.id]: audio.currentTime }));
        };

        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        audio.addEventListener("ended", handleEnded);
        audio.addEventListener("timeupdate", handleTimeUpdate);
        audioRefs.current[track.id] = audio;

        // Setup audio node immediately
        setupAudioNode(track.id);
      }
    });

    // Cleanup function
    return () => {
      Object.entries(audioRefs.current).forEach(([id, audio]) => {
        if (!tracks.find((t) => t.id === id)) {
          audio.pause();
          audio.removeEventListener("loadedmetadata", () => {});
          audio.removeEventListener("ended", () => handleAudioEnded(id));
          audio.removeEventListener("timeupdate", () => {});

          // Clean up audio nodes
          if (sourceRefs.current[id]) {
            try {
              sourceRefs.current[id].disconnect();
            } catch (e) {
              // Ignore disconnect errors
            }
            delete sourceRefs.current[id];
          }
          if (analyserRefs.current[id]) {
            try {
              analyserRefs.current[id].disconnect();
            } catch (e) {
              // Ignore disconnect errors
            }
            delete analyserRefs.current[id];
          }
          delete audioRefs.current[id];
        }
      });
    };
  }, [tracks]);

  useEffect(() => {
    return () => {
      // Cleanup blob URLs when component unmounts
      tracks.forEach((track) => {
        if (track.audioUrl.startsWith("blob:")) {
          URL.revokeObjectURL(track.audioUrl);
        }
      });
    };
  }, [tracks]);

  const setupAudioNode = async (trackId: string) => {
    const audio = audioRefs.current[trackId];
    if (!audio || !audioContextRef.current) return;

    try {
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      // If we don't have a source node for this track yet, create one
      if (!sourceRefs.current[trackId]) {
        const source = audioContextRef.current.createMediaElementSource(audio);
        sourceRefs.current[trackId] = source;
      }

      // Get the existing source node
      const source = sourceRefs.current[trackId];

      // Create new analyser and gain nodes (these can be recreated)
      const analyser = audioContextRef.current.createAnalyser();
      const gainNode = audioContextRef.current.createGain();
      analyser.fftSize = 128;

      // Disconnect existing connections if any
      try {
        source.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }

      // Connect nodes
      source.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      analyserRefs.current[trackId] = analyser;
      gainNode.gain.value = volumes[trackId] || 0.8;
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
      await setupAudioNode(trackId);

      if (playing === trackId) {
        audio.pause();
        setPlaying(null);
        cancelAnimationFrame(animationFrames.current[trackId]);
      } else {
        // If another track is playing, pause it first
        if (playing && audioRefs.current[playing]) {
          audioRefs.current[playing].pause();
          cancelAnimationFrame(animationFrames.current[playing]);
        }

        await audio.play();
        setPlaying(trackId);
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

  const removeTrack = async (trackId: string) => {
    try {
      // Stop playing if this track is playing
      if (playing === trackId) {
        const audio = audioRefs.current[trackId];
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
        setPlaying(null);
      }

      // Clean up audio nodes
      if (sourceRefs.current[trackId]) {
        try {
          sourceRefs.current[trackId].disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        delete sourceRefs.current[trackId];
      }
      if (analyserRefs.current[trackId]) {
        try {
          analyserRefs.current[trackId].disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        delete analyserRefs.current[trackId];
      }

      // Clean up audio element
      const audio = audioRefs.current[trackId];
      if (audio) {
        audio.pause();
        audio.removeEventListener("loadedmetadata", () => {});
        audio.removeEventListener("ended", () => handleAudioEnded(trackId));
        audio.removeEventListener("timeupdate", () => {});
      }
      delete audioRefs.current[trackId];

      // Clean up blob URL if it exists
      const track = tracks.find((t) => t.id === trackId);
      if (track?.audioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(track.audioUrl);
      }

      // Remove from context
      removeTrackFromContext(trackId);
    } catch (error) {
      console.error("Error removing track:", error);
    }
  };

  const handleCombine = async () => {
    try {
      // Pause any playing track
      if (playing) {
        const audio = audioRefs.current[playing];
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
        setPlaying(null);
      }

      // Get audio data from each track
      const trackData = tracks.map((track) => {
        return {
          id: track.id,
          instrument: track.instrument,
          audioUrl: track.audioUrl,
          volume: volumes[track.id] || 0.8,
          isMuted: mutedTracks[track.id] || false,
          // Get the actual audio buffer from the audio element
          audioBuffer: audioRefs.current[track.id]?.src || track.audioUrl,
        };
      });

      // Send to backend for combining
      const result = await combineAudioTracks(trackData);

      // Create a new track object for the combined track
      const combinedTrack = {
        id: `combined-${Date.now()}`,
        instrument: "Combined",
        prompt: "Combined track from multiple instruments",
        audioUrl: result.audioUrl,
        title: `Combined Track ${new Date().toLocaleTimeString()}`,
        tags: ["combined"],
        blob: result.blob,
      };

      // Add the combined track to the stack
      await addTrack(combinedTrack);

      // Set up audio handling for the new track
      const audio = new Audio();
      audio.src = result.audioUrl;
      audio.volume = 0.8;
      audioRefs.current[combinedTrack.id] = audio;
      setVolumes((prev) => ({ ...prev, [combinedTrack.id]: 0.8 }));
      setMutedTracks((prev) => ({ ...prev, [combinedTrack.id]: false }));

      // Setup audio node for the combined track
      await setupAudioNode(combinedTrack.id);

      // Optional: Download the combined track
      const a = document.createElement("a");
      a.href = result.audioUrl;
      a.download = `combined-track-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error combining tracks:", error);
    }
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
          <div className="flex gap-2">
            <Button onClick={handleCombine}>Combine Tracks</Button>
          </div>
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
