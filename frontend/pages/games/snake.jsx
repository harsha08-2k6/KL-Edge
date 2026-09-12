import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Layout } from "../../components/Layout.jsx";

const GRID_SIZE = 16;
const INITIAL_SNAKE = [
  { x: 8, y: 8 },
  { x: 7, y: 8 },
  { x: 6, y: 8 },
];
const INITIAL_DIRECTION = { x: 1, y: 0 };

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function createFood(occupiedCells) {
  const openCells = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cell = { x, y };
      if (!occupiedCells.some((occupied) => sameCell(occupied, cell))) {
        openCells.push(cell);
      }
    }
  }

  return openCells[Math.floor(Math.random() * openCells.length)] || { x: 4, y: 4 };
}

function getDirectionFromKey(key) {
  const normalized = key.toLowerCase();
  if (normalized === "arrowup" || normalized === "w") return { x: 0, y: -1 };
  if (normalized === "arrowdown" || normalized === "s") return { x: 0, y: 1 };
  if (normalized === "arrowleft" || normalized === "a") return { x: -1, y: 0 };
  if (normalized === "arrowright" || normalized === "d") return { x: 1, y: 0 };
  return null;
}

export default function Snake() {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [food, setFood] = useState(() => createFood(INITIAL_SNAKE));
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState("ready");

  const speed = useMemo(() => Math.max(80, 190 - (snake.length - INITIAL_SNAKE.length) * 8), [snake.length]);
  const cells = useMemo(() => Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => ({
    x: index % GRID_SIZE,
    y: Math.floor(index / GRID_SIZE)
  })), []);

  const changeDirection = useCallback((nextDirection) => {
    if (!nextDirection) return;

    setDirection((current) => {
      if (current.x + nextDirection.x === 0 && current.y + nextDirection.y === 0) {
        return current;
      }
      return nextDirection;
    });

    setGameState((current) => (current === "ready" ? "playing" : current));
  }, []);

  const restart = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setFood(createFood(INITIAL_SNAKE));
    setDirection(INITIAL_DIRECTION);
    setScore(0);
    setGameState("playing");
  }, []);

  const step = useCallback(() => {
    setSnake((currentSnake) => {
      const head = currentSnake[0];
      const nextHead = { x: head.x + direction.x, y: head.y + direction.y };
      const ateFood = sameCell(nextHead, food);
      const bodyForCollision = ateFood ? currentSnake : currentSnake.slice(0, -1);
      const hitWall = nextHead.x < 0 || nextHead.y < 0 || nextHead.x >= GRID_SIZE || nextHead.y >= GRID_SIZE;
      const hitSelf = bodyForCollision.some((segment) => sameCell(segment, nextHead));

      if (hitWall || hitSelf) {
        setGameState("gameOver");
        return currentSnake;
      }

      const nextSnake = [nextHead, ...currentSnake];
      if (ateFood) {
        setScore((currentScore) => currentScore + 1);
        setFood(createFood(nextSnake));
        return nextSnake;
      }

      nextSnake.pop();
      return nextSnake;
    });
  }, [direction, food]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const nextDirection = getDirectionFromKey(event.key);
      if (!nextDirection) return;

      event.preventDefault();
      changeDirection(nextDirection);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeDirection]);

  useEffect(() => {
    if (gameState !== "playing") return undefined;

    const timer = window.setInterval(step, speed);
    return () => window.clearInterval(timer);
  }, [gameState, speed, step]);

  const statusText = (() => {
    if (gameState === "gameOver") return "Game Over";
    if (gameState === "ready") return "Use Arrow keys or WASD";
    return `Score ${score}`;
  })();

  const directionButtons = [
    { label: "Up", icon: ArrowUp, direction: { x: 0, y: -1 }, className: "col-start-2" },
    { label: "Left", icon: ArrowLeft, direction: { x: -1, y: 0 }, className: "col-start-1 row-start-2" },
    { label: "Down", icon: ArrowDown, direction: { x: 0, y: 1 }, className: "col-start-2 row-start-2" },
    { label: "Right", icon: ArrowRight, direction: { x: 1, y: 0 }, className: "col-start-3 row-start-2" },
  ];

  return (
    <Layout title="Snake" backTo="/more/games">
      <div className="space-y-4">
        {/* Header / Stats Panel */}
        <section className="relative overflow-hidden rounded-2xl border border-ink/10 bg-ink p-5 shadow-xl">
          {/* Decorative background glow */}
          <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-mint/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
          
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 animate-pulse rounded-full bg-mint"></span>
                <p className="text-[10px] font-black uppercase tracking-widest text-mint/80">Neon Arcade</p>
              </div>
              <h2 className="mt-1 text-2xl font-black text-white">{statusText}</h2>
            </div>
            
            <div className="flex gap-3">
              <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-wider text-white/50">Score</p>
                <p className="text-2xl font-black text-mint drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{score}</p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-wider text-white/50">Speed</p>
                <p className="text-2xl font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                  {Math.max(1, Math.round((210 - speed) / 18))}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Game Board */}
        <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-soft">
          <div className="snake-board relative mx-auto grid aspect-square w-full max-w-[28rem] overflow-hidden rounded-xl border-2 border-ink/20 bg-ink p-1.5 shadow-inner">
            {/* Subtle grid background pattern */}
            <div 
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
                backgroundSize: `${100 / GRID_SIZE}% ${100 / GRID_SIZE}%`
              }}
            />
            
            {cells.map((cell) => {
              const segmentIndex = snake.findIndex((segment) => sameCell(segment, cell));
              const isSnake = segmentIndex !== -1;
              const isHead = segmentIndex === 0;
              const isFood = sameCell(food, cell);

              let cellStyle = "bg-transparent";
              let shadow = "";
              
              if (isHead) {
                cellStyle = "bg-mint z-10 rounded-sm";
                shadow = "0 0 10px rgba(16, 185, 129, 0.8)";
              } else if (isSnake) {
                // Gradient body effect based on distance from head
                const opacity = Math.max(0.4, 1 - (segmentIndex / snake.length));
                cellStyle = "bg-mint rounded-sm transition-all duration-100";
                shadow = `0 0 5px rgba(16, 185, 129, ${opacity})`;
              } else if (isFood) {
                cellStyle = "bg-coral rounded-full animate-pulse scale-75";
                shadow = "0 0 15px rgba(244, 63, 94, 0.9)";
              }

              return (
                <div
                  key={`${cell.x}-${cell.y}`}
                  className={`aspect-square m-[1px] ${cellStyle}`}
                  style={{ boxShadow: shadow, zIndex: isSnake ? 5 : 1 }}
                >
                  {isFood && (
                    <div className="flex h-full w-full items-center justify-center text-[10px] leading-none">
                      🍎
                    </div>
                  )}
                  {isHead && (
                    <div className="relative h-full w-full">
                      {/* Cute little eyes on the snake head based on direction */}
                      <div className="absolute bg-ink rounded-full w-1.5 h-1.5" 
                           style={{ 
                             top: direction.y === 1 ? 'auto' : '20%', 
                             bottom: direction.y === -1 ? 'auto' : '20%', 
                             left: direction.x === 1 ? 'auto' : '20%', 
                             right: direction.x === -1 ? 'auto' : '20%' 
                           }} />
                      <div className="absolute bg-ink rounded-full w-1.5 h-1.5"
                           style={{ 
                             top: direction.y === 1 || direction.x !== 0 ? 'auto' : '20%', 
                             bottom: direction.y === -1 || direction.x !== 0 ? 'auto' : '20%', 
                             left: direction.x === 1 || direction.y !== 0 ? 'auto' : '20%', 
                             right: direction.x === -1 || direction.y !== 0 ? 'auto' : '20%' 
                           }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Controls */}
          <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
            {/* Joystick D-PAD */}
            <div className="grid grid-cols-3 grid-rows-2 gap-2 justify-self-center">
              {directionButtons.map((item) => (
                <button
                  key={item.label}
                  onClick={() => changeDirection(item.direction)}
                  className={`tap group relative flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-b from-paper to-surface text-ink shadow-[0_4px_10px_rgba(0,0,0,0.1),_inset_0_2px_0_rgba(255,255,255,0.8)] transition-all active:translate-y-1 active:shadow-[0_0_0_rgba(0,0,0,0.1),_inset_0_2px_0_rgba(255,255,255,0.8)] ${item.className}`}
                  aria-label={item.label}
                >
                  <item.icon size={24} className="opacity-70 transition-transform group-hover:scale-110 group-active:scale-95" />
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="grid gap-3 sm:w-48">
              <button
                onClick={() => setGameState("playing")}
                disabled={gameState === "playing"}
                className="tap relative flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-ink text-sm font-black text-paper shadow-[0_4px_15px_rgba(18,21,31,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(18,21,31,0.25)] active:translate-y-0 active:shadow-none disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:animate-[shimmer_1.5s_infinite]" />
                <Play size={18} />
                Start Game
              </button>
              <button
                onClick={restart}
                className="tap flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-ink/5 bg-paper text-sm font-black text-ink/75 transition-all hover:bg-surface active:scale-95"
              >
                <RotateCcw size={18} />
                Restart
              </button>
            </div>
          </div>

          {gameState === "gameOver" && (
            <div className="mt-6 overflow-hidden rounded-xl border border-coral/30 bg-coral/10 p-5 text-center relative">
              <div className="absolute -left-4 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full bg-coral/20 blur-xl" />
              <div className="absolute -right-4 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full bg-coral/20 blur-xl" />
              <p className="relative z-10 text-2xl font-black tracking-wide text-coral drop-shadow-sm">GAME OVER</p>
              <p className="relative z-10 mt-1 text-sm font-bold text-ink/70">You scored {score} points</p>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
