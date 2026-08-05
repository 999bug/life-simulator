import { useEffect, useState } from 'react';
import { useGame } from './hooks/useGame';
import { sfx, setMuted } from './utils/sound';
import TitleScreen from './components/TitleScreen';
import GameScreen from './components/GameScreen';
import SummaryScreen from './components/SummaryScreen';

export default function App() {
  const { game, currentEvent, feedback, skippedEvents, autoPlay, typeSpeed, saves, achievements, stats, newAchievements, fateEventIds, daily, startGame, startAutoGame, startDailyGame, restart, makeChoice, continue: continue_, continueGame, reset, setTypeSpeed } = useGame();

  // 移动端适配：视口小于舞台逻辑尺寸时等比缩放（960×720 逻辑尺寸不变）
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => {
      const s = Math.min(window.innerWidth / 960, window.innerHeight / 720);
      setScale(s < 1 ? s : 1);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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

  // 结算页新成就解锁音
  useEffect(() => {
    if (game.phase === 'summary' && newAchievements.length > 0) {
      sfx.achievement();
    }
  }, [game.phase, newAchievements.length]);

  return (
    <div className="w-screen h-screen flex justify-center items-center bg-black overflow-hidden">
      <div className="w-full h-full max-w-[960px] max-h-[720px] relative overflow-hidden rounded-lg shadow-[0_0_80px_rgba(0,0,0,0.6)] text-white" style={{ transform: `scale(${scale})` }}>
        {game.phase === 'title' && (
          <TitleScreen onStart={startGame} onAutoStart={startAutoGame} onDailyStart={startDailyGame} saves={saves} onContinue={continueGame} achievements={achievements} stats={stats} daily={daily} />
        )}
        {game.phase === 'playing' && (
          <GameScreen
            game={game}
            currentEvent={currentEvent}
            feedback={feedback}
            autoPlay={autoPlay}
            typeSpeed={typeSpeed}
            fateEventIds={fateEventIds}
            onTypeSpeedChange={setTypeSpeed}
            onChoice={makeChoice}
            onContinue={continue_}
            onExit={reset}
            onRestart={restart}
          />
        )}
        {game.phase === 'summary' && (
          <SummaryScreen game={game} onRestart={reset} newAchievements={newAchievements} skippedEvents={skippedEvents} />
        )}
      </div>
    </div>
  );
}
