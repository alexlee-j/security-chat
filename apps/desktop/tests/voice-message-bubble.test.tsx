import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageBubble } from '../src/features/chat/message-bubble';

const loadingHtml = renderToStaticMarkup(
  <MessageBubble
    type="in"
    messageType={3}
    content=""
    time="10:00"
    voiceDuration="0:02"
    voiceState="loading"
  />,
);

assert.match(loadingHtml, /加载中/);
assert.match(loadingHtml, /voice-state-loading/);

const playingHtml = renderToStaticMarkup(
  <MessageBubble
    type="in"
    messageType={3}
    content=""
    time="10:00"
    voiceDuration="0:02"
    voiceState="playing"
  />,
);

assert.match(playingHtml, /voice-state-playing/);
assert.match(playingHtml, /暂停语音/);
assert.match(playingHtml, /pause/);

const pausedHtml = renderToStaticMarkup(
  <MessageBubble
    type="in"
    messageType={3}
    content=""
    time="10:00"
    voiceDuration="0:02"
    voiceState="paused"
  />,
);

assert.match(pausedHtml, /voice-state-paused/);
assert.match(pausedHtml, /继续播放语音/);
assert.match(pausedHtml, /play_arrow/);

const errorHtml = renderToStaticMarkup(
  <MessageBubble
    type="in"
    messageType={3}
    content=""
    time="10:00"
    mediaError="decrypt_failed"
  />,
);

assert.match(errorHtml, /解密失败/);

const waveformHtml = renderToStaticMarkup(
  <MessageBubble
    type="in"
    messageType={3}
    content=""
    time="10:00"
    voiceDuration="0:05"
    voiceState="ready"
    voiceWaveform={[4, 8, 16, 24, 16, 8, 4, 12, 20, 28, 20, 12, 4, 8, 16, 24]}
  />,
);

assert.match(waveformHtml, /voice-waveform-container/);
assert.ok(waveformHtml.includes('voice-waveform-bar'), 'waveform bars should be rendered');

const progressHtml = renderToStaticMarkup(
  <MessageBubble
    type="out"
    messageType={3}
    content=""
    time="10:00"
    voiceDuration="0:08"
    voiceState="ready"
    voiceWaveform={[4, 8, 16, 24, 16, 8, 4]}
    voicePlaybackProgress={0.5}
  />,
);

assert.match(progressHtml, /played/);

console.log('voice message bubble ok');
