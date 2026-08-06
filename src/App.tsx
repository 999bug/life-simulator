import { useEffect, useState } from 'react';
import { useGame } from './hooks/useGame';
import { sfx, setMuted } from './utils/sound';
import TitleScreen from './components/TitleScreen';
import GameScreen from './components/GameScreen';
import SummaryScreen from './components/SummaryScreen';

export default function App() {
  const { game, currentEvent, feedback, skippedEvents, autoPlay, typeSpeed, saves, achievements, stats, newAchievements, fateEventIds, daily, family, isDaily, shuffleSeed, startGame, startAutoGame, startDailyGame, restart, makeChoice, continue: continue_, continueGame, reset, setTypeSpeed } = useGame();

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
    // 全屏径向渐变背景（与标题页同源），标题/对局阶段背景连续无边界
    <div className="w-screen h-screen flex justify-center items-center bg-[radial-gradient(ellipse_at_center,#1a1a30_0%,#0a0a14_70%)] overflow-hidden">
      {game.phase !== 'playing' ? (
        // 标题/结算页全屏：脱离 960×720 舞台框（无圆角/阴影/缩放），大屏小屏都用满视口（内部弹性布局+滚动兜底）
        <div className="w-full h-full text-white">
          {game.phase === 'title' && (
            <TitleScreen onStart={startGame} onAutoStart={startAutoGame} onDailyStart={startDailyGame} saves={saves} onContinue={continueGame} achievements={achievements} stats={stats} daily={daily} family={family} />
          )}
          {game.phase === 'summary' && (
            <SummaryScreen
              game={game}
              onRestart={reset}
              newAchievements={newAchievements}
              skippedEvents={skippedEvents}
              generation={!autoPlay && !isDaily && family.length > 0 ? family[family.length - 1].generation : null}
              seed={shuffleSeed}
            />
          )}
        </div>
      ) : (
        // 对局舞台固定 960×720：scale 公式以此逻辑尺寸为前提，流式尺寸会导致小窗口下二次缩小并裁切内容
        <div className="w-[960px] h-[720px] relative overflow-hidden text-white" style={{ transform: `scale(${scale})` }}>
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
        </div>
      )}
    </div>
  );
}
