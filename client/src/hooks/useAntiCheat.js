import { useEffect, useState, useCallback, useRef } from 'react';

export function useAntiCheat(maxStrikes = 3, onTerminate, storageKey) {
  const [strikes, setStrikes] = useState(() => {
    if (!storageKey) return 0;
    const saved = localStorage.getItem(storageKey);
    return saved ? parseInt(saved, 10) : 0;
  });

  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [isWarningActive, setIsWarningActive] = useState(false);

  // The anti-cheat monitoring must only start logging strikes AFTER the student enters fullscreen
  const isArmedRef = useRef(false);

  const registerStrike = useCallback(() => {
    // If test hasn't officially started in fullscreen yet, ignore violations
    if (!isArmedRef.current) return;

    setStrikes((prev) => {
      const next = prev + 1;
      if (storageKey) {
        localStorage.setItem(storageKey, next.toString());
      }
      setIsWarningActive(true);

      if (next >= maxStrikes && onTerminate) {
        onTerminate(next);
      }
      return next;
    });
  }, [maxStrikes, onTerminate, storageKey]);

  const requestFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
      setIsWarningActive(false);
      // Arm the monitor only after explicit user interaction
      isArmedRef.current = true;
    } catch (err) {
      console.error('Fullscreen request failed:', err);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const inFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(inFullscreen);

      // Only penalize if the assessment was armed and student exits fullscreen
      if (!inFullscreen && isArmedRef.current) {
        registerStrike();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && isArmedRef.current) {
        registerStrike();
      }
    };

    const handleBlur = () => {
      if (isArmedRef.current) {
        registerStrike();
      }
    };

    const handleContextMenu = (e) => e.preventDefault();
    const handleCopyPaste = (e) => e.preventDefault();

    // Trap browser back/forward buttons
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      if (isArmedRef.current) {
        registerStrike();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [registerStrike]);

  return {
    strikes,
    isFullscreen,
    isWarningActive,
    requestFullscreen,
  };
}