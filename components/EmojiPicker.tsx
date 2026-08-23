"use client";

import { useEffect, useRef, useState } from "react";

const EMOJIS = [
  "😀", "😂", "🥰", "😍", "😘", "😉", "😎", "🤩", "🥳", "😇",
  "🙂", "😅", "🤔", "😏", "😴", "😢", "😭", "😡", "🥺", "😱",
  "👍", "👎", "🙏", "👏", "💪", "🤝", "🤙", "✌️", "👌", "🤟",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔", "❤️‍🔥", "💯",
  "🔥", "✨", "🎉", "🎊", "⭐", "🌟", "☀️", "🌙", "☕", "🍔",
  "🍕", "🍰", "🍎", "🚗", "🏠", "📍", "💰", "🎁", "⏰", "✅",
];

export default function EmojiPicker({
  onPick,
}: {
  onPick: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/5 text-lg"
      >
        😊
      </button>
      {open && (
        <div className="fade-in absolute bottom-12 right-0 z-50 grid w-64 grid-cols-8 gap-1 rounded-xl2 glass p-3 shadow-soft">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-lg transition hover:scale-125 hover:bg-black/5"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
