import { supabase, signInWithGoogle, signOut, onAuthStateChange } from "./supabase";
import type { User } from "@supabase/supabase-js";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Square, Share2, Plus, Check, Trash2, Search, Music } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Tape {
  id: string;
  title: string;
  artist: string;
  url: string;
  color: string;
  user_id?: string | null;
  sender_name?: string | null;
  recipient_name?: string | null;
}

interface ITunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  previewUrl: string;
  artworkUrl60: string;
  artworkUrl100?: string;
  collectionName: string;
}

const DEFAULT_TAPES: Tape[] = [
  {
    id: "1",
    title: "Never Ending Story",
    artist: "아이유",
    url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/05/6e/4d/056e4dc5-202e-504e-0bfe-b5f4f5f27524/mzaf_6940041711289687556.plus.aac.p.m4a",
    color: "bg-[#f49ac1]",
  },
  {
    id: "2",
    title: "멸종위기사랑",
    artist: "이찬혁",
    url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c5/55/24/c55524da-c79e-8c87-547c-785ddd7dd65f/mzaf_4710721138193236013.plus.aac.p.m4a",
    color: "bg-[#fcd34d]",
  },
  {
    id: "3",
    title: "주저하는 연인들을 위해",
    artist: "잔나비",
    url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b1/a4/0a/b1a40a3e-65ca-f51b-3bb9-12145d970895/mzaf_509885747699732949.plus.aac.p.m4a",
    color: "bg-orange-400",
  },
  {
    id: "4",
    title: "희재",
    artist: "성시경",
    url: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/2f/82/e1/2f82e17b-9448-05cc-34ff-1ce40d9fc253/mzaf_3639626922714453883.plus.aac.p.m4a",
    color: "bg-purple-400",
  },
];

const DEFAULT_TAPE_IDS = new Set(DEFAULT_TAPES.map((t) => t.id));

function getVisibleDefaults() {
  const dismissed: string[] = JSON.parse(localStorage.getItem("dismissedDefaults") || "[]");
  return DEFAULT_TAPES.filter((t) => !dismissed.includes(t.id));
}

function dismissDefault(tapeId: string) {
  const dismissed: string[] = JSON.parse(localStorage.getItem("dismissedDefaults") || "[]");
  if (!dismissed.includes(tapeId)) {
    dismissed.push(tapeId);
    localStorage.setItem("dismissedDefaults", JSON.stringify(dismissed));
  }
}

