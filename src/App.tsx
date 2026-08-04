import { useEffect } from 'react';
import { useGame } from './hooks/useGame';
import { sfx, setMuted } from './utils/sound';
import TitleScreen from './components/TitleScreen';
import GameScreen from './components/GameScreen';
import SummaryScreen from './components/SummaryScreen';

export default function App() {
  const { game, currentEvent, feedback, autoPlay, typeSpeed, saves, startGame, startAutoGame, makeChoice, continue: continue_, continueGame, reset, setTypeSpeed } = useGame();

  // 快速模拟模式静音高频交互音；结算页恢复（保留落幕音）
  useEffect(() => {
    setMuted(autoPlay && game.phase !== 'summary');
  }, [autoPlay, game.phase]);

  // 进入结算页播放落幕音
  useEffect(() => {
    if (game.phase === 'summary') {
      sfx.death();
    }
  }, [game.phase]);

  return (
    <div className="w-screen h-screen flex justify-center items-center bg-black overflow-hidden">
      <div className="w-full h-full max-w-[960px] max-h-[720px] relative overflow-hidden rounded-lg shadow-[0_0_80px_rgba(0,0,0,0.6)] text-white">
        {game.phase === 'title' && (
          <TitleScreen onStart={startGame} onAutoStart={startAutoGame} saves={saves} onContinue={continueGame} />
        )}
        {game.phase === 'playing' && (
          <GameScreen
            game={game}
            currentEvent={currentEvent}
            feedback={feedback}
            autoPlay={autoPlay}
            typeSpeed={typeSpeed}
            onTypeSpeedChange={setTypeSpeed}
            onChoice={makeChoice}
            onContinue={continue_}
          />
        )}
        {game.phase === 'summary' && (
          <SummaryScreen game={game} onRestart={reset} />
        )}
      </div>
    </div>
  );
}
