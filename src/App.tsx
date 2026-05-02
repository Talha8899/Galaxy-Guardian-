import { useEffect, useRef, useState } from 'react';
import { Activity, Shield, SquareTerminal, Rocket, Play, Pause, Zap, Crosshair, Radar, Info } from 'lucide-react';
import { GameEngine } from './services/GameEngine';
import { generateCommanderTaunt } from './services/aiCommander';
import { PlayerState } from './types';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  
  const [playerState, setPlayerState] = useState<PlayerState>({
      x: 0, y: 0,
      energy: 100, maxEnergy: 100,
      health: 100, maxHealth: 100,
      isShielded: false,
      score: 0, meteorsHit: 0,
      weaponTimer: 0,
      scoreTimer: 0,
      rocketCount: 3,
      bossHealthPct: 0,
      hasBossWarning: false
  });
  const [wave, setWave] = useState(1);
  const [commanderMsg, setCommanderMsg] = useState('');
  const [controlMode, setControlMode] = useState<'keyboard' | 'touch'>('keyboard');
  const [damageFlash, setDamageFlash] = useState(false);

  useEffect(() => {
    const mobile = window.innerWidth < 1024 || ('ontouchstart' in window);
    if (mobile) setControlMode('touch');
  }, []);

  const startGame = (startingWave: number) => {
    setIsPlaying(true);
    setIsPaused(false);
    setGameOver(false);
    setCommanderMsg('');

    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }

    if (canvasRef.current) {
      engineRef.current = new GameEngine(canvasRef.current);
      engineRef.current.setControlMode(controlMode);
      
      engineRef.current.onPlayerStateChange = (state, currentWave) => {
          if (state.health < playerState.health) {
              setDamageFlash(true);
              setTimeout(() => setDamageFlash(false), 150);
          }
          setPlayerState(state);
          setWave(currentWave);
      };

      engineRef.current.onGameOver = (score, meteorsHit, finalWave) => {
          handleGameOver(score, meteorsHit, finalWave);
      };

      engineRef.current.onPauseToggle = (paused) => {
          setIsPaused(paused);
      };

      engineRef.current.start(startingWave);
    }
  };

  const togglePause = () => {
    if (engineRef.current) {
        engineRef.current.togglePause();
        setIsPaused(engineRef.current.getIsPaused());
    }
  };

  const handleGameOver = (finalScore: number, meteorsHit: number, finalWave: number) => {
     if (engineRef.current) engineRef.current.stop();
     setIsPlaying(false);
     setGameOver(true);
     setCommanderMsg('INTERCEPTING TRANSMISSION...');
     generateCommanderTaunt(finalWave, meteorsHit, finalScore).then(msg => setCommanderMsg(msg));
  };

  return (
    <div className="relative w-full h-screen bg-[#05020a] overflow-hidden font-sans text-white select-none">
      <style>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
        .animate-spin-slow {
          animation: spin 10s linear infinite;
        }
      `}</style>
      
      {/* Background FX */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#00ffff_2px,#00ffff_4px)] z-0" />
      <div className="scanline z-0" />
      
      {/* Damage Flash */}
      <div className={`fixed inset-0 pointer-events-none z-50 transition-colors duration-150 ${damageFlash ? 'bg-red-500/20' : 'bg-transparent'}`} />

      {/* The Game Canvas */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full z-10 transition-opacity duration-700 ${isPlaying ? 'pointer-events-auto cursor-none' : 'pointer-events-none'}`}
        style={{ opacity: isPlaying ? 1 : 0.3 }}
      />

      {/* UI Overlay */}
      <div className="relative z-20 w-full h-full flex flex-col pointer-events-none p-3 sm:p-6">
        
        {/* Main HUD */}
        {isPlaying && (
          <div className="flex justify-between items-start animate-in fade-in slide-in-from-top-4 duration-500 w-full">
             <div className="flex flex-col gap-1 sm:gap-2 max-w-[50%]">
                <div className="stat-card px-2 py-2 sm:px-6 sm:py-4 flex flex-col neon-border w-auto overflow-hidden">
                    <div className="text-[8px] sm:text-[10px] uppercase font-bold tracking-[0.2em] text-cyan-400 mb-0.5 sm:mb-1 truncate">SCORE</div>
                    <div className="text-[5vw] sm:text-[4vw] md:text-4xl font-black tabular-nums tracking-tighter leading-none mb-1 sm:mb-0 w-full truncate">
                      {playerState.score.toLocaleString()}
                    </div>
                    <div className="flex gap-2 sm:gap-4 mt-1 sm:mt-2 border-t border-white/10 pt-1 sm:pt-2 w-full">
                      <div className="min-w-0">
                        <span className="text-[6px] sm:text-[10px] text-white/40 block truncate">BATTLE</span>
                        <span className="text-[3vw] sm:text-base font-bold text-cyan-400 block truncate">{wave}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[6px] sm:text-[10px] text-white/40 block truncate">METEORS</span>
                        <span className="text-[3vw] sm:text-base font-bold text-purple-400 block truncate">{playerState.meteorsHit}</span>
                      </div>
                    </div>
                </div>
                
                <div className="flex gap-1 ml-1">
                   {Array.from({ length: playerState.rocketCount }).map((_, i) => (
                      <div key={i} className="w-4 h-4 sm:w-6 sm:h-6 bg-orange-500/20 border border-orange-500/40 flex items-center justify-center animate-in zoom-in duration-300">
                        <Rocket className="w-2 h-2 sm:w-3 sm:h-3 text-orange-400" />
                      </div>
                   ))}
                </div>
             </div>

             <div className="flex flex-col items-end gap-2 sm:gap-3 max-w-[45%] md:max-w-xs">
                <div className="stat-card w-full neon-border p-2 sm:p-4 text-left">
                    <div className="flex justify-between items-center mb-1 sm:mb-1.5 px-0.5 sm:px-1">
                        <span className="text-[6px] sm:text-[10px] font-black tracking-widest text-white/60 flex items-center gap-1 sm:gap-2 italic uppercase truncate"><Activity className="w-2 h-2 sm:w-3 sm:h-3 text-red-500 shrink-0" /> <span className="hidden sm:inline">Hull Status</span><span className="sm:hidden">HULL</span></span>
                        <span className="text-[3.5vw] sm:text-sm font-black text-white shrink-0 ml-1">{Math.max(0, Math.floor(playerState.health))}%</span>
                    </div>
                    <div className="w-full h-1.5 sm:h-2 bg-black border border-white/10 overflow-hidden">
                       <div 
                         className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-green-500 transition-all duration-300"
                         style={{ width: `${Math.max(0, playerState.health)}%` }}
                       />
                    </div>
                </div>

                {playerState.isShielded && (
                  <div className="stat-card w-full border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.2)] animate-pulse p-2 sm:p-4 text-left">
                      <div className="flex justify-between items-center mb-1 sm:mb-1.5 px-0.5 sm:px-1 text-cyan-400">
                          <span className="text-[6px] sm:text-[10px] font-black tracking-widest flex items-center gap-1 sm:gap-2 italic uppercase truncate"><Shield className="w-2 h-2 sm:w-3 sm:h-3 shrink-0" /> <span className="hidden sm:inline">Energy Shield</span><span className="sm:hidden">SHIELD</span></span>
                          <span className="text-[3.5vw] sm:text-sm font-black shrink-0 ml-1">{Math.max(0, Math.floor(playerState.energy))}%</span>
                      </div>
                      <div className="w-full h-1.5 sm:h-2 bg-cyan-950/40 border border-cyan-500/40 overflow-hidden">
                         <div className="h-full bg-cyan-400"
                           style={{ width: `${Math.max(0, playerState.energy)}%` }}
                         />
                      </div>
                  </div>
                )}

                <div className="flex gap-1.5 sm:gap-2 mt-1 sm:mt-4">
                   <button 
                    onClick={togglePause}
                    className="stat-card px-2 py-1.5 sm:px-4 sm:py-2 hover:bg-white/10 pointer-events-auto transition-colors flex items-center gap-1 sm:gap-2 text-[8px] sm:text-xs font-bold uppercase tracking-widest text-white/80"
                   >
                    <Pause className="w-2 h-2 sm:w-3 sm:h-3" /> PAUSE
                   </button>
                   <button 
                    onClick={() => {
                       engineRef.current?.stop();
                       setIsPlaying(false);
                       setGameOver(false);
                    }}
                    className="stat-card px-2 py-1.5 sm:px-4 sm:py-2 hover:bg-red-500/20 pointer-events-auto transition-colors flex items-center gap-1 sm:gap-2 text-[8px] sm:text-xs font-bold uppercase tracking-widest text-red-500 border-red-500/20"
                   >
                    <SquareTerminal className="w-2 h-2 sm:w-3 sm:h-3" /> EXIT
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* Boss Health */}
        {isPlaying && playerState.bossHealthPct > 0 && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[80vw] max-w-2xl animate-in slide-in-from-top-8 duration-500">
                <div className="text-[10px] font-black text-red-500 text-center mb-1 tracking-[0.4em] uppercase">ENEMY COMMANDER DETECTED</div>
                <div className="w-full h-4 bg-black border-2 border-red-900 overflow-hidden rounded-none shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                     <div 
                        className="h-full bg-gradient-to-r from-red-800 to-red-500 transition-all duration-300 relative"
                        style={{ width: `${Math.max(0, playerState.bossHealthPct * 100)}%` }}
                     >
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 animate-pulse" />
                     </div>
                </div>
            </div>
        )}

        {/* Home Screen */}
        {!isPlaying && !gameOver && (
          <div className="absolute inset-0 pointer-events-auto overflow-y-auto text-center px-4">
             <div className="min-h-full flex flex-col items-center justify-center py-12 md:py-20 relative z-10 w-full">
                 <div className="transition-all duration-700 ease-in-out flex flex-col items-center scale-100 translate-y-0 mb-6 md:mb-10 w-full max-w-4xl">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-6 bg-cyan-500/10 border border-cyan-500/20 px-2 md:px-4 py-1.5 md:py-2 rounded-full max-w-[90%]">
                        <Radar className="w-3 h-3 md:w-4 md:h-4 text-cyan-400 animate-spin-slow shrink-0" />
                        <span className="text-[2.5vw] md:text-xs font-mono tracking-[0.2em] sm:tracking-[0.4em] text-cyan-400 uppercase truncate">Neural Link Established</span>
                    </div>

                    <h1 className="text-[12vw] sm:text-[10vw] md:text-[8rem] font-black tracking-tighter text-white uppercase leading-[0.9] mb-4 sm:mb-8 italic w-full text-center">
                        GALAXY <br className="sm:hidden" />
                        <span className="gradient-text drop-shadow-[0_0_30px_rgba(6,182,212,0.4)] sm:ml-4 pr-4 md:pr-8">
                            GUARDIAN
                        </span>
                    </h1>
                 </div>

             <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-6 w-full max-w-2xl mb-8 sm:mb-12 px-4">
                  <button 
                    onClick={() => startGame(1)}
                    className="stat-card py-4 sm:py-6 px-6 sm:px-10 flex flex-col items-center justify-center gap-1 sm:gap-2 group hover:bg-cyan-500 hover:border-cyan-400 transition-all hover:scale-105 w-full sm:w-1/2"
                  >
                    <span className="text-[10px] sm:text-xs font-black opacity-60 uppercase tracking-widest text-cyan-400 group-hover:text-white">Deployment</span>
                    <span className="text-2xl sm:text-4xl font-black italic uppercase">PATROL</span>
                  </button>
                  <button 
                    onClick={() => startGame(10)}
                    className="stat-card py-4 sm:py-6 px-6 sm:px-10 flex flex-col items-center justify-center gap-1 sm:gap-2 group hover:bg-red-500 hover:border-red-400 transition-all hover:scale-105 w-full sm:w-1/2"
                  >
                    <span className="text-[10px] sm:text-xs font-black opacity-60 uppercase tracking-widest text-red-500 group-hover:text-white">Deployment</span>
                    <span className="text-2xl sm:text-4xl font-black italic uppercase">BATTLE</span>
                  </button>
             </div>

             <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 max-w-3xl w-full animate-in slide-in-from-bottom-12 duration-700 pb-10 sm:pb-0">
                 {[
                   { icon: Zap, label: "WEAPONRY", desc: "WASD / SPACE / DRAG" },
                   { icon: Shield, label: "DEFENSE", desc: "FIND POWERUPS" },
                   { icon: Rocket, label: "MISSILES", desc: "X / 2-TAP" },
                   { icon: Info, label: "SYSTEM", desc: "ESC / PAUSE" }
                 ].map((item, i) => (
                    <div key={i} className="stat-card p-3 sm:p-4 md:p-6 flex flex-col items-center gap-1 sm:gap-2 group hover:bg-white/10 transition-colors">
                      <item.icon className="w-5 h-5 md:w-6 md:h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[8px] sm:text-[10px] font-black tracking-widest text-white/40">{item.label}</span>
                      <span className="text-[8px] sm:text-[10px] md:text-xs font-bold text-white uppercase text-center">{item.desc}</span>
                    </div>
                 ))}
             </div>
             </div>
          </div>
        )}

        {/* Game Over Screen */}
        {gameOver && (
          <div className="absolute inset-0 pointer-events-auto bg-black/90 backdrop-blur-3xl z-50 px-4 overflow-y-auto">
             <div className="min-h-full flex flex-col items-center justify-center py-16 md:py-24">
                 <div className="max-w-2xl w-full flex flex-col items-center animate-in zoom-in duration-500">
                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 mb-4 text-red-500 w-full justify-center px-2">
                    <Activity className="w-6 h-6 sm:w-8 sm:h-8 animate-pulse shrink-0" />
                    <span className="text-[clamp(0.8rem,4vw,1.5rem)] font-black tracking-[0.2em] sm:tracking-[0.5em] uppercase italic text-center px-2">Critical Hull Failure</span>
                </div>
                
                <h2 className="text-[clamp(1.2rem,6vw,2.5rem)] font-black tracking-tighter text-white uppercase mb-4 sm:mb-8 opacity-40 text-center px-4">DESTINY SEALED</h2>
                
                <div className="text-[clamp(3rem,15vw,8rem)] font-black gradient-text leading-none mb-6 italic tracking-tighter w-full text-center px-4 max-w-full overflow-hidden text-ellipsis">
                   {playerState.score.toLocaleString()}
                </div>
                
                <div className="flex gap-8 mb-12">
                   <div className="text-center">
                       <div className="text-[10px] font-black text-white/40 tracking-widest">BATTLE</div>
                       <div className="text-3xl font-black italic text-cyan-400">{wave}</div>
                   </div>
                   <div className="text-center">
                       <div className="text-[10px] font-black text-white/40 tracking-widest">NEUTRALIZATIONS</div>
                       <div className="text-3xl font-black italic text-purple-400">{playerState.meteorsHit}</div>
                   </div>
                </div>

                <div className="w-full stat-card border-none bg-white/[0.03] p-4 sm:p-8 mb-6 sm:mb-12 text-center flex flex-col items-center">
                   <div className="text-[8px] sm:text-[10px] font-black text-red-500 mb-2 sm:mb-3 flex items-center justify-center gap-2 tracking-widest text-center">
                       COMMANDER TRANSMISSION
                   </div>
                   <p className="text-white/90 font-serif text-sm sm:text-xl italic leading-relaxed text-balance text-center">
                     "{commanderMsg}"
                   </p>
                </div>

                <div className="flex flex-col items-center gap-2 sm:gap-4 w-full">
                    <button 
                      onClick={() => {
                          setGameOver(false);
                      }}
                      className="btn-primary text-lg sm:text-2xl !py-4 sm:!py-6 w-full sm:w-auto px-12"
                    >
                      REDEPLOY VESSEL
                    </button>
                    <button 
                      onClick={() => setGameOver(false)}
                      className="text-[10px] sm:text-xs font-black text-white/30 hover:text-white transition-colors tracking-[0.2em] sm:tracking-[0.4em] mt-4 sm:mt-6 text-center"
                    >
                      RETURN TO COMMAND
                    </button>
                </div>
             </div>
          </div>
          </div>
        )}

      </div>
    </div>
  );
}
