'use client';

import { useRef, useState } from 'react';
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
  const turnstileRef = useRef<string>("");
  const idempotencyKey = useRef(uuidv4()).current; // Generate once per component instance

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

  return (
    <div className={className}>
      <Turnstile
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
        onVerify={handleSuccess}
        onError={handleError}
        onExpire={handleExpire}
        theme={theme}
        size={size}
      />
    </div>
  );
}