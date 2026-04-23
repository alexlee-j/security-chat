import { expect, test } from '@playwright/test';

test('desktop voice call smoke: two local peers complete WebRTC audio negotiation', async ({ page }) => {
  await page.goto('about:blank');

  const result = await page.evaluate(async () => {
    const caller = new RTCPeerConnection({ iceServers: [] });
    const callee = new RTCPeerConnection({ iceServers: [] });
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const destination = audioContext.createMediaStreamDestination();
    oscillator.connect(destination);
    oscillator.start();

    const remoteTracks: string[] = [];
    const cleanup = (): void => {
      oscillator.stop();
      destination.stream.getTracks().forEach((track) => track.stop());
      void audioContext.close();
      caller.close();
      callee.close();
    };

    try {
      caller.onicecandidate = (event) => {
        if (event.candidate) {
          void callee.addIceCandidate(event.candidate);
        }
      };
      callee.onicecandidate = (event) => {
        if (event.candidate) {
          void caller.addIceCandidate(event.candidate);
        }
      };
      callee.ontrack = (event) => {
        remoteTracks.push(event.track.kind);
      };

      for (const track of destination.stream.getAudioTracks()) {
        caller.addTrack(track, destination.stream);
      }

      const offer = await caller.createOffer({ offerToReceiveAudio: true });
      await caller.setLocalDescription(offer);
      await callee.setRemoteDescription(offer);
      const answer = await callee.createAnswer();
      await callee.setLocalDescription(answer);
      await caller.setRemoteDescription(answer);

      await new Promise<void>((resolve, reject) => {
        const deadline = window.setTimeout(() => reject(new Error('WebRTC local audio negotiation timed out')), 5000);
        const timer = window.setInterval(() => {
          if (
            remoteTracks.includes('audio') &&
            ['connected', 'completed'].includes(caller.iceConnectionState) &&
            ['connected', 'completed'].includes(callee.iceConnectionState)
          ) {
            window.clearTimeout(deadline);
            window.clearInterval(timer);
            resolve();
          }
        }, 50);
      });

      return {
        callerIceState: caller.iceConnectionState,
        calleeIceState: callee.iceConnectionState,
        remoteTracks,
      };
    } finally {
      cleanup();
    }
  });

  expect(result.remoteTracks).toContain('audio');
  expect(['connected', 'completed']).toContain(result.callerIceState);
  expect(['connected', 'completed']).toContain(result.calleeIceState);
});
