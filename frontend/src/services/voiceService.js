/**
 * OmniAI Voice Interaction Service
 * Provides Speech-to-Text (Voice Input) and Text-to-Speech (Voice Output)
 * using standard browser Web Speech and SpeechSynthesis APIs.
 *
 * Privacy Guarantees:
 * - Audio recordings are never uploaded to the OmniAI backend.
 * - Text-to-speech runs 100% locally via browser synthesis voices without paid third-party APIs.
 */

const VOICE_SETTINGS_KEY = 'omniai_voice_settings_v1';

export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English (United States)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'hi-IN', label: 'Hindi (भारत)' },
  { code: 'en-GB', label: 'English (United Kingdom)' },
  { code: 'es-ES', label: 'Spanish (Español)' },
  { code: 'fr-FR', label: 'French (Français)' },
  { code: 'de-DE', label: 'German (Deutsch)' },
];

/**
 * Strips Markdown formatting, code snippets, formulas, and URLs to ensure natural speech output.
 */
export function cleanTextForSpeech(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return '';

  let clean = markdownText;

  // Replace code blocks with a brief conversational notice
  clean = clean.replace(/```[\s\S]*?```/g, ' [Code block omitted from narration] ');

  // Replace inline code `code` with plain text
  clean = clean.replace(/`([^`]+)`/g, '$1');

  // Strip Markdown images and links: ![alt](url) -> alt, [text](url) -> text
  clean = clean.replace(/!\[(.*?)\]\(.*?\)/g, '$1');
  clean = clean.replace(/\[(.*?)\]\(.*?\)/g, '$1');

  // Strip LaTeX math blocks
  clean = clean.replace(/\$\$[\s\S]*?\$\$/g, ' [Math expression] ');
  clean = clean.replace(/\$([^\$]+)\$/g, '$1');

  // Strip headers (#, ##, ###)
  clean = clean.replace(/^#{1,6}\s+/gm, '');

  // Strip emphasis (bold/italic **text**, *text*, __text__, _text_)
  clean = clean.replace(/(\*\*|__)(.*?)\1/g, '$2');
  clean = clean.replace(/(\*|_)(.*?)\1/g, '$2');

  // Strip blockquotes (>)
  clean = clean.replace(/^>\s+/gm, '');

  // Strip horizontal rules
  clean = clean.replace(/^[-*_]{3,}\s*$/gm, '');

  // Strip HTML tags
  clean = clean.replace(/<[^>]+>/g, '');

  // Normalize bullet points and dashes
  clean = clean.replace(/^[-*+]\s+/gm, '');
  clean = clean.replace(/^\d+\.\s+/gm, '');

  // Collapse multiple whitespaces and newlines
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

/**
 * Splits text into natural sentence chunks to prevent browser speech synthesis timeouts.
 */
export function chunkTextForSpeech(text, maxChars = 180) {
  if (!text) return [];

  // Match sentence terminators (. ! ? \n)
  const rawSentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
  const chunks = [];
  let currentChunk = '';

  for (const sentence of rawSentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if ((currentChunk + ' ' + trimmed).length <= maxChars) {
      currentChunk = currentChunk ? `${currentChunk} ${trimmed}` : trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (trimmed.length > maxChars) {
        // Fallback split by comma or words
        const words = trimmed.split(' ');
        let subChunk = '';
        for (const w of words) {
          if ((subChunk + ' ' + w).length <= maxChars) {
            subChunk = subChunk ? `${subChunk} ${w}` : w;
          } else {
            if (subChunk) chunks.push(subChunk);
            subChunk = w;
          }
        }
        if (subChunk) chunks.push(subChunk);
        currentChunk = '';
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

class VoiceInteractionService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.currentUtterance = null;
    this.activeSpeakerMessageId = null;
    this.speechChunks = [];
    this.currentChunkIndex = 0;
    this.isPaused = false;
    this.playbackCallbacks = null;

    // Load persisted settings
    this.settings = this.loadSettings();
  }

  loadSettings() {
    if (typeof window === 'undefined') {
      return {
        inputLanguage: 'en-US',
        ttsEnabled: true,
        voiceURI: null,
        rate: 1.0,
        pitch: 1.0,
      };
    }
    try {
      const stored = localStorage.getItem(VOICE_SETTINGS_KEY);
      if (stored) {
        return {
          inputLanguage: 'en-US',
          ttsEnabled: true,
          voiceURI: null,
          rate: 1.0,
          pitch: 1.0,
          ...JSON.parse(stored),
        };
      }
    } catch (e) {
      console.warn('[OmniAI Voice] Failed to load voice settings:', e);
    }
    return {
      inputLanguage: 'en-US',
      ttsEnabled: true,
      voiceURI: null,
      rate: 1.0,
      pitch: 1.0,
    };
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(this.settings));
      } catch (e) {
        console.error('[OmniAI Voice] Failed to save voice settings:', e);
      }
    }
    return this.settings;
  }

  getSettings() {
    return { ...this.settings };
  }

  updateSettings(newSettings) {
    return this.saveSettings(newSettings);
  }

  // --------------------------------------------------------------------------
  // SPEECH-TO-TEXT (VOICE INPUT)
  // --------------------------------------------------------------------------

  isSpeechRecognitionSupported() {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Starts Speech Recognition session
   */
  startListening({ lang = null, onResult, onStateChange, onError } = {}) {
    if (!this.isSpeechRecognitionSupported()) {
      if (onError) onError('Speech recognition is not supported in this browser.');
      if (onStateChange) onStateChange('unsupported');
      return;
    }

    this.stopListening();

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionClass();

    const targetLang = lang || this.settings.inputLanguage || 'en-US';
    this.recognition.lang = targetLang;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    let finalTranscript = '';

    if (onStateChange) onStateChange('requesting_permission');

    this.recognition.onstart = () => {
      this.isListening = true;
      if (onStateChange) onStateChange('listening');
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart + ' ';
        } else {
          interimTranscript += transcriptPart;
        }
      }

      const combined = (finalTranscript + interimTranscript).trim();
      if (onResult) {
        onResult(combined, false);
      }
      if (onStateChange) onStateChange('transcribing');
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      const errorType = event.error;
      let userMsg = `Speech recognition error: ${errorType}`;

      if (errorType === 'not-allowed') {
        userMsg = 'Microphone permission was denied. Please allow microphone access in your browser settings.';
        if (onStateChange) onStateChange('permission_denied');
      } else if (errorType === 'no-speech') {
        userMsg = 'No speech was detected. Please try speaking again.';
        if (onStateChange) onStateChange('idle');
      } else if (errorType === 'audio-capture') {
        userMsg = 'No microphone was detected on this device.';
        if (onStateChange) onStateChange('unavailable');
      } else {
        if (onStateChange) onStateChange('error');
      }

      if (onError) onError(userMsg);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (onStateChange) onStateChange('complete');
    };

    try {
      this.recognition.start();
    } catch (err) {
      if (onError) onError(err.message || 'Failed to start microphone.');
      if (onStateChange) onStateChange('error');
    }
  }

  stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_) {}
      this.recognition = null;
    }
    this.isListening = false;
  }

  cancelListening() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }
    this.isListening = false;
  }

  // --------------------------------------------------------------------------
  // TEXT-TO-SPEECH (VOICE OUTPUT)
  // --------------------------------------------------------------------------

  isSpeechSynthesisSupported() {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  /**
   * Retrieves all installed synthesizer system voices
   */
  getVoices() {
    if (!this.isSpeechSynthesisSupported()) return [];
    return window.speechSynthesis.getVoices() || [];
  }

  /**
   * Reads assistant response aloud with chunked sentence management and controls
   */
  speak({
    messageId,
    text,
    voiceURI = null,
    rate = null,
    pitch = null,
    onStart = null,
    onPause = null,
    onResume = null,
    onEnd = null,
    onError = null,
  }) {
    if (!this.isSpeechSynthesisSupported()) {
      if (onError) onError('Speech synthesis is not supported on this browser.');
      return;
    }

    // If another response was speaking, stop it first
    this.stopSpeaking();

    const clean = cleanTextForSpeech(text);
    if (!clean) return;

    this.speechChunks = chunkTextForSpeech(clean);
    this.currentChunkIndex = 0;
    this.activeSpeakerMessageId = messageId;
    this.isPaused = false;
    this.playbackCallbacks = { onStart, onPause, onResume, onEnd, onError };

    if (onStart) onStart(messageId);

    this._speakNextChunk(voiceURI, rate, pitch);
  }

  _speakNextChunk(voiceURI = null, rate = null, pitch = null) {
    if (this.currentChunkIndex >= this.speechChunks.length) {
      const msgId = this.activeSpeakerMessageId;
      this.activeSpeakerMessageId = null;
      this.currentUtterance = null;
      if (this.playbackCallbacks?.onEnd) {
        this.playbackCallbacks.onEnd(msgId);
      }
      return;
    }

    const chunk = this.speechChunks[this.currentChunkIndex];
    const utterance = new SpeechSynthesisUtterance(chunk);

    // Apply voice settings
    const targetVoiceURI = voiceURI || this.settings.voiceURI;
    if (targetVoiceURI) {
      const voices = this.getVoices();
      const match = voices.find((v) => v.voiceURI === targetVoiceURI);
      if (match) utterance.voice = match;
    }

    utterance.rate = typeof rate === 'number' ? rate : this.settings.rate || 1.0;
    utterance.pitch = typeof pitch === 'number' ? pitch : this.settings.pitch || 1.0;

    utterance.onend = () => {
      this.currentChunkIndex += 1;
      this._speakNextChunk(voiceURI, rate, pitch);
    };

    utterance.onerror = (e) => {
      if (e.error === 'canceled' || e.error === 'interrupted') {
        return;
      }
      console.warn('[OmniAI Voice] Speech utterance error:', e);
      if (this.playbackCallbacks?.onError) {
        this.playbackCallbacks.onError(e.error || 'Speech synthesis error');
      }
      this.stopSpeaking();
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  pauseSpeaking() {
    if (this.isSpeechSynthesisSupported() && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      this.isPaused = true;
      if (this.playbackCallbacks?.onPause) {
        this.playbackCallbacks.onPause(this.activeSpeakerMessageId);
      }
    }
  }

  resumeSpeaking() {
    if (this.isSpeechSynthesisSupported() && this.isPaused) {
      window.speechSynthesis.resume();
      this.isPaused = false;
      if (this.playbackCallbacks?.onResume) {
        this.playbackCallbacks.onResume(this.activeSpeakerMessageId);
      }
    }
  }

  stopSpeaking() {
    if (this.isSpeechSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
    const prevId = this.activeSpeakerMessageId;
    this.activeSpeakerMessageId = null;
    this.currentUtterance = null;
    this.speechChunks = [];
    this.currentChunkIndex = 0;
    this.isPaused = false;
    if (prevId && this.playbackCallbacks?.onEnd) {
      this.playbackCallbacks.onEnd(prevId);
    }
  }

  getActiveSpeakerMessageId() {
    return this.activeSpeakerMessageId;
  }

  isSpeaking() {
    return Boolean(this.activeSpeakerMessageId);
  }
}

export const VoiceService = new VoiceInteractionService();
export default VoiceService;
