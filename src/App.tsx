import { useEffect, useRef, useState } from 'react';
import { Activity, Shield, SquareTerminal, Rocket } from 'lucide-react';
import { GameEngine } from './services/GameEngine';
import { generateCommanderTaunt } from './services/aiCommander';
import { PlayerState } from './types';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const animationFrameRef = useRef<number>();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  
  const [playerState, setPlayerState] = useState<PlayerState>({
      x: 0, y: 0,
      energy: 100, maxEnergy: 100,
      health: 100, maxHealth: 100,
      isShielded: false,
      score: 0, meteorsHit: 0,
      weaponTimer: 0,
      scoreTimer: 0,
      rocketCount: 3
  });
  const [wave, setWave] = useState(1);
  const [commanderMsg, setCommanderMsg] = useState('');

  useEffect(() => {
    return () => {
      if (engineRef.current) engineRef.current.stop();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => engineRef.current?.handleKeyDown(e);
    const handleKeyUp = (e: KeyboardEvent) => engineRef.current?.handleKeyUp(e);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const startGame = (startingWave: number) => {
    setIsPlaying(true);
    setGameOver(false);
    setCommanderMsg('');
    setShowLevelSelect(false);

    if (canvasRef.current) {
      engineRef.current = new GameEngine(canvasRef.current);
      
      engineRef.current.onPlayerStateChange = (state, currentWave) => {
          setPlayerState(state);
          setWave(currentWave);
      };

      engineRef.current.onGameOver = (score, meteorsHit, finalWave) => {
          handleGameOver(score, meteorsHit, finalWave);
      };

      engineRef.current.start(startingWave);
    }
  };

  const handleGameOver = (finalScore: number, meteorsHit: number, finalWave: number) => {
     if (engineRef.current) engineRef.current.stop();
     if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
     setIsPlaying(false);
     setGameOver(true);
     
     setCommanderMsg('LORD XYLAR IS TRANSMITTING...');
     
     generateCommanderTaunt(finalWave, meteorsHit, finalScore).then(msg => setCommanderMsg(msg));
  };

  return (
    <div className="relative w-full h-screen bg-[#05050a] overflow-hidden font-sans text-white select-none damage-flash transition-colors duration-[50ms]">
      <style>{`
        .damage-flash.animate-ping {
           background-color: rgba(255, 0, 0, 0.4);
        }
      `}</style>
      
      {/* Cyberpunk Vignette & Scanlines (optimized) */}
      <div 
          className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#00ffff_2px,#00ffff_4px)]"
      />
      


      {/* The Game Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10 pointer-events-none transition-opacity duration-1000"
        style={{ opacity: isPlaying ? 1 : 0.2 }}
      />

      {/* UI Overlay Container */}
      <div className="relative z-20 w-full h-full flex flex-col pointer-events-none pt-4 px-6 md:pt-8 md:px-10">
        
        {/* HUD */}
        {isPlaying && (
          <div className="flex justify-between items-start">
             <div className="flex flex-col gap-2">
                <div className="text-xs font-bold tracking-[0.4em] text-cyan-500 uppercase flex items-center gap-2">
                   <Rocket className="w-4 h-4" /> GAXXY GARDIEN
                </div>
                <div className="text-5xl font-black tabular-nums tracking-widest text-[#fff] [text-shadow:0_0_15px_rgba(0,255,255,0.8)]">
                  {playerState.score.toString().padStart(6, '0')}
                </div>
                <div className="text-sm font-bold tracking-[0.2em] text-fuchsia-400 mt-2">
                   WAVE {wave}
                </div>
             </div>

             <div className="flex flex-col items-end gap-4 w-48 md:w-64">
                {/* Health Bar */}
                <div className="w-full">
                    <div className="flex justify-between text-xs font-bold tracking-[0.2em] text-red-400 mb-1">
                        <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> HULL</span>
                        <span>{Math.max(0, Math.floor(playerState.health))}%</span>
                    </div>
                    <div className="w-full h-3 bg-black border border-red-900 overflow-hidden">
                       <div 
                         className="h-full bg-gradient-to-r from-red-800 to-red-400 transition-all duration-200"
                         style={{ width: `${Math.max(0, playerState.health)}%` }}
                       />
                    </div>
                </div>

                {/* Energy Bar */}
                <div className="w-full">
                    <div className="flex justify-between text-xs font-bold tracking-[0.2em] text-[#22d3ee] mb-1">
                        <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> SHIELD ENERGY</span>
                        <span>{Math.max(0, Math.floor(playerState.energy))}%</span>
                    </div>
                    <div className="w-full h-2 bg-black border border-cyan-900 overflow-hidden">
                       <div 
                         className="h-full bg-gradient-to-r from-cyan-800 to-cyan-300 transition-all duration-100"
                         style={{ width: `${Math.max(0, playerState.energy)}%` }}
                       />
                    </div>
                </div>

                {/* Buffs */}
                <div className="flex flex-col gap-2 w-full items-end mt-2">
                    {playerState.weaponTimer > 0 && (
                        <div className="text-[10px] font-bold px-2 py-1 bg-purple-900/50 text-purple-400 border border-purple-500/50 tracking-widest inline-block animate-pulse">
                            RAPID BLAST: {Math.max(0, playerState.weaponTimer).toFixed(1)}s
                        </div>
                    )}
                    {playerState.scoreTimer > 0 && (
                        <div className="text-[10px] font-bold px-2 py-1 bg-yellow-900/50 text-yellow-400 border border-yellow-500/50 tracking-widest inline-block animate-pulse">
                            2X SCORE: {Math.max(0, playerState.scoreTimer).toFixed(1)}s
                        </div>
                    )}
                    <div className="flex gap-2 items-center mt-2">
                        {Array.from({ length: playerState.rocketCount }).map((_, i) => (
                            <Rocket key={i} className="w-5 h-5 text-orange-500 fill-orange-500/30 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]" />
                        ))}
                        {playerState.rocketCount === 0 && (
                            <span className="text-[10px] text-gray-600 font-bold tracking-widest uppercase">No Rockets</span>
                        )}
                    </div>
                </div>

                <button 
                  onClick={() => {
                     engineRef.current?.stop();
                     setIsPlaying(false);
                     setGameOver(false);
                  }}
                  className="mt-4 px-4 py-2 bg-red-900/40 text-red-400 border border-red-500/50 text-xs font-mono tracking-widest uppercase hover:bg-red-800/60 transition-colors pointer-events-auto"
                >
                  ABORT MISSION
                </button>
             </div>
          </div>
        )}

         {/* In-Game Controls Legend */}
        {isPlaying && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] md:text-xs font-mono text-cyan-500/60 tracking-widest uppercase pointer-events-none w-full px-4 text-center">
               <div className="flex gap-2 items-center">
                  <kbd className="border border-cyan-800/40 bg-cyan-950/20 px-1.5 py-0.5 rounded">WASD/ARROWS</kbd> MOVE
               </div>
               <div className="flex gap-2 items-center">
                  <kbd className="border border-cyan-800/40 bg-cyan-950/20 px-1.5 py-0.5 rounded">SPACE</kbd> FIRE
               </div>
               <div className="flex gap-2 items-center text-orange-500/80">
                  <kbd className="border border-orange-800/40 bg-orange-950/20 px-1.5 py-0.5 rounded">X/1</kbd> ROCKET
               </div>
               <div className="flex gap-2 items-center">
                  <kbd className="border border-cyan-800/40 bg-cyan-950/20 px-1.5 py-0.5 rounded">SHIFT</kbd> SHIELD
               </div>
            </div>
        )}

        {/* Boss Interactions UI */}
        {isPlaying && playerState.hasBossWarning && (
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center animate-pulse pointer-events-none">
                <div className="text-3xl md:text-5xl text-red-500 font-bold tracking-widest bg-black/80 px-8 py-4 border border-red-500 rounded uppercase shadow-[0_0_50px_rgba(255,0,0,0.5)]">
                    WARNING: THE BIG ENEMY COMING
                </div>
            </div>
        )}

        {isPlaying && playerState.bossHealthPct > 0 && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 w-3/4 max-w-2xl bg-black/90 p-2 border border-purple-500/50 pointer-events-none">
                <div className="text-purple-400 font-bold text-xs mb-1 tracking-[0.3em] uppercase text-center animate-pulse">
                    THE BIG ENEMY
                </div>
                <div className="w-full h-3 bg-gray-900 overflow-hidden shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                     <div 
                        className="h-full bg-gradient-to-r from-purple-800 to-red-600 transition-all duration-200"
                        style={{ width: `${Math.max(0, playerState.bossHealthPct * 100)}%` }}
                     />
                </div>
            </div>
        )}

        {/* Main Menu */}
        {!isPlaying && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto text-center px-4">
             <div className="relative">
                 <h1 className="text-[5rem] md:text-[7rem] leading-none font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-100 to-cyan-800 uppercase [text-shadow:0_0_20px_rgba(0,255,255,0.3)]">
                   Galaxy
                   <br />
                   <span className="text-[#00ffff] [text-shadow:0_0_40px_rgba(0,255,255,0.8)]">Guardian</span>
                 </h1>
                 <div className="absolute -top-4 -right-4 bg-red-600 text-white text-xs font-bold px-2 py-1 transform rotate-12 uppercase tracking-widest">
                     KEYBOARD DIRECTED
                 </div>
             </div>

             <div className="mb-12 mt-12 text-[10px] md:text-sm font-mono tracking-widest text-cyan-500 uppercase flex flex-wrap justify-center gap-x-8 gap-y-4 opacity-70">
                 <div className="flex gap-2 items-center">
                    <span className="border border-cyan-800/50 bg-cyan-950/50 px-2 py-1 rounded">WASD/ARROWS</span> <span>Move</span>
                 </div>
                 <div className="flex gap-2 items-center">
                    <span className="border border-cyan-800/50 bg-cyan-950/50 px-2 py-1 rounded">SPACE</span> <span>Fire</span>
                 </div>
                 <div className="flex gap-2 items-center">
                    <span className="border border-cyan-800/50 bg-cyan-950/50 px-2 py-1 rounded">SHIFT/Z</span> <span>Shield</span>
                 </div>
                 <div className="flex gap-2 items-center text-orange-400">
                    <span className="border border-orange-800/50 bg-orange-950/50 px-2 py-1 rounded">X/F/1</span> <span>Rocket</span>
                 </div>
             </div>
             
             {!showLevelSelect ? (
               <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <p className="text-cyan-500/60 font-mono tracking-widest text-xs uppercase mb-2 italic">Systems Ready for Deployment</p>
                  <button 
                    onClick={() => setShowLevelSelect(true)}
                    className="relative overflow-hidden px-20 py-6 bg-gradient-to-r from-cyan-600 to-blue-700 text-white font-black text-2xl tracking-[0.4em] uppercase hover:scale-105 active:scale-95 hover:shadow-[0_0_50px_rgba(0,255,255,0.6)] transition-all outline-none border-2 border-cyan-400 rounded-sm group"
                  >
                    <span className="relative z-10">Launch Fighter</span>
                    <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
                  </button>
               </div>
             ) : (
               <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-500 bg-black/60 p-10 border border-cyan-500/20 backdrop-blur-sm rounded-lg">
                 <h2 className="text-2xl font-mono text-cyan-400 mb-2 tracking-[0.4em] uppercase font-bold">Select Sector</h2>
                 <div className="flex flex-col md:flex-row gap-6">
                   <button 
                     onClick={() => startGame(1)}
                     className="px-10 py-6 bg-black/80 border-2 border-green-500/40 text-green-400 hover:bg-green-500 hover:text-black hover:shadow-[0_0_30px_rgba(0,255,0,0.4)] transition-all font-mono uppercase tracking-widest text-lg"
                   >
                     Patrol <br/><span className="text-xs opacity-70">Sector 1</span>
                   </button>
                   <button 
                     onClick={() => startGame(6)}
                     className="px-10 py-6 bg-black/80 border-2 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500 hover:text-black hover:shadow-[0_0_30px_rgba(255,255,0,0.4)] transition-all font-mono uppercase tracking-widest text-lg"
                   >
                     Frontier <br/><span className="text-xs opacity-70">Sector 6</span>
                   </button>
                   <button 
                     onClick={() => startGame(11)}
                     className="px-10 py-6 bg-black/80 border-2 border-red-500/40 text-red-400 hover:bg-red-500 hover:text-black hover:shadow-[0_0_30px_rgba(255,0,0,0.4)] transition-all font-mono uppercase tracking-widest text-lg"
                   >
                     Deadzone <br/><span className="text-xs opacity-70">Sector 11+</span>
                   </button>
                 </div>
                 <button 
                   onClick={() => setShowLevelSelect(false)}
                   className="mt-6 text-xs text-gray-500 hover:text-white uppercase tracking-[0.3em] font-mono transition-colors border-b border-transparent hover:border-white"
                 >
                   &lt; Back to Hangar
                 </button>
               </div>
             )}
          </div>
        )}

        {/* Game Over Screen */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto bg-[#05050a]/95 backdrop-blur-md z-50 px-4">
             <div className="max-w-2xl w-full p-8 md:p-12 bg-black/80 border border-red-900 shadow-[0_0_50px_rgba(255,0,0,0.2)] flex flex-col items-center text-center relative overflow-hidden">
                
                {/* Diagonal caution stripes */}
                <div className="absolute top-0 left-0 w-full h-2 bg-[repeating-linear-gradient(45deg,red,red_10px,transparent_10px,transparent_20px)] opacity-50" />
                <div className="absolute bottom-0 left-0 w-full h-2 bg-[repeating-linear-gradient(45deg,red,red_10px,transparent_10px,transparent_20px)] opacity-50" />

                <h2 className="text-2xl font-mono mb-2 tracking-[0.5em] text-red-500 font-bold drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">
                  CRITICAL HULL FAILURE
                </h2>
                
                <div className="text-[5rem] md:text-[6rem] leading-none font-black text-white mb-4 tabular-nums">
                   {playerState.score}
                </div>
                
                <div className="text-gray-400 font-mono text-sm mb-10 tracking-widest">
                   SURVIVED UNTIL WAVE {wave} | METEORS HIT: {playerState.meteorsHit}
                </div>

                <div className="w-full bg-[#100505] p-6 md:p-8 border-l-4 border-red-600 relative mb-12 text-left">
                   <div className="text-red-500 font-mono text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                       <SquareTerminal className="w-4 h-4" />
                       Incoming Transmission: Lord Xylar
                   </div>
                   <p className="text-gray-300 font-serif text-lg md:text-xl italic leading-relaxed">
                     "{commanderMsg}"
                   </p>
                </div>

                <button 
                  onClick={() => {
                      setGameOver(false);
                      setShowLevelSelect(true);
                  }}
                  className="px-16 py-4 bg-transparent border-2 border-white hover:bg-white hover:text-black text-white font-bold text-lg tracking-[0.2em] uppercase transition-all"
                >
                  DEPLOY NEW SHIP
                </button>
             </div>
          </div>
        )}

      </div>
    </div>
  );
}
