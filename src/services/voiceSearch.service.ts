import Voice from '@react-native-voice/voice';
import { PermissionsAndroid, Platform } from 'react-native';

export interface VoiceServiceCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onPartialResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onError?: (errorMsg: string) => void;
}

export class VoiceSearchService {
  private static instance: VoiceSearchService | null = null;
  private callbacks: VoiceServiceCallbacks = {};

  private constructor() {
    Voice.onSpeechStart = this.handleSpeechStart.bind(this);
    Voice.onSpeechEnd = this.handleSpeechEnd.bind(this);
    Voice.onSpeechError = this.handleSpeechError.bind(this);
    Voice.onSpeechResults = this.handleSpeechResults.bind(this);
    Voice.onSpeechPartialResults = this.handleSpeechPartialResults.bind(this);
  }

  public static getInstance(): VoiceSearchService {
    if (!VoiceSearchService.instance) {
      VoiceSearchService.instance = new VoiceSearchService();
    }
    return VoiceSearchService.instance;
  }

  public setCallbacks(callbacks: VoiceServiceCallbacks) {
    this.callbacks = callbacks;
  }

  public async checkAvailability(): Promise<boolean> {
    try {
      const available = await Voice.isAvailable();
      return !!available;
    } catch (e) {
      return false;
    }
  }

  public async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'MovieApp needs access to your microphone to search movies by voice.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return false;
      }
    }
    return true;
  }

  public async start(locale = 'en-US'): Promise<void> {
    try {
      await Voice.start(locale);
    } catch (e) {
      this.handleSpeechError({ error: { message: (e as Error).message } });
    }
  }

  public async stop(): Promise<void> {
    try {
      await Voice.stop();
    } catch (e) {
      // Ignored
    }
  }

  public async cancel(): Promise<void> {
    try {
      await Voice.cancel();
    } catch (e) {
      // Ignored
    }
  }

  public async destroy(): Promise<void> {
    try {
      await Voice.destroy();
      Voice.removeAllListeners();
      VoiceSearchService.instance = null;
    } catch (e) {
      // Ignored
    }
  }

  private handleSpeechStart() {
    if (this.callbacks.onStart) {
      this.callbacks.onStart();
    }
  }

  private handleSpeechEnd() {
    if (this.callbacks.onEnd) {
      this.callbacks.onEnd();
    }
  }

  private handleSpeechError(e: { error?: { message?: string; code?: string } }) {
    if (this.callbacks.onError) {
      const msg = e.error?.message || 'Voice search failed';
      if (msg.includes('error 7') || msg.includes('7') || msg.includes('No match')) {
        this.callbacks.onError("Couldn't hear that. Please try again.");
      } else if (msg.includes('permission') || msg.includes('Permission')) {
        this.callbacks.onError('Microphone permission denied.');
      } else {
        this.callbacks.onError("Voice search isn't available right now.");
      }
    }
  }

  private handleSpeechResults(e: { value?: string[] }) {
    if (e.value && e.value.length > 0) {
      const finalVal = e.value[0].trim();
      if (this.callbacks.onFinalResult && finalVal) {
        this.callbacks.onFinalResult(finalVal);
      }
    }
  }

  private handleSpeechPartialResults(e: { value?: string[] }) {
    if (e.value && e.value.length > 0) {
      const partialVal = e.value[0].trim();
      if (this.callbacks.onPartialResult && partialVal) {
        this.callbacks.onPartialResult(partialVal);
      }
    }
  }
}
