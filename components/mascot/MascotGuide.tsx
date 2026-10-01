"use client";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { mascotSrc, type MascotState } from "@/config/mascot";
export function MascotGuide({
  state = "idle",
  message,
  position = "inline",
  size = 160,
  showBubble = true,
  interactive = false,
  onClick,
  onClose,
  priority = false,
}: {
  state?: MascotState;
  message?: string;
  position?: "inline" | "hero" | "aside";
  size?: number;
  showBubble?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  onClose?: () => void;
  priority?: boolean;
}) {
  const reduced = useReducedMotion();
  const celebrate = ["celebrate", "correct", "achievement"].includes(state);
  return (
    <div className={"mascot-guide " + position}>
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={
          reduced
            ? { opacity: 1 }
            : {
                opacity: 1,
                y: celebrate
                  ? [0, -8, 0]
                  : state === "thinking"
                    ? [0, -2, 0]
                    : [0, -3, 0],
              }
        }
        transition={{
          opacity: { duration: 0.2 },
          y: {
            duration: celebrate ? 0.5 : 3,
            repeat: celebrate ? 0 : Infinity,
            ease: "easeInOut",
          },
        }}
      >
        {interactive ? (
          <button
            className="mascot-image-button"
            onClick={onClick}
            aria-label="Maskot rehberini aç"
          >
            <Image
              src={mascotSrc(state)}
              width={size}
              height={Math.round(size * 1.35)}
              alt="Nehir Akademi rehberi"
              priority={priority}
            />
          </button>
        ) : (
          <Image
            src={mascotSrc(state)}
            width={size}
            height={Math.round(size * 1.35)}
            alt="Nehir Akademi rehberi"
            priority={priority}
          />
        )}
      </motion.div>
      {showBubble && message && (
        <div className="speech-bubble" role="status">
          {onClose && (
            <button
              className="bubble-close"
              aria-label="Mesajı kapat"
              onClick={onClose}
            >
              <X size={14} />
            </button>
          )}
          {message}
        </div>
      )}
    </div>
  );
}
