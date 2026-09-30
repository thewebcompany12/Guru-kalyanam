'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible || !promptEvent) return null;

  const install = async () => {
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
    setVisible(false);
  };

  return (
    <div className="install-prompt" role="status" aria-live="polite">
      <div>
        <strong>Install School Supply Ops</strong>
        <span>Add the app to your home screen for faster field access.</span>
      </div>
      <div className="install-actions">
        <button type="button" onClick={install} className="install-primary">Install</button>
        <button type="button" onClick={() => setVisible(false)} className="install-secondary">Later</button>
      </div>
    </div>
  );
}
