import { Bot, RefreshCcw, RotateCcw, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "../../components/Layout.jsx";

const EMPTY_BOARD = Array(9).fill(null);
const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];
const STATS_KEY = "kl-edge.ticTacToe.sessionStats";

function getWinner(board) {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }

  if (board.every(Boolean)) return { winner: "draw", line: [] };
  return { winner: null, line: [] };
}

function getAvailableMoves(board) {
  return board.reduce((moves, cell, index) => (cell ? moves : [...moves, index]), []);
}

function findTacticalMove(board, symbol) {
  for (const move of getAvailableMoves(board)) {
    const nextBoard = [...board];
    nextBoard[move] = symbol;
    if (getWinner(nextBoard).winner === symbol) return move;
  }
  return null;
}

function scoreBoard(board, computerSymbol, playerSymbol, depth) {
  const result = getWinner(board).winner;
  if (result === computerSymbol) return 10 - depth;
  if (result === playerSymbol) return depth - 10;
  if (result === "draw") return 0;
  return null;
}

function minimax(board, isMaximizing, computerSymbol, playerSymbol, depth = 0) {
  const score = scoreBoard(board, computerSymbol, playerSymbol, depth);
  if (score !== null) return { score, move: null };

  let best = { score: isMaximizing ? -Infinity : Infinity, move: null };
  const symbol = isMaximizing ? computerSymbol : playerSymbol;

  for (const move of getAvailableMoves(board)) {
    const nextBoard = [...board];
    nextBoard[move] = symbol;
    const candidate = minimax(nextBoard, !isMaximizing, computerSymbol, playerSymbol, depth + 1);

    if (isMaximizing ? candidate.score > best.score : candidate.score < best.score) {
      best = { score: candidate.score, move };
    }
  }

  return best;
}

function getRandomMove(board) {
  const moves = getAvailableMoves(board);
  return moves[Math.floor(Math.random() * moves.length)] ?? null;
}

function getComputerMove(board, difficulty, computerSymbol, playerSymbol) {
  if (difficulty === "easy") return getRandomMove(board);

  const winningMove = findTacticalMove(board, computerSymbol);
  if (winningMove !== null) return winningMove;

  const blockingMove = findTacticalMove(board, playerSymbol);
  if (blockingMove !== null) return blockingMove;

  if (difficulty === "medium") {
    const preferredMoves = [4, 0, 2, 6, 8].filter((move) => !board[move]);
    return Math.random() < 0.7 && preferredMoves.length ? preferredMoves[0] : getRandomMove(board);
  }

  return minimax(board, true, computerSymbol, playerSymbol).move ?? getRandomMove(board);
}

function readSessionStats() {
  if (typeof window === "undefined") return { wins: 0, losses: 0, draws: 0 };

  try {
    const stats = JSON.parse(window.sessionStorage.getItem(STATS_KEY));
    return {
      wins: Number(stats?.wins) || 0,
      losses: Number(stats?.losses) || 0,
      draws: Number(stats?.draws) || 0
    };
  } catch {
    return { wins: 0, losses: 0, draws: 0 };
  }
}

function writeSessionStats(stats) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }
}

