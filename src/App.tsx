import { useEffect } from 'react';
import { useGame } from './hooks/useGame';
import { sfx } from './utils/sound';
import TitleScreen from './components/TitleScreen';
import GameScreen from './components/GameScreen';
import SummaryScreen from './components/SummaryScreen';

export default function App() {
  const { game, currentEvent, feedback, hasSave, startGame, makeChoice, continue: continue_, continueGame, reset } = useGame();

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
          <TitleScreen onStart={startGame} hasSave={hasSave} onContinue={continueGame} />
        )}
        {game.phase === 'playing' && (
          <GameScreen
            game={game}
            currentEvent={currentEvent}
            feedback={feedback}
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
