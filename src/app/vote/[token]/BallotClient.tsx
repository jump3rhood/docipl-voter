'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Team } from '@/lib/voting';
import { BallotForm } from '@/components/BallotForm';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { VerifyNotice } from '@/components/VerifyNotice';
import { VerifyProgress } from '@/components/VerifyProgress';
import { collectDeviceSignal } from '@/lib/deviceSignal';
import { markCelebrate } from '@/lib/celebrate';
import { postVote } from '@/lib/submitVote';
import { useVoterIdSync } from '@/lib/useVoterIdSync';

export function BallotClient({
  token,
  teams,
  siteKey,
  voterId,
  resultsPublic,
}: {
  token: string;
  teams: Team[];
  siteKey: string;
  voterId: string | null;
  resultsPublic: boolean;
}) {
  const router = useRouter();
  // Hold the vote until a cleared cookie has been restored from the localStorage backup.
  const voterIdReady = useVoterIdSync(voterId);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [verifyStuck, setVerifyStuck] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const deviceSignal = useRef<Promise<string | null> | null>(null);

  return (
    <BallotForm
      teams={teams}
      resultsPublic={resultsPublic}
      canSubmit={turnstileToken !== null && voterIdReady}
      footerExtra={
        <>
          {verifyStuck && turnstileToken === null ? (
            <VerifyNotice onReload={() => window.location.reload()} />
          ) : (
            <VerifyProgress verified={turnstileToken !== null} interactive={interactive} />
          )}
          <TurnstileWidget
            siteKey={siteKey}
            onToken={(t) => {
              setTurnstileToken(t);
              if (t) setVerifyStuck(false);
            }}
            onError={() => setVerifyStuck(true)}
            onInteractive={setInteractive}
            resetSignal={resetSignal}
          />
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
      onVoted={() => {
        markCelebrate();
        router.replace('/thanks');
      }}
    />
  );
}
