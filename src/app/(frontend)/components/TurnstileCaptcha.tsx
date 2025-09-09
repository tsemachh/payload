'use client';

import { useRef, useState, useEffect } from 'react';
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

export default function TurnstileCaptcha({
  onVerify,
  onError,
  onExpire,
  className = '',
  theme = 'auto',
  size = 'normal',
}: TurnstileCaptchaProps) {
  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileStatus>('required');
  const [siteKey, setSiteKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const turnstileRef = useRef<string>("");
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

  if (isLoading || !siteKey) {
    return <div className={className}>Loading security check...</div>;
  }

  return (
    <div className={className}>
      <Turnstile
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
}
