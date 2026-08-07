import { useCallback, useEffect, useState } from 'react';
import { useGame } from './hooks/useGame';
import { sfx, setMuted } from './utils/sound';
import TitleScreen from './components/TitleScreen';
import GameScreen from './components/GameScreen';
import SummaryScreen from './components/SummaryScreen';
import InstallPrompt from './components/InstallPrompt';
import { loadInheritTalent } from './engine/talents';

/** 主题（全局）：深空蓝（默认）/ 纯黑 */
export type Theme = 'dark' | 'black';

/** 主题存储 key */
const THEME_KEY = 'life-sim-theme';

/** 读取主题；存储不可用时回退深空蓝 */
function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'black' ? 'black' : 'dark';
  } catch {
    return 'dark';
  }
}

export default function App() {
  const { game, currentEvent, feedback, skippedEvents, autoPlay, introAuto, typeSpeed, saves, achievements, stats, newAchievements, fateEventIds, isDaily, isWeekly, weeklyGoal, daily, dailyHistory, weekly, seedScores, family, shuffleSeed, startGame, startAutoGame, startDailyGame, startWeeklyGame, restart, reincarnate, makeChoice, makeAction, skipIntro, undo, undoToAge, undoStack, continue: continue_, continueGame, reset, setTypeSpeed } = useGame();

  // 主动行动：选择活动后触发引擎 MAKE_ACTION（结果由反馈页展示；不推进年龄、不进 history）
  const handleAction = useCallback((activityId: string) => {
    makeAction(activityId);
  }, [makeAction]);

  // 主题切换（纯黑/深空蓝；持久化到 localStorage）
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const toggleTheme = () => {
    sfx.select();
    const next = theme === 'dark' ? 'black' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // 存储不可用静默降级
    }
  };

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
    // 全屏径向渐变背景（主题可切换：深空蓝 / 纯黑）；三个阶段均为全屏流式布局（无舞台框/缩放），窄屏由各自组件响应式适配
    <div className={`w-screen h-screen flex justify-center items-center overflow-hidden ${theme === 'dark'
      ? 'bg-[radial-gradient(ellipse_at_center,#1a1a30_0%,#0a0a14_70%)]'
      : 'bg-[radial-gradient(ellipse_at_center,#1a1a1a_0%,#000000_70%)]'}`}>
      <div className="w-full h-full text-white">
        {game.phase === 'title' && (
          <>
            <TitleScreen onStart={startGame} onAutoStart={startAutoGame} onDailyStart={startDailyGame} onWeeklyStart={startWeeklyGame} saves={saves} onContinue={continueGame} achievements={achievements} stats={stats} daily={daily} dailyHistory={dailyHistory} weekly={weekly} weeklyGoal={weeklyGoal} seedScores={seedScores} family={family} theme={theme} onToggleTheme={toggleTheme} />
            {/* PWA 安装引导（仅标题页；Android/Chrome 系首次访问展示一次） */}
            <InstallPrompt />
          </>
        )}
        {game.phase === 'playing' && (
          <GameScreen
            game={game}
            currentEvent={currentEvent}
            feedback={feedback}
            autoPlay={autoPlay}
            typeSpeed={typeSpeed}
            fateEventIds={fateEventIds}
            isWeekly={isWeekly}
            weeklyGoal={weeklyGoal}
            undoStack={undoStack}
            onUndo={undo}
            onUndoToAge={undoToAge}
            onTypeSpeedChange={setTypeSpeed}
            onChoice={makeChoice}
            onContinue={continue_}
            onExit={reset}
            onRestart={restart}
            onAction={handleAction}
            actionsDone={game.actionsDone ?? []}
            introAuto={introAuto}
            onSkipIntro={skipIntro}
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
            isDaily={isDaily}
            isWeekly={isWeekly}
            weeklyGoal={weeklyGoal}
            totalLives={stats.totalLives}
            onReincarnate={reincarnate}
            inheritTalent={loadInheritTalent()}
          />
        )}
      </div>
    </div>
  );
}
