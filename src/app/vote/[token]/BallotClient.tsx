'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Team } from '@/lib/voting';
import { BallotForm } from '@/components/BallotForm';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { VerifyNotice } from '@/components/VerifyNotice';
import { collectDeviceSignal } from '@/lib/deviceSignal';
import { postVote } from '@/lib/submitVote';

export function BallotClient({
  token,
  teams,
  siteKey,
}: {
  token: string;
  teams: Team[];
  siteKey: string;
}) {
  const router = useRouter();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [verifyStuck, setVerifyStuck] = useState(false);
  const deviceSignal = useRef<Promise<string | null> | null>(null);

  return (
    <BallotForm
      teams={teams}
      canSubmit={turnstileToken !== null}
      footerExtra={
        <>
          <TurnstileWidget
            siteKey={siteKey}
            onToken={(t) => {
              setTurnstileToken(t);
              if (t) setVerifyStuck(false);
            }}
            onError={() => setVerifyStuck(true)}
            resetSignal={resetSignal}
          />
          {verifyStuck && turnstileToken === null && (
            <VerifyNotice onReload={() => window.location.reload()} />
          )}
        </>
      }
      submit={async (teamId) => {
        deviceSignal.current ??= collectDeviceSignal();
        return postVote({
          token,
          teamId,
          turnstileToken: turnstileToken ?? '',
          deviceSignal: await deviceSignal.current,
        });
      }}
      onSubmitFailed={() => setResetSignal((n) => n + 1)}
      onVoted={() => router.replace('/thanks')}
    />
  );
}
