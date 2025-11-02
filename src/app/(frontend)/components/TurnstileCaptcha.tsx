'use client';

import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Turnstile } from 'next-turnstile';
import { v4 as uuidv4 } from 'uuid';

export type TurnstileStatus = 'success' | 'error' | 'expired' | 'required';

export interface TurnstileCaptchaProps {
  onVerify?: (token: string, idempotencyKey: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  className?: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
}

export interface TurnstileCaptchaRef {
  reset: () => void;
}

const TurnstileCaptcha = forwardRef<TurnstileCaptchaRef, TurnstileCaptchaProps>(({
  onVerify,
  onError,
  onExpire,
  className = '',
  theme = 'auto',
  size = 'normal',
}, ref) => {
  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileStatus>('required');
  const [siteKey, setSiteKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const turnstileRef = useRef<string>("");
  const widgetId = useRef<string>(`turnstile-${uuidv4()}`).current; // Unique widget ID
  const idempotencyKey = useRef(uuidv4()).current; // Generate once per component instance

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();
        setSiteKey(data.turnstileSiteKey);
      } catch (error) {
        console.error('Failed to load Turnstile configuration:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchConfig();
  }, []);

  const handleSuccess = (token: string) => {
    turnstileRef.current = token;
    setTurnstileStatus('success');
    if (onVerify) {
      onVerify(token, idempotencyKey);
    }
  };

  const handleError = () => {
    setTurnstileStatus('error');
    if (onError) {
      onError();
    }
  };

  const handleExpire = () => {
    setTurnstileStatus('expired');
    if (onExpire) {
      onExpire();
    }
  };

  // Expose reset method to parent components via ref
  useImperativeHandle(ref, () => ({
    reset: () => {
      try {
        // Access the global turnstile object and reset the widget
        if (typeof window !== 'undefined' && (window as any).turnstile) {
          (window as any).turnstile.reset(widgetId);
          setTurnstileStatus('required');
          turnstileRef.current = '';
        }
      } catch (error) {
        console.error('Failed to reset Turnstile:', error);
      }
    },
  }));

  if (isLoading || !siteKey) {
    return <div className={className}>טוען בדיקת אבטחה...</div>;
  }

  return (
    <div className={className}>
      <Turnstile
        id={widgetId}
        siteKey={siteKey}
        onVerify={handleSuccess}
        onError={handleError}
        onExpire={handleExpire}
        theme={theme}
        size={size}
        language={'he'}
      />
    </div>
  );
});

TurnstileCaptcha.displayName = 'TurnstileCaptcha';

export default TurnstileCaptcha;
