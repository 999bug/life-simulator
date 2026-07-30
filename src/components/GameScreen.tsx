import { useState, useCallback } from 'react';
import type { Choice, GameState, LifeEvent } from '../types';
import { STAGE_META } from '../engine/state';
import SceneArea from './SceneArea';
import StatusBar from './StatusBar';
import DialogBox from './DialogBox';
import ChoicePanel from './ChoicePanel';

interface Props {
  game: GameState;
  currentEvent: LifeEvent | null;
  feedback: string | null;
  onChoice: (choice: Choice) => void;
  onContinue: () => void;
}

export default function GameScreen({ game, currentEvent, feedback, onChoice, onContinue }: Props) {
  const [showChoices, setShowChoices] = useState(false);

  const handleDialogComplete = useCallback(() => {
    if (currentEvent && currentEvent.choices.length === 1 && currentEvent.choices[0].text === '……') {
      // 纯叙事事件，不显示选择
    } else {
      setShowChoices(true);
    }
  }, [currentEvent]);

  // 重置
  const prevEventIdRef = useCallback((id: string) => {
    setShowChoices(false);
  }, []);

  // 反馈页面
  if (feedback) {
    const stageMeta = STAGE_META[game.stage];
    return (
      <div className="w-full h-full relative">
        <SceneArea stage={game.stage} age={game.age} gender={game.gender} stageLabel={stageMeta.label} />
        <StatusBar attributes={game.attributes} />
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-b from-black/92 to-black/97
            backdrop-blur-xl border-t border-white/5 cursor-pointer z-10"
          onClick={onContinue}
        >
          <div className="px-7 py-5 text-center">
            <div className="text-lg text-[#c9a96e] whitespace-pre-line leading-relaxed">{feedback}</div>
            <div className="text-[11px] text-white/30 mt-3 animate-pulse">▼ 点击继续</div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentEvent) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white/40">
        没有更多事件了……
      </div>
    );
  }

  const stageMeta = STAGE_META[game.stage];
  const isAuto = currentEvent.choices.length === 1 && currentEvent.choices[0].text === '……';

  return (
    <div className="w-full h-full relative">
      {/* 场景 */}
      <SceneArea stage={game.stage} age={game.age} gender={game.gender} stageLabel={stageMeta.label} />

      {/* 状态栏 */}
      <StatusBar attributes={game.attributes} />

      {/* 底部区域 */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <DialogBox
          text={currentEvent.text}
          name={game.name}
          age={game.age}
          stage={stageMeta.label}
          autoAdvance={isAuto}
          onComplete={isAuto ? undefined : handleDialogComplete}
        />
        <ChoicePanel
          choices={isAuto ? [] : currentEvent.choices}
          onSelect={onChoice}
          visible={showChoices && !isAuto}
        />
      </div>
    </div>
  );
}
