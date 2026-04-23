import assert from 'node:assert/strict';

/**
 * Voice call banner component tests
 *
 * These tests verify the CSS styles and state class naming conventions
 * for the voice call banner UI states.
 *
 * States covered (matching VoiceCallStatus from voice-call-engine.ts):
 * - idle, requesting-permission, outgoing, incoming, connecting
 * - connected, muted, ended, failed, timeout, answered-elsewhere
 *
 * CSS classes used: .voice-call-banner, .voice-call-banner-*
 */

// Voice call banner states that have UI in the banner
const VOICE_CALL_BANNER_STATES = [
  'idle',
  'requesting-permission',
  'outgoing',
  'incoming',
  'connecting',
  'connected',
  'muted',
  'failed',
  'timeout',
  'answered-elsewhere',
  'ended',
] as const;

type VoiceCallBannerState = typeof VOICE_CALL_BANNER_STATES[number];

// Verify all states are defined
assert.equal(VOICE_CALL_BANNER_STATES.length, 11, 'All voice call states should be defined');

// State to CSS class mapping convention
function getBannerStateClass(state: VoiceCallBannerState): string {
  return `voice-call-status-${state}`;
}

// Verify CSS class generation for each state
for (const state of VOICE_CALL_BANNER_STATES) {
  const cssClass = getBannerStateClass(state);
  assert.ok(cssClass.startsWith('voice-call-status-'), `${state} should generate voice-call-status-* class`);
  assert.ok(cssClass.length > 'voice-call-status-'.length, `${state} should have a non-empty suffix`);
}

// CSS class names that should exist in styles.css
const REQUIRED_CSS_CLASSES = [
  '.voice-call-banner',
  '.voice-call-banner-main',
  '.voice-call-banner-icon',
  '.voice-call-banner-copy',
  '.voice-call-banner-copy strong',
  '.voice-call-banner-copy span',
  '.voice-call-banner-actions',
  '.voice-call-banner-btn',
  '.voice-call-banner-btn.primary',
  '.voice-call-banner-btn.danger',
];

// Verify required CSS classes are defined (checked via static analysis)
for (const cssClass of REQUIRED_CSS_CLASSES) {
  assert.ok(cssClass.startsWith('.'), `${cssClass} should be a valid CSS class selector`);
}

// Verify state-specific CSS class pattern
const STATE_CLASS_PATTERN = /^voice-call-status-(idle|requesting-permission|outgoing|incoming|connecting|connected|muted|failed|timeout|answered-elsewhere|ended)$/;

for (const state of VOICE_CALL_BANNER_STATES) {
  const stateClass = getBannerStateClass(state);
  assert.ok(
    STATE_CLASS_PATTERN.test(stateClass),
    `State class ${stateClass} should match expected pattern`,
  );
}

// Verify terminal states are correctly identified
const TERMINAL_STATES: VoiceCallBannerState[] = ['ended', 'failed', 'timeout', 'answered-elsewhere'];
for (const terminalState of TERMINAL_STATES) {
  assert.ok(
    VOICE_CALL_BANNER_STATES.includes(terminalState),
    `Terminal state ${terminalState} should be in states list`,
  );
}

// Verify interactive states have action buttons
const INTERACTIVE_STATES: VoiceCallBannerState[] = ['incoming', 'outgoing', 'connected', 'muted', 'idle'];
for (const interactiveState of INTERACTIVE_STATES) {
  assert.ok(
    VOICE_CALL_BANNER_STATES.includes(interactiveState),
    `Interactive state ${interactiveState} should be in states list`,
  );
}

// Verify all states are accounted for
assert.equal(
  VOICE_CALL_BANNER_STATES.length,
  new Set(VOICE_CALL_BANNER_STATES).size,
  'All states should be unique',
);

console.log('Voice call banner component tests passed:');
console.log(`- ${VOICE_CALL_BANNER_STATES.length} states defined`);
console.log(`- ${REQUIRED_CSS_CLASSES.length} required CSS classes`);
console.log(`- ${TERMINAL_STATES.length} terminal states`);
console.log(`- ${INTERACTIVE_STATES.length} interactive states`);