export default function App() {
  const playerRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGiftMode] = useState(() => {
    const hash = window.location.hash.replace(/^#\??/, "");
    const params = new URLSearchParams(hash);
    return !!params.get("id");
  });
  const [activeTape, setActiveTape] = useState<Tape | null>(null);
  const [giftSender, setGiftSender] = useState<string | null>(null);
  const [tapes, setTapes] = useState<Tape[]>(isGiftMode ? [] : DEFAULT_TAPES);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTape, setShareTape] = useState<Tape | null>(null);


  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchMixtapes(session.user.id);
      } else if (!isGiftMode) {
        setTapes(DEFAULT_TAPES);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchMixtapes = useCallback(async (userId?: string) => {
    if (!userId) return;

    let query = supabase
      .from("mixtapes")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("fetch error:", error);
      return;
    }

    const dbTapes: Tape[] = (data || []).map((item: any) => ({
      id: String(item.id),
      title: item.title,
      artist: item.artist,
      url: item.preview_url,
      color: item.color || "bg-[#f49ac1]",
      user_id: item.user_id ?? null,
      sender_name: item.sender_name ?? null,
      recipient_name: item.recipient_name ?? null,
    }));

    if (isGiftMode) {
      setTapes((prev) => {
        const sharedTapes = prev.filter((t) => !dbTapes.some((db) => db.id === t.id));
        return [...dbTapes, ...sharedTapes];
      });
    } else {
      setTapes(dbTapes);
    }
  }, [isGiftMode]);

  useEffect(() => {
    if (isGiftMode) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchMixtapes(session.user.id);
    });
  }, [fetchMixtapes, isGiftMode]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#\??/, "");
    const params = new URLSearchParams(hash);
    const sharedId = params.get("id");

    if (!sharedId) return;

    supabase
      .from("mixtapes")
      .select("*")
      .eq("id", sharedId)
      .single()
      .then(async ({ data: original }) => {
        if (!original) return;

        const sharedTape: Tape = {
          id: String(original.id),
          title: original.title,
          artist: original.artist,
          url: original.preview_url,
          color: original.color || "bg-[#f49ac1]",
          user_id: original.user_id ?? null,
          sender_name: original.sender_name ?? null,
          recipient_name: original.recipient_name ?? null,
        };

        // 로그인 상태: 내 컬렉션에 복제
        if (user && original.user_id !== user.id) {
          // 이미 복제한 적 있는지 확인 (같은 곡 + 같은 sender)
          const { data: existing } = await supabase
            .from("mixtapes")
            .select("id")
            .eq("user_id", user.id)
            .eq("title", original.title)
            .eq("artist", original.artist)
            .eq("sender_name", original.sender_name ?? "")
            .limit(1);

          if (!existing || existing.length === 0) {
            const { data: inserted } = await supabase
              .from("mixtapes")
              .insert({
                title: original.title,
                artist: original.artist,
                preview_url: original.preview_url,
                color: original.color,
                cover_image: original.cover_image,
                user_id: user.id,
                sender_name: original.sender_name,
                recipient_name: original.recipient_name,
              })
              .select()
              .single();

            if (inserted) {
              const clonedTape: Tape = {
                id: String(inserted.id),
                title: inserted.title,
                artist: inserted.artist,
                url: inserted.preview_url,
                color: inserted.color || "bg-[#f49ac1]",
                user_id: inserted.user_id,
                sender_name: inserted.sender_name,
                recipient_name: inserted.recipient_name,
              };
              setTapes((prev) => [clonedTape, ...prev.filter((t) => t.id !== clonedTape.id)]);
              setTimeout(() => setActiveTape(clonedTape), 1000);
              return;
            }
          } else {
            // 이미 있으면 기존 테이프를 워크맨에 삽입
            await fetchMixtapes(user.id);
          }
        }

        // 비로그인: 임시로 표시만
        setTapes((prev) => {
          if (prev.some((t) => t.id === sharedTape.id)) return prev;
          return [...prev, sharedTape];
        });
        setTimeout(() => setActiveTape(sharedTape), 1000);
      });
  }, [user]);

  useEffect(() => {
    const audio = playerRef.current;
    if (!audio) return;

    if (activeTape) {
      audio.src = activeTape.url;
      audio.load();
      setAudioError(false);
    } else {
      audio.pause();
      audio.src = "";
    }

    const handleError = () => {
      if (!audio.src || audio.src === window.location.href) return;
      setAudioError(true);
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(Math.floor(audio.currentTime));
    };

    audio.addEventListener("error", handleError);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [activeTape]);

  const handlePlay = () => {
    if (activeTape && !audioError) {
      playerRef.current?.play();
      setIsPlaying(true);
      setToast("iTunes의 저작권 정책으로 30초만 재생됩니다");
      setTimeout(() => setToast(""), 5000);
    }
  };

  const handlePause = () => {
    playerRef.current?.pause();
    setIsPlaying(false);
  };

  const handleStop = () => {
    const audio = playerRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleEject = () => {
    setIsPlaying(false);
    setTimeout(() => {
      setActiveTape(null);
    }, 300);
  };

  const handleInsertTape = (tape: Tape) => {
    if (activeTape) {
      handleEject();
      setTimeout(() => setActiveTape(tape), 500);
    } else {
      setActiveTape(tape);
    }
  };

  const handleShare = (tape: Tape) => {
    if (!user) {
      setToast("로그인 후 공유할 수 있습니다");
      setTimeout(() => setToast(""), 3000);
      return;
    }
    setShareTape(tape);
    setShowShareModal(true);
  };

  const canDeleteTape = (tape: Tape) => {
    if (DEFAULT_TAPE_IDS.has(tape.id)) return !!user;
    if (tape.id.startsWith("shared-")) return true;
    if (!tape.user_id) return true;
    if (user && tape.user_id === user.id) return true;
    return false;
  };

  const handleDeleteTape = async (tapeId: string) => {
    const tape = tapes.find((t) => t.id === tapeId);
    if (!tape || !canDeleteTape(tape)) return;

    if (DEFAULT_TAPE_IDS.has(tapeId) || tapeId.startsWith("shared-")) {
      if (DEFAULT_TAPE_IDS.has(tapeId)) dismissDefault(tapeId);
      setTapes((prev) => prev.filter((t) => t.id !== tapeId));
      if (activeTape?.id === tapeId) {
        handleStop();
        setActiveTape(null);
      }
      return;
    }

    const { error } = await supabase.from("mixtapes").delete().eq("id", tapeId);

    if (error) {
      console.error("delete error:", error);
      return;
    }

    setTapes((prev) => prev.filter((t) => t.id !== tapeId));
    if (activeTape?.id === tapeId) {
      handleStop();
      setActiveTape(null);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#9bc4c5] flex items-center justify-center px-[20px] py-8 md:px-0 font-sans relative overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const ejectTapeId = e.dataTransfer.getData("ejectTapeId");
        if (ejectTapeId) {
          handleEject();
        }
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.06)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>

      <div className="fixed top-4 right-4 z-50">
        {user ? (
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 bg-white/80 hover:bg-white text-[#1a3050] px-3 h-9 rounded-full backdrop-blur-sm border border-[#1a3050]/20 transition-all cursor-pointer shadow-sm"
          >
            {user.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt=""
                className="w-5 h-5 rounded-full"
              />
            )}
            <span className="font-mono text-xs uppercase tracking-wider font-bold">Logout</span>
          </button>
        ) : (
          <button
            onClick={() => signInWithGoogle()}
            className="flex items-center gap-2 bg-white/80 hover:bg-white text-[#1a3050] px-3 h-9 rounded-full backdrop-blur-sm border border-[#1a3050]/20 transition-all cursor-pointer shadow-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="font-mono text-xs uppercase tracking-wider font-bold">Login</span>
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-16 items-center z-10 w-full max-w-6xl justify-center">
        <div className="flex flex-col items-center gap-4 shrink-0">
          <Walkman
            activeTape={activeTape}
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            onEject={handleEject}
            onDropTape={(tapeId: string) => {
              const tape = tapes.find((t) => t.id === tapeId);
              if (tape) handleInsertTape(tape);
            }}
            currentTime={currentTime}
          />
        </div>

        <div className="flex flex-col gap-6 z-10 max-w-2xl w-full">
          <div className="flex items-center justify-between">
            <h2 className="text-[#1a3050] text-3xl font-serif italic tracking-widest font-bold">Mixtapes</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!user) {
                    setToast("로그인 후 추가할 수 있습니다");
                    setTimeout(() => setToast(""), 3000);
                    return;
                  }
                  setShowAddModal(true);
                }}
                className="flex items-center gap-2 bg-[#1a3050]/10 hover:bg-[#1a3050]/20 text-[#1a3050] px-4 py-2 rounded-full backdrop-blur-sm border border-[#1a3050]/20 transition-all cursor-pointer shadow-sm"
              >
                <Plus size={18} />
                <span className="font-mono text-sm uppercase tracking-wider font-bold">Create</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-items-center">
            {tapes.map((tape) => (
              <div
                key={tape.id}
                className="relative group perspective-1000 cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("tapeId", tape.id);
                  setDraggingId(tape.id);
                  const dragImage = e.currentTarget.querySelector(".tape-drag-image") as HTMLElement;
                  if (dragImage) {
                    e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2);
                  }
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                }}
              >
                <motion.div
                  className="tape-drag-image"
                  whileHover={{ rotateY: 5, rotateX: 5, scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <CassetteTape
                    tape={tape}
                    isSpinning={false}
                    onClick={() => handleInsertTape(tape)}
                    className={activeTape?.id === tape.id ? "opacity-50 grayscale" : ""}
                  />
                </motion.div>

                {draggingId !== tape.id && (
                  <div className="absolute -top-4 -right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                    {canDeleteTape(tape) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTape(tape.id);
                        }}
                        className="bg-white p-3 rounded-full shadow-xl hover:scale-110 hover:bg-red-50 hover:text-red-500 transition-all cursor-pointer text-gray-800"
                        title="Delete Mixtape"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(tape);
                      }}
                      className="bg-white p-3 rounded-full shadow-xl hover:scale-110 hover:bg-gray-100 transition-all cursor-pointer text-gray-800"
                      title="Share Mixtape"
                    >
                      <Share2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AddTapeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={() => fetchMixtapes(user?.id)}
        user={user}
      />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => { setShowShareModal(false); setShareTape(null); }}
        tape={shareTape}
        onShared={(updatedTape: Tape) => {
          setTapes(prev => prev.map(t => t.id === updatedTape.id ? updatedTape : t));
        }}
        setToast={setToast}
      />

      <audio ref={playerRef} style={{ display: "none" }} />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white text-gray-900 px-6 py-3 rounded-2xl shadow-2xl font-mono text-sm flex items-center gap-3 z-50"
          >
            <Check size={16} className="text-green-500 shrink-0" />
            <span className="text-center leading-relaxed whitespace-pre-line">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Walkman = ({ activeTape, isPlaying, onPlay, onPause, onStop, onEject, onDropTape, currentTime }: any) => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className={`relative w-full max-w-[380px] h-[640px] bg-[#e3e2d6] rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.4),inset_0_2px_10px_rgba(255,255,255,0.8)] border border-[#c4c3b8] flex flex-col p-5 z-10 shrink-0 transition-all duration-300 ${isDragOver ? "ring-4 ring-blue-400/50" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const tapeId = e.dataTransfer.getData("tapeId");
        if (tapeId && onDropTape) {
          onDropTape(tapeId);
        }
      }}
    >
      <div
        className="absolute inset-0 opacity-40 mix-blend-multiply pointer-events-none rounded-[2rem]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")`,
        }}
      ></div>

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-6 bg-[#3a3a3a] rounded-b-xl shadow-[inset_0_-2px_5px_rgba(0,0,0,0.5)] flex items-center justify-center">
        <div className="w-12 h-0.5 bg-gray-500 rounded-full"></div>
      </div>

      <Screw top="top-3" left="left-3" />
      <Screw top="top-3" left="right-3" />
      <Screw top="bottom-3" left="left-3" />
      <Screw top="bottom-3" left="right-3" />

      <div className="mt-10 w-full flex justify-center z-10">
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(21, minmax(0, 1fr))" }}>
          {Array.from({ length: 21 * 12 }).map((_, i) => {
            const row = Math.floor(i / 21);
            const col = i % 21;
            if (row >= 9 && col <= 4) return <div key={i} className="w-1.5 h-1.5"></div>;
            return (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#3a3a3a] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.5)]"
              ></div>
            );
          })}
        </div>
      </div>

      <div className="absolute top-[210px] left-6 z-10 flex flex-col items-center">
        <div className="w-12 h-5 bg-[#1a1a1a] rounded-sm p-0.5 flex items-center shadow-[inset_0_2px_5px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.4)]">
          <div className="w-4 h-4 bg-gradient-to-b from-[#a0a0a0] to-[#707070] rounded-sm shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.8)] border border-[#4a4a4a]"></div>
        </div>
        <div className="text-[10px] font-black text-[#6a6962] mt-1 tracking-wider">RANDOM</div>
      </div>

      <div className="mt-8 w-full bg-[#e3e2d6] rounded-xl shadow-[0_10px_20px_rgba(0,0,0,0.2),inset_0_2px_5px_rgba(255,255,255,0.9),inset_0_-2px_5px_rgba(0,0,0,0.1)] border border-[#d0cfc4] p-4 relative z-10 flex flex-col items-center">
        <div className="w-[300px] h-[180px] bg-[#111] rounded-lg shadow-[inset_0_10px_20px_rgba(0,0,0,0.9)] relative overflow-hidden flex items-center justify-center border-[3px] border-[#2a2a2a]">
          <AnimatePresence>
            {activeTape && (
              <motion.div
                key={activeTape.id}
                initial={{ y: -200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -200, opacity: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 80, mass: 1.2 }}
                className="absolute z-10 scale-[0.95] cursor-grab active:cursor-grabbing hover:scale-[0.98] transition-transform"
                draggable
                onDragStart={(e: any) => {
                  e.dataTransfer.setData("ejectTapeId", activeTape.id);
                }}
              >
                <CassetteTape tape={activeTape} isSpinning={isPlaying} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-white/10 to-transparent pointer-events-none z-20"></div>

          <div className="absolute bottom-2 left-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded-sm px-1.5 py-0.5 flex items-center gap-0.5 z-30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]">
            {String(currentTime || 0)
              .padStart(3, "0")
              .split("")
              .map((d, i) => (
                <div key={i} className="text-white font-mono text-xs bg-black px-1 rounded-sm">
                  {d}
                </div>
              ))}
          </div>
        </div>

        <div className="flex justify-center items-center mt-4 gap-2 opacity-60">
          <span className="text-[#5a5952] font-sans text-lg tracking-widest font-medium">nomonomo</span>
        </div>
      </div>

      <div className="mt-auto mb-4 w-full z-10">
        <div className="flex justify-between px-4 mb-2">
          {["EJECT", "STOP", isPlaying ? "PAUSE" : "PLAY", "REW", "FF"].map((label) => (
            <span key={label} className="text-[11px] font-black text-[#6a6962] w-[52px] text-center tracking-wider">
              {label}
            </span>
          ))}
        </div>
        <div className="flex justify-between gap-1.5 bg-[#1a1a1a] p-2 rounded-xl shadow-[inset_0_4px_10px_rgba(0,0,0,0.9),0_2px_0_rgba(255,255,255,0.3)]">
          <WalkmanButton
            icon={
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-transparent border-b-current"></div>
                <div className="w-3 h-1 bg-current"></div>
              </div>
            }
            onClick={onEject}
          />
          <WalkmanButton icon={<Square size={16} fill="currentColor" />} onClick={onStop} />
          <WalkmanButton
            icon={
              isPlaying ? (
                <div className="flex gap-1">
                  <div className="w-2 h-4 bg-current"></div>
                  <div className="w-2 h-4 bg-current"></div>
                </div>
              ) : (
                <Play size={20} fill="currentColor" />
              )
            }
            onClick={isPlaying ? onPause : onPlay}
            active={isPlaying}
          />
          <WalkmanButton
            icon={
              <div className="flex">
                <Play size={18} fill="currentColor" className="rotate-180 -mr-2" />
                <Play size={18} fill="currentColor" className="rotate-180" />
              </div>
            }
            onClick={() => {}}
          />
          <WalkmanButton
            icon={
              <div className="flex">
                <Play size={18} fill="currentColor" className="-mr-2" />
                <Play size={18} fill="currentColor" />
              </div>
            }
            onClick={() => {}}
          />
        </div>
      </div>

      <div className="absolute -right-8 top-[55%] w-8 h-28 bg-[#4a4a4a] rounded-r-xl border-y border-r border-[#2a2a2a] flex items-center justify-center shadow-[5px_5px_10px_rgba(0,0,0,0.3),inset_2px_0_5px_rgba(255,255,255,0.2)] z-0">
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-col gap-1">
            <div className="w-4 h-0.5 bg-gray-600"></div>
            <div className="w-4 h-0.5 bg-gray-600"></div>
            <div className="w-4 h-0.5 bg-gray-600"></div>
          </div>
          <span className="text-white font-black text-sm rotate-90 tracking-widest mt-4">SONY</span>
        </div>
      </div>
    </div>
  );
};

const WalkmanButton = ({ icon, onClick, active }: any) => (
  <button
    onClick={onClick}
    className={`w-[52px] h-[64px] bg-gradient-to-b from-[#5a5a5a] to-[#2a2a2a] rounded-lg border border-[#111] flex flex-col items-center justify-center gap-2 shadow-[inset_0_2px_5px_rgba(255,255,255,0.3),0_5px_10px_rgba(0,0,0,0.8)] transition-all relative overflow-hidden ${active ? "translate-y-1.5 shadow-[inset_0_2px_5px_rgba(0,0,0,0.5),0_0_0_rgba(0,0,0,0)] bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]" : "hover:brightness-110 active:translate-y-1.5 active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.5),0_0_0_rgba(0,0,0,0)]"}`}
  >
    <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
    <div className="text-[#111] drop-shadow-[0_1px_0_rgba(255,255,255,0.2)] z-10">{icon}</div>
    <div className="flex gap-1 mt-1 z-10">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#1a1a1a] shadow-[inset_0_1px_2px_rgba(0,0,0,1),0_1px_0_rgba(255,255,255,0.2)]"
        ></div>
      ))}
    </div>
  </button>
);

