import { useState, useRef, useEffect, useCallback } from "react";
import "./MovingEyes.css";

export default function MovingEyes() {
  const [position, setPosition] = useState({ x: window.innerWidth - 130, y: window.innerHeight - 150 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Load position from local storage
  useEffect(() => {
    const saved = localStorage.getItem("creature_position");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Make sure it's within bounds
        const x = Math.max(0, Math.min(parsed.x, window.innerWidth - 120));
        const y = Math.max(0, Math.min(parsed.y, window.innerHeight - 120));
        setPosition({ x, y });
      } catch (e) {}
    }
  }, []);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) return;
    
    // Calculate new position bounded by window
    let newX = e.clientX - dragOffset.current.x;
    let newY = e.clientY - dragOffset.current.y;
    
    newX = Math.max(0, Math.min(newX, window.innerWidth - 116));
    newY = Math.max(0, Math.min(newY, window.innerHeight - 104));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handlePointerUp = useCallback((e) => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem("creature_position", JSON.stringify(position));
      e.target.releasePointerCapture(e.pointerId);
    }
  }, [isDragging, position]);

  return (
    <div 
      className="creature-container fixed z-50 cursor-grab active:cursor-grabbing touch-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="creature pointer-events-none">
        <img
          src="/creature.png"
          alt="creature"
          className="creature-image drop-shadow-xl"
        />
      </div>
    </div>
  );
}
