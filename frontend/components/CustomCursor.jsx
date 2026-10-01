import { useEffect, useState } from "react";

export function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    // Only show custom cursor on non-touch devices
    const checkTouch = () => {
      const isTouch = window.matchMedia("(pointer: coarse)").matches;
      setIsDesktop(!isTouch);
    };
    
    checkTouch();
    window.addEventListener("resize", checkTouch);

    const updatePosition = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    if (isDesktop) {
      window.addEventListener("mousemove", updatePosition);
      document.body.addEventListener("mouseleave", handleMouseLeave);
      document.body.addEventListener("mouseenter", handleMouseEnter);
      
      // Hide default cursor globally
      document.body.style.cursor = "none";
      // To ensure links/buttons don't show the hand cursor, we can add a class to body
      document.body.classList.add("custom-cursor-active");
    } else {
      document.body.style.cursor = "auto";
      document.body.classList.remove("custom-cursor-active");
    }

    return () => {
      window.removeEventListener("resize", checkTouch);
      window.removeEventListener("mousemove", updatePosition);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
      document.body.removeEventListener("mouseenter", handleMouseEnter);
      document.body.style.cursor = "auto";
      document.body.classList.remove("custom-cursor-active");
    };
  }, [isDesktop, isVisible]);

  if (!isDesktop || !isVisible) return null;

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 z-[10000] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint shadow-[0_0_8px_rgba(45,212,191,0.5)] transition-transform duration-75 ease-out"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
      }}
    />
  );
}