export default function TicTacToe() {
  const [mode, setMode] = useState("computer");
  const [difficulty, setDifficulty] = useState("hard");
  const [playerSymbol, setPlayerSymbol] = useState("X");
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [currentPlayer, setCurrentPlayer] = useState("X");
  const [stats, setStats] = useState(() => readSessionStats());
  const lastScoredBoardRef = useRef("");

  const computerSymbol = playerSymbol === "X" ? "O" : "X";
  const result = useMemo(() => getWinner(board), [board]);
  const isComputerTurn = mode === "computer" && currentPlayer === computerSymbol && !result.winner;

  const startNewGame = useCallback(() => {
    setBoard(EMPTY_BOARD);
    lastScoredBoardRef.current = "";
    setCurrentPlayer("X");
  }, []);

  useEffect(() => {
    writeSessionStats(stats);
  }, [stats]);

  useEffect(() => {
    startNewGame();
  }, [difficulty, mode, playerSymbol, startNewGame]);

  useEffect(() => {
    if (!isComputerTurn) return;

    const timer = window.setTimeout(() => {
      setBoard((currentBoard) => {
        if (getWinner(currentBoard).winner) return currentBoard;
        const move = getComputerMove(currentBoard, difficulty, computerSymbol, playerSymbol);
        if (move === null) return currentBoard;
        const nextBoard = [...currentBoard];
        nextBoard[move] = computerSymbol;
        return nextBoard;
      });
      setCurrentPlayer(playerSymbol);
    }, 420);

    return () => window.clearTimeout(timer);
  }, [computerSymbol, difficulty, isComputerTurn, playerSymbol]);

  useEffect(() => {
    const scoredBoardKey = board.map((cell) => cell || "-").join("");
    if (!result.winner || lastScoredBoardRef.current === scoredBoardKey) return;

    lastScoredBoardRef.current = scoredBoardKey;
    setStats((current) => {
      if (result.winner === "draw") return { ...current, draws: current.draws + 1 };
      if (mode === "computer") {
        return result.winner === playerSymbol
          ? { ...current, wins: current.wins + 1 }
          : { ...current, losses: current.losses + 1 };
      }
      return result.winner === "X"
        ? { ...current, wins: current.wins + 1 }
        : { ...current, losses: current.losses + 1 };
    });
  }, [board, mode, playerSymbol, result.winner]);

  const makeMove = (index) => {
    if (board[index] || result.winner || isComputerTurn) return;

    const nextBoard = [...board];
    nextBoard[index] = currentPlayer;
    setBoard(nextBoard);
    setCurrentPlayer(currentPlayer === "X" ? "O" : "X");
  };

  const resetStats = () => {
    const freshStats = { wins: 0, losses: 0, draws: 0 };
    setStats(freshStats);
    writeSessionStats(freshStats);
  };

  const statusText = (() => {
    if (result.winner === "draw") return "It's a draw!";
    if (result.winner) {
      if (mode === "computer") return result.winner === playerSymbol ? "You win!" : "Computer wins!";
      return `Player ${result.winner} wins!`;
    }
    if (mode === "computer") return isComputerTurn ? "Computer is thinking..." : `Your turn: ${playerSymbol}`;
    return `Player ${currentPlayer}'s turn`;
  })();

  return (
    <Layout title="Tic-Tac-Toe" backTo="/more/games">
      <div className="space-y-3">
        <section className="rounded-xl border border-ink/10 bg-white/85 p-4 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-mint">Fun only</p>
              <h2 className="mt-0.5 text-lg font-black text-ink">Quick time-pass game</h2>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-paper px-3 py-2">
                <p className="text-[10px] font-black uppercase text-ink/40">Wins</p>
                <p className="text-xl font-black text-mint">{stats.wins}</p>
              </div>
              <div className="rounded-lg bg-paper px-3 py-2">
                <p className="text-[10px] font-black uppercase text-ink/40">Losses</p>
                <p className="text-xl font-black text-coral">{stats.losses}</p>
              </div>
              <div className="rounded-lg bg-paper px-3 py-2">
                <p className="text-[10px] font-black uppercase text-ink/40">Draws</p>
                <p className="text-xl font-black text-amber">{stats.draws}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-ink/10 bg-white/85 p-4 shadow-soft">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-ink/40">Mode</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "computer", label: "Computer", icon: Bot },
                  { value: "twoPlayer", label: "Two Player", icon: Users }
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setMode(item.value)}
                    className={`tap flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition-all ${
                      mode === item.value ? "border-ink bg-ink text-paper" : "border-ink/10 bg-paper text-ink/70"
                    }`}
                  >
                    <item.icon size={15} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {mode === "computer" ? (
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-ink/40">You play</p>
                <div className="grid grid-cols-2 gap-2">
                  {["X", "O"].map((symbol) => (
                    <button
                      key={symbol}
                      onClick={() => setPlayerSymbol(symbol)}
                      className={`tap rounded-lg border px-3 py-2 text-lg font-black transition-all ${
                        playerSymbol === symbol ? "border-mint bg-mint text-white" : "border-ink/10 bg-paper text-ink/70"
                      }`}
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-ink/40">Players</p>
                <div className="rounded-lg bg-paper px-3 py-2 text-sm font-bold text-ink/70">
                  Player X and Player O take turns locally.
                </div>
              </div>
            )}
          </div>

          {mode === "computer" ? (
            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-ink/40">Difficulty</p>
              <div className="grid grid-cols-3 gap-2">
                {["easy", "medium", "hard"].map((level) => (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className={`tap rounded-lg border px-3 py-2 text-xs font-black capitalize transition-all ${
                      difficulty === level ? "border-violet bg-violet text-white" : "border-ink/10 bg-paper text-ink/70"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-ink/10 bg-white p-4 text-center shadow-soft">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-3 text-sm font-black text-ink/75">
            {mode === "computer" ? (
              <>
                <span>You: {playerSymbol}</span>
                <span className="text-ink/25">|</span>
                <span>Computer: {computerSymbol}</span>
              </>
            ) : (
              <span>Local two-player match</span>
            )}
          </div>

          <div className="mx-auto grid aspect-square w-full max-w-[22rem] grid-cols-3 rounded-xl border border-ink/10 bg-ink/5 p-2">
            {board.map((cell, index) => {
              const isWinningCell = result.line.includes(index);
              return (
                <button
                  key={index}
                  onClick={() => makeMove(index)}
                  disabled={Boolean(cell) || Boolean(result.winner) || isComputerTurn}
                  aria-label={`Cell ${index + 1}${cell ? ` ${cell}` : ""}`}
                  className={`tap tic-tac-toe-cell flex aspect-square items-center justify-center border-ink/15 text-5xl font-black transition-all sm:text-6xl ${
                    index % 3 !== 2 ? "border-r" : ""
                  } ${index < 6 ? "border-b" : ""} ${
                    isWinningCell
                      ? "bg-lime/35 text-ink animate-tic-win"
                      : cell === "X"
                        ? "text-mint"
                        : cell === "O"
                          ? "text-coral"
                          : "text-ink/25 hover:bg-white/70"
                  }`}
                >
                  {cell ? <span className="animate-tic-pop">{cell}</span> : null}
                </button>
              );
            })}
          </div>

          <p className={`mt-4 text-xl font-black ${result.winner ? "text-ink" : "text-ink/70"}`}>{statusText}</p>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              onClick={() => startNewGame()}
              className="tap inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-black text-paper shadow-soft transition-transform active:scale-95"
            >
              <RefreshCcw size={16} />
              New Game
            </button>
            <button
              onClick={() => startNewGame()}
              className="tap inline-flex items-center justify-center gap-2 rounded-lg border border-ink/10 bg-paper px-4 py-2.5 text-sm font-black text-ink/75 transition-transform active:scale-95"
            >
              <RotateCcw size={16} />
              Play Again
            </button>
            <button
              onClick={resetStats}
              className="tap rounded-lg border border-coral/20 bg-coral/5 px-4 py-2.5 text-sm font-black text-coral transition-transform active:scale-95"
            >
              Reset Statistics
            </button>
          </div>
        </section>
      </div>
    </Layout>
  );
}
