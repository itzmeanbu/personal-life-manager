import { Link } from 'react-router-dom';
import { useHomeArrival } from './HomeArrivalProvider';
import { Button } from '../components/ui/Button';
import './home.css';

/**
 * Global overlays: Welcome Home + post-delay workout reminder.
 * Mounted once under AppShell so any screen can surface them.
 */
export function WelcomeOverlay() {
  const {
    welcomeVisible,
    dismissWelcome,
    workoutPromptVisible,
    dismissWorkoutPrompt,
    lateCancelMessage,
    config,
  } = useHomeArrival();

  if (!welcomeVisible && !workoutPromptVisible && !lateCancelMessage) return null;

  return (
    <div className="home-overlay-stack">
      {welcomeVisible && (
        <div className="home-overlay home-overlay--welcome" role="status">
          <div className="home-overlay__title">Welcome Home</div>
          <p className="home-overlay__body">
            {config.workoutAutomationEnabled
              ? `Workout check in ${config.postArrivalDelayMinutes} min (if still applicable).`
              : 'Home arrival recorded.'}
          </p>
          <Button variant="primary" onClick={dismissWelcome}>
            OK
          </Button>
        </div>
      )}

      {lateCancelMessage && !welcomeVisible && (
        <div className="home-overlay home-overlay--late" role="status">
          <div className="home-overlay__title">Workout cancelled</div>
          <p className="home-overlay__body">{lateCancelMessage}</p>
          <p className="home-overlay__hint">
            Not marked completed.
            {config.allowManualOverrideAfterLateCancel
              ? ' You can still start manually from Workout if you want.'
              : ''}
          </p>
          <Link to="/workout" onClick={() => dismissWelcome()}>
            <Button variant="secondary">Open Workout</Button>
          </Link>
        </div>
      )}

      {workoutPromptVisible && (
        <div className="home-overlay home-overlay--workout" role="status">
          <div className="home-overlay__title">Workout time?</div>
          <p className="home-overlay__body">
            Suggested times:{' '}
            {config.workoutTimes.length ? config.workoutTimes.join(' · ') : 'none set'}
          </p>
          <div className="home-overlay__actions">
            <Link to="/workout" onClick={dismissWorkoutPrompt}>
              <Button variant="primary">START</Button>
            </Link>
            <Button variant="secondary" onClick={dismissWorkoutPrompt}>
              SKIP TODAY
            </Button>
            <Button variant="ghost" onClick={dismissWorkoutPrompt}>
              Later
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
