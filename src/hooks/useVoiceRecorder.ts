import { useState, useRef, useCallback, useEffect } from "react";

interface UseVoiceRecorderOptions {
  onTranscript: (text: string) => void;
  lang?: string;
}

export function useVoiceRecorder({ onTranscript, lang = "pt-BR" }: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef("");

  const isSupported = typeof window !== "undefined" && 
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("Seu navegador não suporta reconhecimento de voz. Use o Chrome.");
      return;
    }

    setError(null);
    transcriptRef.current = "";

    // Request microphone permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(t => t.stop());
    } catch (e) {
      setError("Permissão de microfone negada. Ative o microfone nas configurações do navegador.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      setIsTranscribing(false);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      
      transcriptRef.current = finalTranscript || interimTranscript;
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setError("Microfone bloqueado. Permita o acesso ao microfone.");
      } else if (event.error === "no-speech") {
        setError("Nenhuma fala detectada. Tente novamente.");
      } else if (event.error === "network") {
        setError("Erro de rede. Verifique sua conexão.");
      }
      setIsRecording(false);
      setIsTranscribing(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setIsTranscribing(false);
      
      // Deliver final transcript
      if (transcriptRef.current.trim()) {
        onTranscript(transcriptRef.current.trim());
        transcriptRef.current = "";
      }
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      setError("Erro ao iniciar gravação. Tente novamente.");
    }
  }, [isSupported, lang, onTranscript]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      setIsTranscribing(true);
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  return {
    isRecording,
    isTranscribing,
    isSupported,
    recordingSeconds,
    formattedTime: formatTime(recordingSeconds),
    error,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