const CassetteTape = ({ tape, isSpinning, onClick, className = "" }: any) => {
  const baseColor = tape.color || "bg-[#f49ac1]";

  return (
    <div
      onClick={onClick}
      className={`relative w-[280px] h-[175px] ${baseColor} rounded-xl shadow-[inset_0_0_10px_rgba(0,0,0,0.1),0_10px_20px_rgba(0,0,0,0.3)] flex flex-col items-center p-3 cursor-pointer transition-transform border border-black/10 ${className}`}
    >
      <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E')] mix-blend-multiply pointer-events-none rounded-xl"></div>

      <Screw top="top-2" left="left-2" />
      <Screw top="top-2" left="right-2" />
      <Screw top="bottom-2" left="left-2" />
      <Screw top="bottom-2" left="right-2" />

      <div className="w-full h-[100px] bg-[#f8f9fa] rounded-md flex flex-col relative overflow-hidden shadow-sm mt-1 border border-gray-300 z-10">
        <div className="h-9 w-full px-3 py-0.5 flex items-center gap-2 border-b border-gray-300 bg-white/90">
          <div className="bg-[#1a1a1a] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">A</div>
          <div className="flex-1 flex flex-col justify-center w-full overflow-hidden">
            <div className="border-b-2 border-gray-400 w-full relative h-4 flex justify-between items-end px-1 pb-[1px]">
              <span className="text-[11px] font-bold text-gray-800 truncate max-w-[60%] leading-none font-mono tracking-tight">
                {tape.title}
              </span>
              <span className="text-[9px] font-medium text-gray-600 truncate max-w-[35%] leading-none font-mono tracking-tight text-right">
                {tape.artist}
              </span>
            </div>
            <div className="border-b-2 border-gray-400 w-full relative h-4"></div>
          </div>
        </div>

        <div className="flex flex-col w-full h-8">
          <div className="flex-1 bg-[#ff4d4d]"></div>
          <div className="flex-1 bg-[#ffa64d]"></div>
          <div className="flex-1 bg-[#ffff4d]"></div>
          <div className="flex-1 bg-[#4dff4d]"></div>
          <div className="flex-1 bg-[#4d4dff]"></div>
        </div>

        <div className="h-8 w-full px-3 py-1 flex justify-between items-center bg-[#f8f9fa] border-t border-gray-300">
          <div className="font-bold text-gray-800 text-sm">C-90</div>
          {tape.sender_name ? (
            <div className="text-[10px] font-bold text-gray-500 font-mono truncate max-w-[65%]">
              <span>from. {tape.sender_name}</span>
            </div>
          ) : (
            <div className="flex gap-2 text-[8px] font-bold text-gray-600">
              <span className="flex items-center gap-0.5">
                <div className="w-1.5 h-1.5 border border-gray-600"></div> IN
              </span>
              <span className="flex items-center gap-0.5">
                <div className="w-1.5 h-1.5 border border-gray-600"></div> OUT
              </span>
            </div>
          )}
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[170px] h-[48px] bg-[#1a1a1a] rounded-full border border-[#333] shadow-[inset_0_4px_10px_rgba(0,0,0,0.9),0_1px_1px_rgba(255,255,255,0.2)] flex items-center justify-between px-3 z-10">
          <Reel isSpinning={isSpinning} />
          <div className="w-14 h-7 bg-[#0a0a0a] mx-1 z-10 rounded-sm border border-[#222] shadow-[inset_0_2px_5px_rgba(0,0,0,0.9)] flex items-center justify-center relative overflow-hidden">
            <div className="w-full h-3/4 bg-gradient-to-r from-[#0a0a0a] via-[#2a1f1a] to-[#0a0a0a] opacity-90"></div>
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
          </div>
          <Reel isSpinning={isSpinning} />
        </div>
      </div>

      <div className="absolute bottom-0 w-[200px] h-[35px] bg-[#e2e2e2] rounded-t-lg border-t border-l border-r border-black/10 flex justify-center items-end pb-2 shadow-[inset_0_2px_5px_rgba(255,255,255,0.5)] z-10 mix-blend-luminosity opacity-50">
        <div className="flex gap-6 items-center">
          <div className="w-3 h-3 rounded-full bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]"></div>
          <div className="w-4 h-4 rounded-full bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]"></div>
          <div className="w-3 h-3 rounded-full bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]"></div>
        </div>
      </div>
    </div>
  );
};

const Screw = ({ top, left }: any) => (
  <div
    className={`absolute ${top} ${left} w-4 h-4 rounded-full bg-gradient-to-br from-[#e0e0e0] to-[#8a8a8a] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),0_1px_3px_rgba(0,0,0,0.5)] flex items-center justify-center z-20 border border-[#a0a0a0]`}
  >
    <div className="w-2.5 h-2.5 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center relative">
      <div className="absolute w-full h-[1.5px] bg-[#4a4a4a] rotate-45"></div>
      <div className="absolute w-full h-[1.5px] bg-[#4a4a4a] -rotate-45"></div>
    </div>
  </div>
);

const Reel = ({ isSpinning }: any) => (
  <div
    className="w-10 h-10 shrink-0 rounded-full bg-[#151515] flex items-center justify-center relative shadow-[inset_0_2px_5px_rgba(0,0,0,1)] z-10 border border-[#2a2a2a] animate-spin"
    style={{
      animationDuration: "3s",
      animationPlayState: isSpinning ? "running" : "paused",
    }}
  >
    <div className="w-3 h-3 bg-[#000] rounded-full z-20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"></div>
    {[0, 120, 240].map((deg) => (
      <div
        key={deg}
        className="absolute w-1.5 h-3.5 bg-[#333] origin-bottom z-10"
        style={{
          transform: `rotate(${deg}deg) translateY(-5px)`,
          bottom: "50%",
        }}
      ></div>
    ))}
    <div className="absolute inset-1 rounded-full border-2 border-[#0a0a0a] pointer-events-none"></div>
  </div>
);

const AddTapeModal = ({ isOpen, onClose, onAdded, user }: any) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ITunesResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ITunesResult | null>(null);
  const [color, setColor] = useState("bg-[#fcd34d]");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchItunes = useCallback((term: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!term.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&country=KR&limit=6`
        );
        const data = await res.json();
        setResults(data.results?.filter((r: ITunesResult) => r.previewUrl) || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null);
    searchItunes(val);
  };

  const handleSelect = (item: ITunesResult) => {
    setSelected(item);
    setResults([]);
    setQuery(item.trackName + " - " + item.artistName);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const tape = {
      title: selected.trackName,
      artist: selected.artistName,
      preview_url: selected.previewUrl,
      color,
      cover_image: selected.artworkUrl100 || selected.artworkUrl60,
      user_id: user?.id ?? null,
    };

    const { error } = await supabase.from("mixtapes").insert(tape);

    if (error) {
      console.error("save error:", error);
      return;
    }

    if (onAdded) {
      await onAdded();
    }

    onClose();
    setQuery("");
    setSelected(null);
    setResults([]);
  };

  const handleClose = () => {
    onClose();
    setQuery("");
    setSelected(null);
    setResults([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#f5f5f0] p-8 rounded-2xl shadow-2xl w-[440px] border border-gray-300">
        <h2 className="text-2xl font-serif italic font-bold text-gray-800 mb-6">Create Mixtape</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">Search Music</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={handleQueryChange}
                className="w-full bg-white border border-gray-300 pl-9 pr-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="노래 제목 또는 아티스트 검색..."
                autoFocus
              />
            </div>

            {searching && (
              <div className="mt-2 text-xs font-mono text-gray-400 flex items-center gap-2 px-1">
                <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                검색 중...
              </div>
            )}

            {results.length > 0 && (
              <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[240px] overflow-y-auto">
                {results.map((item) => (
                  <button
                    key={item.trackId}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <img src={item.artworkUrl60} alt="" className="w-10 h-10 rounded-md shadow-sm shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{item.trackName}</div>
                      <div className="text-xs text-gray-500 truncate">{item.artistName} · {item.collectionName}</div>
                    </div>
                    <Music size={14} className="text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {query.trim() && !searching && results.length === 0 && !selected && (
              <div className="mt-2 text-xs font-mono text-gray-400 px-1">검색 결과가 없습니다</div>
            )}
          </div>

          {selected && (
            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
              <img src={selected.artworkUrl60} alt="" className="w-12 h-12 rounded-md shadow-sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 truncate">{selected.trackName}</div>
                <div className="text-xs text-gray-500 truncate">{selected.artistName}</div>
                <div className="text-[10px] text-gray-400 truncate">{selected.collectionName}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setQuery("");
                }}
                className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Tape Color</label>
            <div className="flex gap-2">
              {["bg-[#fcd34d]", "bg-orange-400", "bg-[#f49ac1]", "bg-blue-400", "bg-green-400", "bg-purple-400", "bg-red-400", "bg-[#a8d8ea]", "bg-[#e6c9a8]", "bg-gray-400"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full ${c} border-2 cursor-pointer transition-transform ${color === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                ></button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 font-mono text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selected}
              className={`px-6 py-2 font-mono text-sm rounded-md shadow-md cursor-pointer transition-all ${selected ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ShareModal = ({ isOpen, onClose, tape, onShared, setToast }: {
  isOpen: boolean;
  onClose: () => void;
  tape: Tape | null;
  onShared: (updatedTape: Tape) => void;
  setToast: (msg: string) => void;
}) => {
  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tape) {
      setSenderName(tape.sender_name || "");
      setRecipientName(tape.recipient_name || "");
    }
  }, [tape]);

  const handleShare = async () => {
    if (!tape) return;
    setSaving(true);

    const trimmedSender = senderName.trim() || null;
    const trimmedRecipient = recipientName.trim() || null;

    // Only update DB if tape is not a default/local tape
    if (!DEFAULT_TAPE_IDS.has(tape.id) && !tape.id.startsWith("shared-")) {
      const { error } = await supabase
        .from("mixtapes")
        .update({ sender_name: trimmedSender, recipient_name: trimmedRecipient })
        .eq("id", tape.id);

      if (error) {
        console.error("share update error:", error);
        setSaving(false);
        return;
      }
    }

    const updatedTape: Tape = {
      ...tape,
      sender_name: trimmedSender,
      recipient_name: trimmedRecipient,
    };
    onShared(updatedTape);

    const shareUrl = window.location.origin + "/#?id=" + tape.id;
    navigator.clipboard.writeText(shareUrl);
    setToast("Link copied! Share it with friends.");
    setTimeout(() => setToast(""), 5000);

    setSaving(false);
    onClose();
  };

  const handleClose = () => {
    setSenderName("");
    setRecipientName("");
    onClose();
  };

  if (!isOpen || !tape) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#f5f5f0] p-8 rounded-2xl shadow-2xl w-[440px] border border-gray-300">
        <h2 className="text-2xl font-serif italic font-bold text-gray-800 mb-6">Share Mixtape</h2>

        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3 mb-6">
          <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
            <Music size={18} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-900 truncate">{tape.title}</div>
            <div className="text-xs text-gray-500 truncate">{tape.artist}</div>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <div className="flex-1">
            <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">To (nickname)</label>
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full bg-white border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="예) 순둥이"
              autoFocus
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">From (nickname)</label>
            <input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full bg-white border border-gray-300 px-3 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="예) 노모노모"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 font-mono text-sm text-gray-600 hover:text-gray-900 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={saving}
            className="px-6 py-2 font-mono text-sm rounded-md shadow-md cursor-pointer transition-all bg-gray-900 text-white hover:bg-gray-800 flex items-center gap-2"
          >
            <Share2 size={14} />
            Share
          </button>
        </div>
      </div>
    </div>
  );
};