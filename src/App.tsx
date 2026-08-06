import { useEffect } from 'react';
import { useGame } from './hooks/useGame';
import { sfx, setMuted } from './utils/sound';
import TitleScreen from './components/TitleScreen';
import GameScreen from './components/GameScreen';
import SummaryScreen from './components/SummaryScreen';

export default function App() {
  const { game, currentEvent, feedback, skippedEvents, autoPlay, typeSpeed, saves, achievements, stats, newAchievements, fateEventIds, daily, dailyHistory, seedScores, family, shuffleSeed, startGame, startAutoGame, startDailyGame, restart, makeChoice, continue: continue_, continueGame, reset, setTypeSpeed } = useGame();

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
    // 全屏径向渐变背景；三个阶段均为全屏流式布局（无舞台框/缩放），窄屏由各自组件响应式适配
    <div className="w-screen h-screen flex justify-center items-center bg-[radial-gradient(ellipse_at_center,#1a1a30_0%,#0a0a14_70%)] overflow-hidden">
      <div className="w-full h-full text-white">
        {game.phase === 'title' && (
          <TitleScreen onStart={startGame} onAutoStart={startAutoGame} onDailyStart={startDailyGame} saves={saves} onContinue={continueGame} achievements={achievements} stats={stats} daily={daily} dailyHistory={dailyHistory} seedScores={seedScores} family={family} />
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
          <SummaryScreen
            game={game}
            onRestart={reset}
            newAchievements={newAchievements}
            skippedTitles={[...new Set(skippedEvents.map(e => e.title ?? e.id))]}
            generation={family.length > 0 ? family[family.length - 1].generation : null}
            seed={shuffleSeed}
            collectedEndings={Object.keys(stats.endings)}
          />
        )}
      </div>
    </div>
  );
}
