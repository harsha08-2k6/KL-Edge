import React, { useState, useEffect, useRef, useCallback } from "react";
import { Settings, Moon, Sun, ArrowRight, Zap } from "lucide-react";
import "./RobotAnimations.css";

const ROBOT_STATES = {
  IDLE: "idle",
  MOVING: "moving",
  HAPPY: "happy",
  THINKING: "thinking",
  SLEEPING: "sleeping",
  SURPRISED: "surprised",
  DRAGGING: "dragging",
};

const PHRASES = [
  "Hi!",
  "How are you?",
  "Need any help?",
  "I'm here!",
  "Let's get started!",
  "You're doing great!",
  "Nice!",
  "Welcome back!"
];

export function RobotCompanion({ maintenanceMessage, dashboardStats, userName = "User" }) {
  const [robotState, setRobotState] = useState(ROBOT_STATES.IDLE);
  const [position, setPosition] = useState({ x: window.innerWidth - 200, y: window.innerHeight - 200 });
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  const [speech, setSpeech] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const messageIndexRef = useRef(0);

  const robotRef = useRef(null);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const lastState = useRef(ROBOT_STATES.IDLE);
  const animationFrameRef = useRef(null);
  const targetPos = useRef(null);

  const changeState = useCallback((newState, duration = 0) => {
    if (robotState === ROBOT_STATES.SLEEPING && newState !== ROBOT_STATES.IDLE) {
      if (newState !== ROBOT_STATES.DRAGGING) return;
    }

    lastState.current = robotState;
    setRobotState(newState);

    if (duration > 0) {
      setTimeout(() => {
        setRobotState((current) => current === newState ? ROBOT_STATES.IDLE : current);
      }, duration);
    }
  }, [robotState]);

  useEffect(() => {
    if (robotState === ROBOT_STATES.SLEEPING || robotState === ROBOT_STATES.DRAGGING) {
      setSpeech("");
      return;
    }

    let timeoutId;
    let index = 0;

    const runCycle = () => {
      if (maintenanceMessage) {
        setSpeech(maintenanceMessage);
        setTimeout(() => setSpeech(""), 5000);
        timeoutId = setTimeout(runCycle, 10000);
        return;
      }
      
      if (!dashboardStats) {
        timeoutId = setTimeout(runCycle, 10000);
        return;
      }

      const messages = [];
      if (dashboardStats.nextClass && dashboardStats.nextClassMins !== null) {
        messages.push(`Next class in ${dashboardStats.nextClassMins} min`);
        if (dashboardStats.nextClass.classroom) {
          messages.push(`${dashboardStats.nextClass.subjectName} (Room ${dashboardStats.nextClass.classroom})`);
        } else {
          messages.push(`${dashboardStats.nextClass.subjectName}`);
        }
      } else {
        messages.push("No more classes today!");
      }
      
      if (dashboardStats.overallAttendance !== null) {
        messages.push(`Attendance: ${dashboardStats.overallAttendance}%`);
      }
      
      if (dashboardStats.assignmentsDueToday?.length > 0) {
        messages.push(`${dashboardStats.assignmentsDueToday.length} assignment(s) due today`);
      }
      
      if (dashboardStats.classesRemaining !== undefined) {
        messages.push(`${dashboardStats.classesRemaining} classes remaining`);
      }

      if (messages.length === 0) {
        timeoutId = setTimeout(runCycle, 5 * 60 * 1000);
        return;
      }

      if (index < messages.length) {
        setSpeech(messages[index]);
        index++;
        
        setTimeout(() => setSpeech(""), 4000);
        timeoutId = setTimeout(runCycle, 8000);
      } else {
        index = 0;
        timeoutId = setTimeout(runCycle, 5 * 60 * 1000); // 5 minutes break
      }
    };

    timeoutId = setTimeout(runCycle, 2000);

    return () => clearTimeout(timeoutId);
  }, [robotState, maintenanceMessage, dashboardStats]);

  useEffect(() => {
    let lastTime = performance.now();

    const updatePhysics = (time) => {
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;

      if (!isDragging.current && robotState !== ROBOT_STATES.SLEEPING) {
        setPosition(prev => {
          let newX = prev.x;
          let newY = prev.y;
          let vx = velocity.x;
          let vy = velocity.y;

          if (targetPos.current && robotState === ROBOT_STATES.MOVING) {
            const dx = targetPos.current.x - prev.x;
            const dy = targetPos.current.y - prev.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 10) {
              targetPos.current = null;
              setVelocity({ x: 0, y: 0 });
              changeState(ROBOT_STATES.IDLE);
            } else {
              const speed = 40;
              vx = (dx / dist) * speed;
              vy = (dy / dist) * speed;

              setFacingLeft(vx < 0);
              setVelocity({ x: vx, y: vy });
            }
          } else if (robotState === ROBOT_STATES.IDLE) {
            vx *= 0.9;
            vy *= 0.9;
            if (Math.abs(vx) < 1) vx = 0;
            if (Math.abs(vy) < 1) vy = 0;
            setVelocity({ x: vx, y: vy });
            // Random movement removed to keep the robot fixed in place
          }

          newX += vx * deltaTime;
          newY += vy * deltaTime;

          const padding = 200;
          const winW = window.innerWidth;
          const rightZoneStart = Math.max(winW - 350, winW * 0.65);

          if (newX < rightZoneStart + padding) { newX = rightZoneStart + padding; vx = 0; }
          if (newX > winW - padding) { newX = winW - padding; vx = 0; }
          if (newY < padding) { newY = padding; vy = 0; }
          if (newY > window.innerHeight - padding) { newY = window.innerHeight - padding; vy = 0; }

          return { x: newX, y: newY };
        });
      }

      animationFrameRef.current = requestAnimationFrame(updatePhysics);
    };

    animationFrameRef.current = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [robotState, velocity, changeState]);

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;

    isDragging.current = true;
    targetPos.current = null;
    const rect = robotRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    dragOffset.current = {
      x: e.clientX - centerX,
      y: e.clientY - centerY
    };

    setMenuOpen(false);
    changeState(ROBOT_STATES.DRAGGING);
    document.body.style.userSelect = 'none';
  };

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) {
      if (robotRef.current && robotState !== ROBOT_STATES.SLEEPING) {
        // Shaking animation trigger removed to keep robot stable
      }
      return;
    }

    let newX = e.clientX - dragOffset.current.x;
    let newY = e.clientY - dragOffset.current.y;

    const padding = 200;
    const winW = window.innerWidth;
    const rightZoneStart = Math.max(winW - 350, winW * 0.65);

    if (newX < rightZoneStart + padding) newX = rightZoneStart + padding;
    if (newX > winW - padding) newX = winW - padding;
    if (newY < padding) newY = padding;
    if (newY > window.innerHeight - padding) newY = window.innerHeight - padding;

    setPosition({ x: newX, y: newY });

    if (e.movementX !== 0) setFacingLeft(e.movementX < 0);

  }, [robotState, changeState]);

  const handlePointerUp = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      document.body.style.userSelect = '';

      if (robotState !== ROBOT_STATES.SLEEPING) {
        changeState(ROBOT_STATES.HAPPY, 1000);
      } else {
        changeState(ROBOT_STATES.SLEEPING);
      }
    }
  }, [robotState, changeState]);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleClick = (e) => {
    if (e.defaultPrevented) return;
    if (robotState === ROBOT_STATES.SLEEPING) {
      setSpeech("Zzz...");
      setTimeout(() => setSpeech(""), 2000);
      return;
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenuOpen(true);
  };

  const getAnimationClass = () => {
    switch (robotState) {
      case ROBOT_STATES.IDLE: return "robot-idle";
      case ROBOT_STATES.MOVING: return "robot-moving";
      case ROBOT_STATES.HAPPY: return "robot-happy";
      case ROBOT_STATES.THINKING: return "robot-thinking";
      case ROBOT_STATES.SLEEPING: return "robot-sleeping";
      case ROBOT_STATES.SURPRISED: return "robot-surprised";
      case ROBOT_STATES.DRAGGING: return "";
      default: return "robot-idle";
    }
  };

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-40 hidden md:block"
      ref={containerRef}
    >
      <div
        ref={robotRef}
        className="absolute pointer-events-auto transition-transform duration-100 ease-out will-change-transform flex justify-center items-center"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) translate(-50%, -50%)`,
          cursor: isDragging.current ? 'grabbing' : 'grab',
          width: '120px',
          height: '120px'
        }}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {speech && (
          <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-2xl shadow-lg border border-ink/10 speech-bubble text-sm font-bold text-ink whitespace-nowrap z-30 pointer-events-none animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300 ease-out">
            {speech}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r border-b border-ink/10 rotate-45 transform origin-center"></div>
          </div>
        )}

        {robotState === ROBOT_STATES.SLEEPING && (
          <div className="absolute inset-0 pointer-events-none">
            <span className="zzz-particle zzz-1">Z</span>
            <span className="zzz-particle zzz-2">Z</span>
            <span className="zzz-particle zzz-3">Z</span>
          </div>
        )}

        <div className={`relative w-full h-full drop-shadow-2xl transition-transform duration-300`}>
          <div className={`w-full h-full bg-contain bg-center bg-no-repeat ${getAnimationClass()}`}
            style={{ backgroundImage: "url('/robot.png')" }}
          />
        </div>

        {menuOpen && (
          <div className="absolute top-1/2 left-[110%] -translate-y-1/2 bg-white rounded-2xl shadow-xl border border-ink/10 w-40 overflow-hidden pointer-events-auto z-50 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 space-y-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  const winW = window.innerWidth;
                  const winH = window.innerHeight;
                  const rightZoneStart = Math.max(winW - 350, winW * 0.65);
                  const bottomZoneStart = Math.max(winH - 350, winH * 0.5);
                  targetPos.current = {
                    x: rightZoneStart + (winW - rightZoneStart) / 2,
                    y: bottomZoneStart + (winH - bottomZoneStart) / 2
                  };
                  changeState(ROBOT_STATES.MOVING);
                }}
                className="w-full text-left px-3 py-2 text-sm font-semibold text-ink/80 hover:text-ink hover:bg-surface rounded-lg flex items-center gap-2 transition-colors"
              >
                <ArrowRight size={14} /> Move Center
              </button>

              {robotState !== ROBOT_STATES.SLEEPING ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); changeState(ROBOT_STATES.SLEEPING); setSpeech("Good night!"); setTimeout(() => setSpeech(""), 2000); }}
                  className="w-full text-left px-3 py-2 text-sm font-semibold text-ink/80 hover:text-ink hover:bg-surface rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Moon size={14} /> Sleep
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); changeState(ROBOT_STATES.HAPPY, 1500); setSpeech("Good to see you!"); setTimeout(() => setSpeech(""), 3000); }}
                  className="w-full text-left px-3 py-2 text-sm font-semibold text-mint hover:bg-mint/10 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Sun size={14} /> Wake Up
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 pointer-events-auto z-30"
          onClick={() => { setMenuOpen(false); }}
        />
      )}
    </div>
  );
}
