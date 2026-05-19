import React, { useEffect, useMemo, useRef } from "react";
import { produce, type Draft } from "immer";
import { Box, useInput } from "ink";
import { useImmerReducer } from "use-immer";

import { getAvailableModelOptions } from "../ai/provider-registry.js";
import {
  generateLiveQuestions as defaultGenerateLiveQuestions,
  generateResumeQuestions as defaultGenerateResumeQuestions,
  type InterviewQuestion,
} from "../ai/questions.js";
import {
  mapTranscriptDiffToConsoleEvents,
  mapWatchErrorToConsoleEvent,
  mapWatchStartedToConsoleEvent,
  mergeConsoleEvents,
} from "../conversation/console-events.js";
import type {
  ConsoleEvent,
  ConsoleStatus,
  ErrorConsoleEvent,
  SystemConsoleEvent,
  TranscriptConsoleEvent,
} from "../conversation/types.js";
import {
  DEFAULT_APP_SETTINGS,
  loadAppSettings as defaultLoadAppSettings,
  saveAppSettings as defaultSaveAppSettings,
  validateAppSettings,
  type ApiKeySettings,
  type AppSettings,
} from "../config/app-settings.js";
import {
  createNoopAppLogger,
  type AppLogger,
} from "../logging/app-log.js";
import type {
  GranolaEventSource,
  GranolaEventSourceCallbacks,
} from "../granola/event-source.js";
import { FULL_STACK_SYSTEM_PROMPT_DEFAULTS } from "../interview/default-system-prompts.js";
import {
  buildGranolaAnalysisPrompt,
  copyTextToTerminalClipboard,
  type CopyTextToClipboard,
} from "../interview/granola-analysis-prompt.js";
import {
  completeActiveSessions,
  createInterviewSession,
  loadInterviewSessions as defaultLoadInterviewSessions,
  saveInterviewSessions as defaultSaveInterviewSessions,
  type InterviewSession,
} from "../interview/interview-sessions.js";
import {
  createInterviewType,
  loadInterviewTypes as defaultLoadInterviewTypes,
  saveInterviewTypes as defaultSaveInterviewTypes,
  updateInterviewType,
  type InterviewType,
} from "../interview/interview-types.js";
import {
  apiKeyFields,
  editorFields,
  settingsSections,
} from "./chat-app-options.js";
import {
  draftFromDefaultSystemPrompt,
  draftFromInterviewType,
  draftToInterviewTypeInput,
  buildLiveGenerationPromptTranscriptText,
  getDefaultSystemPrompt,
  isLiveGenerationTranscriptEvent,
  isMissingFileError,
  isNextSelection,
  isPreviousSelection,
  nextIndex,
  onlyTranscriptEvents,
  previousIndex,
  updateDraftField,
} from "./chat-app-helpers.js";
import type {
  AiStatus,
  AppMode,
  EditorState,
  QuestionPanelMode,
  SettingsSection,
} from "./chat-app-types.js";
import {
  Dashboard,
  Header,
  LiveInterviewView,
  NewInterviewView,
  NoticeBanner,
  PastInterviewDetail,
  PastInterviewsView,
  SettingsView,
  StatusBanner,
} from "./chat-app-views.js";
import {
  chooseResumeFile as defaultChooseResumeFile,
  isResumePickerCancelError,
} from "./resume-picker.js";

const NO_INTERVIEW_TEMPLATES_MESSAGE =
  "No interview templates yet. Create one in Settings first.";
const noopAppLogger = createNoopAppLogger();

interface ChatAppProps {
  createEventSource: (callbacks: GranolaEventSourceCallbacks) => GranolaEventSource;
  initialEvents?: ConsoleEvent[];
  modelId?: string;
  pdfModelId?: string;
  liveModelId?: string;
  resumePath?: string;
  initialInterviewTypeId?: string;
  loadInterviewTypes?: () => Promise<InterviewType[]>;
  saveInterviewTypes?: (interviewTypes: InterviewType[]) => Promise<void>;
  loadInterviewSessions?: () => Promise<InterviewSession[]>;
  saveInterviewSessions?: (interviewSessions: InterviewSession[]) => Promise<void>;
  chooseResumeFile?: () => Promise<string>;
  loadAppSettings?: () => Promise<AppSettings>;
  saveAppSettings?: (appSettings: AppSettings) => Promise<void>;
  copyTextToClipboard?: CopyTextToClipboard;
  logger?: AppLogger;
  generateResumeQuestions?: (input: {
    apiKeys?: ApiKeySettings;
    modelId: string;
    interviewType: InterviewType;
    resumePath: string;
    requestId?: string;
    sessionId?: string;
  }) => Promise<InterviewQuestion[]>;
  generateLiveQuestions?: (input: {
    apiKeys?: ApiKeySettings;
    modelId: string;
    interviewType: InterviewType;
    transcriptText: string;
    pinnedQuestions?: InterviewQuestion[];
    requestId?: string;
    sessionId?: string;
  }) => Promise<InterviewQuestion[]>;
  liveQuestionOptions?: {
    debounceMs?: number;
    minIntervalMs?: number;
    minNewTranscriptChars?: number;
  };
}

interface ChatAppState {
  mode: AppMode;
  events: ConsoleEvent[];
  status: ConsoleStatus;
  interviewTypes: InterviewType[];
  sessions: InterviewSession[];
  appSettings: AppSettings;
  activeSessionId: string | null;
  selectedTemplateIndex: number;
  selectedDefaultPromptIndex: number;
  settingsSection: SettingsSection;
  selectedSettingsSectionIndex: number;
  selectedApiKeyIndex: number;
  selectedSessionIndex: number;
  detailSessionId: string | null;
  selectedResumePath: string;
  newInterviewResumePath: string;
  newInterviewCandidateName: string;
  questionPanelMode: QuestionPanelMode;
  showTranscript: boolean;
  selectedQuestionIndex: number;
  generalQuestions: InterviewQuestion[];
  liveQuestions: InterviewQuestion[];
  aiStatus: AiStatus;
  aiError: string | null;
  notice: string | null;
  editorState: EditorState;
  loaded: boolean;
  settingsLoaded: boolean;
}

type ChatAppAction =
  | { type: "patch"; patch: Partial<ChatAppState> }
  | { type: "update"; update: (draft: Draft<ChatAppState>) => void }
  | { type: "setAiError"; error: Error | string | null };

function createInitialChatAppState({
  initialEvents,
  initialInterviewTypeId,
  resumePath,
}: Pick<
  ChatAppProps,
  "initialEvents" | "initialInterviewTypeId" | "resumePath"
>): ChatAppState {
  return {
    mode: resumePath && !initialInterviewTypeId ? "new" : "dashboard",
    events: initialEvents ?? [],
    status: "watching",
    interviewTypes: [],
    sessions: [],
    appSettings: DEFAULT_APP_SETTINGS,
    activeSessionId: null,
    selectedTemplateIndex: 0,
    selectedDefaultPromptIndex: 0,
    settingsSection: "index",
    selectedSettingsSectionIndex: 0,
    selectedApiKeyIndex: 0,
    selectedSessionIndex: 0,
    detailSessionId: null,
    selectedResumePath: resumePath ?? "",
    newInterviewResumePath: resumePath ?? "",
    newInterviewCandidateName: "",
    questionPanelMode: "general",
    showTranscript: false,
    selectedQuestionIndex: 0,
    generalQuestions: [],
    liveQuestions: [],
    aiStatus: "idle",
    aiError: null,
    notice: null,
    editorState: { mode: "none" },
    loaded: false,
    settingsLoaded: false,
  };
}

function chatAppReducer(draft: Draft<ChatAppState>, action: ChatAppAction) {
  switch (action.type) {
    case "patch":
      Object.assign(draft, action.patch);
      return;
    case "update":
      action.update(draft);
      return;
    case "setAiError":
      draft.aiError =
        action.error === null
          ? null
          : action.error instanceof Error
            ? action.error.message
            : String(action.error);
      return;
  }
}

export function ChatApp({
  createEventSource,
  initialEvents = [],
  modelId,
  pdfModelId,
  liveModelId,
  resumePath,
  initialInterviewTypeId,
  loadInterviewTypes = defaultLoadInterviewTypes,
  saveInterviewTypes = defaultSaveInterviewTypes,
  loadInterviewSessions = defaultLoadInterviewSessions,
  saveInterviewSessions = defaultSaveInterviewSessions,
  chooseResumeFile = defaultChooseResumeFile,
  loadAppSettings = defaultLoadAppSettings,
  saveAppSettings = defaultSaveAppSettings,
  copyTextToClipboard = copyTextToTerminalClipboard,
  logger = noopAppLogger,
  generateResumeQuestions = defaultGenerateResumeQuestions,
  generateLiveQuestions = defaultGenerateLiveQuestions,
  liveQuestionOptions = {},
}: ChatAppProps) {
  const initialStateRef = useRef<ChatAppState | null>(null);
  if (initialStateRef.current === null) {
    initialStateRef.current = createInitialChatAppState({
      initialEvents,
      initialInterviewTypeId,
      resumePath,
    });
  }
  const [state, dispatchReducer] = useImmerReducer(
    chatAppReducer,
    initialStateRef.current,
  );
  const {
    mode,
    events,
    status,
    interviewTypes,
    sessions,
    appSettings,
    activeSessionId,
    selectedTemplateIndex,
    selectedDefaultPromptIndex,
    settingsSection,
    selectedSettingsSectionIndex,
    selectedApiKeyIndex,
    selectedSessionIndex,
    detailSessionId,
    selectedResumePath,
    newInterviewResumePath,
    newInterviewCandidateName,
    questionPanelMode,
    showTranscript,
    selectedQuestionIndex,
    generalQuestions,
    liveQuestions,
    aiStatus,
    aiError,
    notice,
    editorState,
    loaded,
    settingsLoaded,
  } = state;
  const stateRef = useRef(state);
  const sourceRef = useRef<GranolaEventSource | null>(null);
  const initializedFromArgsRef = useRef(false);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveInFlightRef = useRef(false);
  const pendingAutoLiveGenerationRef = useRef(false);
  const resumePickInFlightRef = useRef(false);
  const startAfterResumePickRef = useRef(false);
  const aiRequestCounterRef = useRef(0);
  const lastLiveCallAtRef = useRef<number | null>(null);
  const lastLiveTranscriptTimeMsRef = useRef<number | null>(null);
  const lastLiveTranscriptLengthRef = useRef(0);
  const debounceMs = liveQuestionOptions.debounceMs ?? 2000;
  const minIntervalMs = liveQuestionOptions.minIntervalMs ?? 30000;
  const minNewTranscriptChars = liveQuestionOptions.minNewTranscriptChars ?? 240;

  function dispatchAppAction(action: ChatAppAction) {
    const nextState = produce(stateRef.current, (draft) => {
      chatAppReducer(draft, action);
    });
    stateRef.current = nextState;
    dispatchReducer(action);
  }

  function patchAppState(patch: Partial<ChatAppState>) {
    dispatchAppAction({ type: "patch", patch });
  }

  function updateAppState(update: (draft: Draft<ChatAppState>) => void) {
    dispatchAppAction({ type: "update", update });
  }

  const setAiError = (err: Error | string | null) => {
    dispatchAppAction({ type: "setAiError", error: err });
  };

  const transcriptEvents = useMemo(
    () => events.filter((event): event is TranscriptConsoleEvent => event.type === "transcript"),
    [events],
  );
  const statusEvents = useMemo(
    () =>
      events.filter(
        (event): event is SystemConsoleEvent | ErrorConsoleEvent =>
          event.type === "system" || event.type === "error",
      ),
    [events],
  );
  const visibleTranscriptEvents = useMemo(
    () => transcriptEvents.slice(-12),
    [transcriptEvents],
  );
  const liveGenerationTranscriptText = useMemo(
    () =>
      transcriptEvents
        .filter(isLiveGenerationTranscriptEvent)
        .map((event) => event.text.trim())
        .filter(Boolean)
        .join("\n"),
    [transcriptEvents],
  );
  const liveGenerationPromptTranscriptText = useMemo(
    () => buildLiveGenerationPromptTranscriptText(transcriptEvents),
    [transcriptEvents],
  );
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );
  const activeDashboardSession = useMemo(
    () => sessions.find((session) => session.status === "active") ?? null,
    [sessions],
  );
  const effectivePdfModelId =
    pdfModelId ?? modelId ?? appSettings.selectedPdfModelId;
  const effectiveLiveModelId =
    liveModelId ?? modelId ?? appSettings.selectedLiveModelId;
  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      ),
    [sessions],
  );
  const detailSession =
    sortedSessions.find((session) => session.id === detailSessionId) ??
    sortedSessions[selectedSessionIndex] ??
    null;
  const activeQuestions =
    questionPanelMode === "general" ? generalQuestions : liveQuestions;
  const activeQuestionCount = activeQuestions.length;

  useEffect(() => {
    const nextIndex =
      activeQuestionCount === 0
        ? 0
        : Math.min(stateRef.current.selectedQuestionIndex, activeQuestionCount - 1);
    patchAppState({ selectedQuestionIndex: nextIndex });
  }, [activeQuestionCount, questionPanelMode]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadInterviewTypes(), loadInterviewSessions()])
      .then(([loadedInterviewTypes, loadedSessions]) => {
        if (cancelled) return;
        const initialIndex = Math.max(
          0,
          loadedInterviewTypes.findIndex((type) => type.id === initialInterviewTypeId),
        );
        patchAppState({
          interviewTypes: loadedInterviewTypes,
          sessions: loadedSessions,
          selectedTemplateIndex: initialIndex,
          loaded: true,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        patchAppState({ aiStatus: "error", loaded: true });
        setAiError(error);
      });
    return () => {
      cancelled = true;
    };
  }, [initialInterviewTypeId, loadInterviewSessions, loadInterviewTypes]);

  useEffect(() => {
    if (!loaded) return;

    let cancelled = false;
    loadAppSettings()
      .then((loadedAppSettings) => {
        if (cancelled) return;
        patchAppState({
          appSettings: validateAppSettings(loadedAppSettings),
          settingsLoaded: true,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        patchAppState({ aiStatus: "error", settingsLoaded: true });
        setAiError(error);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAppSettings, loaded]);

  useEffect(() => {
    if (!loaded || mode !== "new" || interviewTypes.length > 0) return;
    patchAppState({ aiStatus: "error" });
    setAiError(NO_INTERVIEW_TEMPLATES_MESSAGE);
  }, [interviewTypes.length, loaded, mode]);

  useEffect(() => {
    if (!loaded || initializedFromArgsRef.current) return;
    initializedFromArgsRef.current = true;

    if (!initialInterviewTypeId) return;
    const template = interviewTypes.find((type) => type.id === initialInterviewTypeId);
    if (!template) {
      patchAppState({ aiStatus: "error" });
      setAiError(`Template not found: ${initialInterviewTypeId}`);
      return;
    }

    const existing = stateRef.current.sessions.find(
      (session) =>
        session.status === "active" && session.templateId === initialInterviewTypeId,
    );
    if (existing && !resumePath) {
      openLiveSession(existing);
      return;
    }

    void startInterview(template, resumePath ?? "");
  }, [initialInterviewTypeId, interviewTypes, loaded, resumePath]);

  useEffect(() => {
    if (mode !== "live" || !activeSession) {
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current = null;
      }
      return;
    }

    const source = createEventSource({
      started(event) {
        logger.log({
          event: "transcript.watch.started",
          sessionId: activeSession.id,
          granolaDir: event.granolaDir,
          intervalMs: event.intervalMs,
          transcriptDocuments: event.transcriptDocuments,
          activeDocumentId: event.activeDocumentId,
        });
        const nextEvents = mergeConsoleEvents(stateRef.current.events, [
          mapWatchStartedToConsoleEvent(event),
        ]);
        patchAppState({ status: "watching", events: nextEvents });
      },
      transcriptDiff(event) {
        logger.log({
          event: "transcript.diff.received",
          sessionId: activeSession.id,
          activeDocumentId: event.activeDocumentId,
          observedAt: event.observedAt,
          addedCount: event.added.length,
          updatedCount: event.updated.length,
          finalAddedCount: event.added.filter((entry) => entry.utterance.is_final).length,
          finalUpdatedCount: event.updated.filter((entry) => entry.utterance.is_final)
            .length,
        });
        const nextEvents = mergeConsoleEvents(
          stateRef.current.events,
          mapTranscriptDiffToConsoleEvents(event),
        );
        patchAppState({ status: "watching", events: nextEvents });
        persistActiveSession({ transcriptEvents: onlyTranscriptEvents(nextEvents) });
      },
      error(event) {
        logger.log({
          level: "error",
          event: "transcript.watch.error",
          sessionId: activeSession.id,
          message: event.message,
        });
        const nextEvents = mergeConsoleEvents(stateRef.current.events, [
          mapWatchErrorToConsoleEvent(event),
        ]);
        patchAppState({ status: "error", events: nextEvents });
        persistActiveSession({ transcriptEvents: onlyTranscriptEvents(nextEvents) });
      },
      watching() {
        patchAppState({ status: "watching" });
      },
    });

    sourceRef.current = source;
    logger.log({ event: "transcript.watch.starting", sessionId: activeSession.id });
    source.start();
    return () => {
      logger.log({ event: "transcript.watch.stopping", sessionId: activeSession.id });
      source.stop();
      if (sourceRef.current === source) sourceRef.current = null;
    };
  }, [activeSession?.id, createEventSource, logger, mode]);

  useEffect(() => {
    if (!settingsLoaded || mode !== "live" || !activeSession || !activeSession.resumePath) return;
    if (generalQuestions.length > 0) return;

    const activeResumePath = activeSession.resumePath;
    const requestId = createAiRequestId("resume", aiRequestCounterRef);
    const selectedModelId =
      pdfModelId ??
      modelId ??
      stateRef.current.appSettings.selectedPdfModelId;
    let cancelled = false;
    patchAppState({ aiStatus: "loading" });
    setAiError(null);
    logger.log({
      event: "resume_generation.started",
      requestId,
      sessionId: activeSession.id,
      modelId: selectedModelId,
      resumeFileName: activeResumePath.split(/[\\/]/).at(-1) ?? activeResumePath,
    });
    generateResumeQuestions({
      apiKeys: stateRef.current.appSettings.apiKeys,
      modelId: selectedModelId,
      interviewType: activeSession.templateSnapshot,
      resumePath: activeResumePath,
      requestId,
      sessionId: activeSession.id,
    })
      .then((questions) => {
        if (cancelled) return;
        logger.log({
          event: "resume_generation.succeeded",
          requestId,
          sessionId: activeSession.id,
          questionCount: questions.length,
        });
        patchAppState({ generalQuestions: questions });
        persistActiveSession({ generalQuestions: questions });
        patchAppState({ aiStatus: "idle" });
      })
      .catch((error) => {
        if (cancelled) return;
        if (isMissingFileError(error, activeResumePath)) {
          logger.log({
            level: "warn",
            event: "resume_generation.skipped",
            requestId,
            sessionId: activeSession.id,
            reason: "missing_resume_file",
            resumeFileName: activeResumePath.split(/[\\/]/).at(-1) ?? activeResumePath,
          });
          patchAppState({
            generalQuestions: [],
            selectedResumePath: "",
            aiStatus: "idle",
          });
          persistActiveSession({ resumePath: undefined, generalQuestions: [] });
          setAiError(null);
          return;
        }
        logger.log({
          level: "error",
          event: "resume_generation.failed",
          requestId,
          sessionId: activeSession.id,
          ...formatErrorForLog(error),
        });
        patchAppState({ aiStatus: "error" });
        setAiError(error);
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeSession?.id,
    activeSession?.resumePath,
    generateResumeQuestions,
    generalQuestions.length,
    mode,
    effectivePdfModelId,
    settingsLoaded,
  ]);

  useEffect(() => {
    if (!settingsLoaded || mode !== "live" || !activeSessionId) return;
    scheduleAutoLiveQuestionGeneration();

    return () => {
      if (liveTimerRef.current) {
        clearTimeout(liveTimerRef.current);
        liveTimerRef.current = null;
      }
    };
  }, [
    activeSessionId,
    debounceMs,
    generateLiveQuestions,
    liveGenerationPromptTranscriptText,
    liveGenerationTranscriptText,
    logger,
    minIntervalMs,
    minNewTranscriptChars,
    mode,
    effectiveLiveModelId,
    settingsLoaded,
  ]);

  useInput((input, key) => {
    const currentEditorState = stateRef.current.editorState;
    if (currentEditorState.mode === "new" || currentEditorState.mode === "edit") {
      if (key.escape) {
        patchAppState({ editorState: { mode: "none" } });
        return;
      }
      if (key.tab) {
        patchAppState({
          editorState: {
            ...currentEditorState,
            fieldIndex: (currentEditorState.fieldIndex + 1) % editorFields.length,
          },
        });
        return;
      }
      if (key.return) {
        void saveDraftTemplate(currentEditorState);
        return;
      }
      if (key.backspace || key.delete) {
        patchAppState({
          editorState: updateDraftField(currentEditorState, (value) => value.slice(0, -1)),
        });
        return;
      }
      if (input) {
        patchAppState({
          editorState: updateDraftField(currentEditorState, (value) => value + input),
        });
      }
      return;
    }

    if (currentEditorState.mode === "apiKey") {
      if (key.escape) {
        patchAppState({ editorState: { mode: "none" } });
        return;
      }
      if (key.return) {
        void saveApiKeySetting(currentEditorState);
        return;
      }
      if (key.backspace || key.delete) {
        patchAppState({
          editorState: {
            ...currentEditorState,
            value: currentEditorState.value.slice(0, -1),
          },
        });
        return;
      }
      if (input) {
        patchAppState({
          editorState: {
            ...currentEditorState,
            value: currentEditorState.value + input,
          },
        });
      }
      return;
    }

    if (currentEditorState.mode === "candidateName") {
      if (key.escape) {
        patchAppState({ editorState: { mode: "none" } });
        return;
      }
      if (key.return) {
        patchAppState({
          newInterviewCandidateName: currentEditorState.value.trim(),
          editorState: { mode: "none" },
        });
        return;
      }
      if (key.backspace || key.delete) {
        patchAppState({
          editorState: {
            ...currentEditorState,
            value: currentEditorState.value.slice(0, -1),
          },
        });
        return;
      }
      if (input) {
        patchAppState({
          editorState: {
            ...currentEditorState,
            value: currentEditorState.value + input,
          },
        });
      }
      return;
    }

    if (key.escape) {
      if (stateRef.current.mode === "pastDetail") {
        patchAppState({ mode: "past" });
        return;
      }
      if (
        stateRef.current.mode === "settings" &&
        stateRef.current.settingsSection !== "index"
      ) {
        patchAppState({ settingsSection: "index" });
        return;
      }
      if (stateRef.current.mode !== "dashboard") {
        patchAppState({ mode: "dashboard" });
      }
      return;
    }

    if (stateRef.current.mode === "dashboard") {
      if (input === "n") enterNewInterview();
      if (input === "p") patchAppState({ mode: "past" });
      if (input === "s") {
        patchAppState({
          settingsSection: "index",
          editorState: { mode: "none" },
          mode: "settings",
        });
      }
      if (input === "l") {
        const activeSessionToOpen =
          stateRef.current.sessions.find((session) => session.status === "active") ?? null;
        if (activeSessionToOpen) openLiveSession(activeSessionToOpen);
      }
      return;
    }

    if (stateRef.current.mode === "new") {
      if (isNextSelection(input, key)) {
        updateAppState((draft) => {
          draft.selectedTemplateIndex = nextIndex(
            draft.selectedTemplateIndex,
            interviewTypes.length,
          );
        });
        return;
      }
      if (isPreviousSelection(input, key)) {
        updateAppState((draft) => {
          draft.selectedTemplateIndex = previousIndex(
            draft.selectedTemplateIndex,
            interviewTypes.length,
          );
        });
        return;
      }
      if (input === "r") void pickResume();
      if (input === "c") {
        patchAppState({
          editorState: {
            mode: "candidateName",
            value: stateRef.current.newInterviewCandidateName,
          },
        });
        return;
      }
      if (key.return) {
        if (resumePickInFlightRef.current) {
          startAfterResumePickRef.current = true;
          return;
        }
        const templateToStart =
          stateRef.current.interviewTypes[stateRef.current.selectedTemplateIndex] ??
          stateRef.current.interviewTypes[0] ??
          null;
        if (templateToStart) {
          void startInterview(
            templateToStart,
            stateRef.current.newInterviewResumePath,
            stateRef.current.newInterviewCandidateName,
          );
        }
      }
      return;
    }

    if (stateRef.current.mode === "live") {
      if (key.upArrow) {
        updateAppState((draft) => {
          draft.selectedQuestionIndex = previousIndex(
            draft.selectedQuestionIndex,
            activeQuestionCount,
          );
        });
        return;
      }
      if (key.downArrow) {
        updateAppState((draft) => {
          draft.selectedQuestionIndex = nextIndex(
            draft.selectedQuestionIndex,
            activeQuestionCount,
          );
        });
        return;
      }
      if (input === "p") {
        toggleSelectedQuestionPin();
        return;
      }
      if (key.backspace || key.delete) {
        deleteSelectedQuestion();
        return;
      }
      if (input === "n") {
        enterNewInterview();
        return;
      }
      if (input === "a") {
        const sessionToAnalyze =
          stateRef.current.sessions.find(
            (session) => session.id === stateRef.current.activeSessionId,
          ) ?? null;
        void copyAnalysisPrompt(sessionToAnalyze);
        return;
      }
      if (input === "r") {
        forceRegenerateLiveQuestions();
        return;
      }
      if (input === "t") {
        updateAppState((draft) => {
          draft.showTranscript = !draft.showTranscript;
        });
        return;
      }
      if (input === "g") patchAppState({ questionPanelMode: "general", selectedQuestionIndex: 0 });
      if (input === "l") patchAppState({ questionPanelMode: "live", selectedQuestionIndex: 0 });
      if (input === "d") patchAppState({ mode: "dashboard" });
      return;
    }

    if (stateRef.current.mode === "past") {
      if (isNextSelection(input, key)) {
        updateAppState((draft) => {
          draft.selectedSessionIndex = nextIndex(
            draft.selectedSessionIndex,
            sortedSessions.length,
          );
        });
        return;
      }
      if (isPreviousSelection(input, key)) {
        updateAppState((draft) => {
          draft.selectedSessionIndex = previousIndex(
            draft.selectedSessionIndex,
            sortedSessions.length,
          );
        });
        return;
      }
      if (key.return) {
        const currentSortedSessions = [...stateRef.current.sessions].sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt),
        );
        const selectedSession = currentSortedSessions[stateRef.current.selectedSessionIndex];
        if (!selectedSession) return;
        patchAppState({
          detailSessionId: selectedSession.id,
          mode: "pastDetail",
        });
      }
      return;
    }

    if (stateRef.current.mode === "pastDetail") {
      if (input === "a") {
        const currentSortedSessions = [...stateRef.current.sessions].sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt),
        );
        const sessionToAnalyze =
          currentSortedSessions.find(
            (session) => session.id === stateRef.current.detailSessionId,
          ) ??
          currentSortedSessions[stateRef.current.selectedSessionIndex] ??
          null;
        void copyAnalysisPrompt(sessionToAnalyze);
      }
      return;
    }

    if (stateRef.current.mode === "settings") {
      const currentSettingsSection = stateRef.current.settingsSection;

      if (currentSettingsSection === "index") {
        if (isNextSelection(input, key)) {
          updateAppState((draft) => {
            draft.selectedSettingsSectionIndex = nextIndex(
              draft.selectedSettingsSectionIndex,
              settingsSections.length,
            );
          });
          return;
        }
        if (isPreviousSelection(input, key)) {
          updateAppState((draft) => {
            draft.selectedSettingsSectionIndex = previousIndex(
              draft.selectedSettingsSectionIndex,
              settingsSections.length,
            );
          });
          return;
        }
        if (key.return) {
          const selectedSection =
            settingsSections[stateRef.current.selectedSettingsSectionIndex]?.section ??
            "apiKeys";
          patchAppState({ settingsSection: selectedSection });
          return;
        }
        return;
      }

      if (currentSettingsSection === "apiKeys") {
        if (isNextSelection(input, key)) {
          updateAppState((draft) => {
            draft.selectedApiKeyIndex = nextIndex(
              draft.selectedApiKeyIndex,
              apiKeyFields.length,
            );
          });
          return;
        }
        if (isPreviousSelection(input, key)) {
          updateAppState((draft) => {
            draft.selectedApiKeyIndex = previousIndex(
              draft.selectedApiKeyIndex,
              apiKeyFields.length,
            );
          });
          return;
        }
        if (key.return) {
          const selectedApiKeyField =
            apiKeyFields[stateRef.current.selectedApiKeyIndex] ?? apiKeyFields[0];
          if (selectedApiKeyField) {
            patchAppState({
              editorState: {
                mode: "apiKey",
                field: selectedApiKeyField.field,
                value: stateRef.current.appSettings.apiKeys[selectedApiKeyField.field],
              },
            });
          }
          return;
        }
        if (input === "p") {
          void saveNextAvailableModelSetting("pdf");
          return;
        }
        if (input === "m") {
          void saveNextAvailableModelSetting("live");
          return;
        }
        return;
      }

      if (currentSettingsSection === "promptDefaults") {
        if (isNextSelection(input, key)) {
          updateAppState((draft) => {
            draft.selectedDefaultPromptIndex = nextIndex(
              draft.selectedDefaultPromptIndex,
              FULL_STACK_SYSTEM_PROMPT_DEFAULTS.length,
            );
          });
          return;
        }
        if (isPreviousSelection(input, key)) {
          updateAppState((draft) => {
            draft.selectedDefaultPromptIndex = previousIndex(
              draft.selectedDefaultPromptIndex,
              FULL_STACK_SYSTEM_PROMPT_DEFAULTS.length,
            );
          });
          return;
        }
        if (key.return) {
          const prompt = getDefaultSystemPrompt(stateRef.current.selectedDefaultPromptIndex);
          patchAppState({
            editorState: {
              mode: "new",
              fieldIndex: 0,
              draft: draftFromDefaultSystemPrompt(prompt),
            },
          });
          return;
        }
        return;
      }

      if (isNextSelection(input, key)) {
        updateAppState((draft) => {
          draft.selectedTemplateIndex = nextIndex(
            draft.selectedTemplateIndex,
            interviewTypes.length,
          );
        });
        return;
      }
      if (isPreviousSelection(input, key)) {
        updateAppState((draft) => {
          draft.selectedTemplateIndex = previousIndex(
            draft.selectedTemplateIndex,
            interviewTypes.length,
          );
        });
        return;
      }
      if (key.return) {
        const templateToEdit =
          stateRef.current.interviewTypes[stateRef.current.selectedTemplateIndex] ??
          stateRef.current.interviewTypes[0] ??
          null;
        if (!templateToEdit) return;
        patchAppState({
          editorState: {
            mode: "edit",
            fieldIndex: 0,
            draft: draftFromInterviewType(templateToEdit),
          },
        });
        return;
      }
      if (input === "c") {
        patchAppState({
          editorState: {
            mode: "new",
            fieldIndex: 0,
            draft: { name: "", systemPrompt: "", qualities: "", questionTypes: "" },
          },
        });
        return;
      }
      if (input === "d") {
        const templateToDelete =
          stateRef.current.interviewTypes[stateRef.current.selectedTemplateIndex] ??
          stateRef.current.interviewTypes[0] ??
          null;
        if (templateToDelete) void deleteTemplate(templateToDelete);
      }
    }
  });

  async function pickResume() {
    if (resumePickInFlightRef.current) return;
    resumePickInFlightRef.current = true;
    startAfterResumePickRef.current = false;
    try {
      const filePath = await chooseResumeFile();
      resumePickInFlightRef.current = false;
      const shouldStartInterview = startAfterResumePickRef.current;
      startAfterResumePickRef.current = false;
      patchAppState({ newInterviewResumePath: filePath, aiStatus: "idle" });
      setAiError(null);
      if (shouldStartInterview && stateRef.current.mode === "new") {
        const templateToStart =
          stateRef.current.interviewTypes[stateRef.current.selectedTemplateIndex] ??
          stateRef.current.interviewTypes[0] ??
          null;
        if (templateToStart) {
          void startInterview(
            templateToStart,
            filePath,
            stateRef.current.newInterviewCandidateName,
          );
        }
      }
    } catch (error: any) {
      resumePickInFlightRef.current = false;
      startAfterResumePickRef.current = false;
      if (isResumePickerCancelError(error)) {
        patchAppState({ aiStatus: "idle" });
        setAiError(null);
        return;
      }
      patchAppState({ aiStatus: "error" });
      setAiError(error);
    }
  }

  function enterNewInterview() {
    const hasNoTemplates = stateRef.current.interviewTypes.length === 0;
    patchAppState({
      newInterviewResumePath: "",
      newInterviewCandidateName: "",
      editorState: { mode: "none" },
      aiStatus: hasNoTemplates ? "error" : "idle",
      notice: null,
      mode: "new",
    });
    setAiError(hasNoTemplates ? NO_INTERVIEW_TEMPLATES_MESSAGE : null);
  }

  async function startInterview(
    template: InterviewType,
    nextResumePath: string,
    candidateName = "",
  ) {
    const newSession = createInterviewSession({
      template,
      candidateName,
      resumePath: nextResumePath.trim() || undefined,
    });
    const nextSessions = [
      ...completeActiveSessions(stateRef.current.sessions),
      newSession,
    ];
    patchAppState({
      sessions: nextSessions,
      activeSessionId: newSession.id,
      events: [],
      generalQuestions: [],
      liveQuestions: [],
      selectedQuestionIndex: 0,
      questionPanelMode: "general",
      selectedResumePath: nextResumePath,
      newInterviewCandidateName: "",
      mode: "live",
      aiStatus: "idle",
    });
    setAiError(null);
    await saveInterviewSessions(nextSessions);
  }

  function openLiveSession(session: InterviewSession) {
    patchAppState({
      activeSessionId: session.id,
      events: session.transcriptEvents,
      generalQuestions: session.generalQuestions,
      liveQuestions: session.liveQuestions,
      selectedResumePath: session.resumePath ?? "",
      selectedQuestionIndex: 0,
      questionPanelMode: "general",
      mode: "live",
    });
  }

  async function copyAnalysisPrompt(session: InterviewSession | null) {
    if (!session) {
      patchAppState({ notice: null, aiStatus: "error" });
      setAiError("No interview selected to analyze");
      return;
    }

    try {
      await copyTextToClipboard(buildGranolaAnalysisPrompt(session));
      patchAppState({ aiStatus: "idle", notice: "Granola analysis prompt copied." });
      setAiError(null);
    } catch (error: any) {
      patchAppState({ notice: null, aiStatus: "error" });
      setAiError(error);
    }
  }

  function forceRegenerateLiveQuestions() {
    const context = getCurrentLiveGenerationContext();
    if (!context) return;

    if (liveTimerRef.current) {
      clearTimeout(liveTimerRef.current);
      liveTimerRef.current = null;
    }

    void runLiveQuestionGeneration({
      sessionId: context.session.id,
      transcriptText: context.transcriptText,
      promptTranscriptText: context.promptTranscriptText,
      latestTranscriptTimeMs: context.latestTranscriptTimeMs,
      trigger: "manual",
    });
  }

  function getCurrentLiveGenerationContext() {
    const currentActiveSessionId = stateRef.current.activeSessionId;
    const currentActiveSession =
      stateRef.current.sessions.find(
        (session) => session.id === currentActiveSessionId,
      ) ?? null;
    if (!currentActiveSession) return null;

    const currentTranscriptEvents = stateRef.current.events.filter(
      (event): event is TranscriptConsoleEvent => event.type === "transcript",
    );
    const transcriptText = currentTranscriptEvents
      .filter(isLiveGenerationTranscriptEvent)
      .map((event) => event.text.trim())
      .filter(Boolean)
      .join("\n");

    return {
      session: currentActiveSession,
      transcriptText,
      promptTranscriptText: buildLiveGenerationPromptTranscriptText(
        currentTranscriptEvents,
      ),
      latestTranscriptTimeMs: getLatestTranscriptTimeMs(currentTranscriptEvents),
    };
  }

  function scheduleAutoLiveQuestionGeneration() {
    const context = getCurrentLiveGenerationContext();
    if (!context) return;

    const newTranscriptChars =
      context.transcriptText.length - lastLiveTranscriptLengthRef.current;
    if (newTranscriptChars < minNewTranscriptChars) {
      pendingAutoLiveGenerationRef.current = false;
      return;
    }

    if (liveInFlightRef.current) {
      pendingAutoLiveGenerationRef.current = true;
      logger.log({
        event: "live_generation.skipped",
        sessionId: context.session.id,
        reason: "request_in_flight",
        transcriptChars: context.transcriptText.length,
        lastGeneratedTranscriptChars: lastLiveTranscriptLengthRef.current,
      });
      return;
    }

    pendingAutoLiveGenerationRef.current = false;

    if (liveTimerRef.current) {
      clearTimeout(liveTimerRef.current);
    }

    const selectedModelId =
      liveModelId ??
      modelId ??
      stateRef.current.appSettings.selectedLiveModelId;
    const elapsedSinceLastLiveCall = getElapsedSinceLastLiveCallMs(
      context.latestTranscriptTimeMs,
      lastLiveTranscriptTimeMsRef.current,
      lastLiveCallAtRef.current,
    );
    const intervalDelay =
      elapsedSinceLastLiveCall === null
        ? 0
        : Math.max(minIntervalMs - elapsedSinceLastLiveCall, 0);
    const delay = Math.max(debounceMs, intervalDelay, 0);
    logger.log({
      event: "live_generation.scheduled",
      sessionId: context.session.id,
      modelId: selectedModelId,
      delayMs: delay,
      transcriptChars: context.transcriptText.length,
      newTranscriptChars,
      promptTranscriptChars: context.promptTranscriptText.length,
    });
    liveTimerRef.current = setTimeout(() => {
      liveTimerRef.current = null;
      const latestContext = getCurrentLiveGenerationContext();
      if (!latestContext) return;
      void runLiveQuestionGeneration({
        sessionId: latestContext.session.id,
        transcriptText: latestContext.transcriptText,
        promptTranscriptText: latestContext.promptTranscriptText,
        latestTranscriptTimeMs: latestContext.latestTranscriptTimeMs,
        trigger: "auto",
      });
    }, delay);
  }

  async function runLiveQuestionGeneration({
    sessionId,
    transcriptText,
    promptTranscriptText,
    latestTranscriptTimeMs,
    trigger,
  }: {
    sessionId: string;
    transcriptText: string;
    promptTranscriptText: string;
    latestTranscriptTimeMs: number | null;
    trigger: "auto" | "manual";
  }) {
    if (liveInFlightRef.current || !stateRef.current.activeSessionId) {
      if (trigger === "auto") {
        pendingAutoLiveGenerationRef.current = true;
      }
      logger.log({
        event: "live_generation.skipped",
        sessionId,
        reason: "request_in_flight",
        trigger,
        transcriptChars: transcriptText.length,
        lastGeneratedTranscriptChars: lastLiveTranscriptLengthRef.current,
      });
      return;
    }

    const session =
      stateRef.current.sessions.find(
        (candidate) => candidate.id === sessionId,
      ) ?? null;
    if (!session || stateRef.current.activeSessionId !== sessionId) return;

    if (promptTranscriptText.trim().length === 0) {
      logger.log({
        event: "live_generation.skipped",
        sessionId,
        reason: "empty_transcript",
        trigger,
      });
      patchAppState({ aiStatus: "error" });
      setAiError("No transcript context available to regenerate live questions.");
      return;
    }

    liveInFlightRef.current = true;
    const requestId = createAiRequestId("live", aiRequestCounterRef);
    const selectedModelId =
      liveModelId ??
      modelId ??
      stateRef.current.appSettings.selectedLiveModelId;
    patchAppState({ aiStatus: "loading" });
    setAiError(null);
    const pinnedQuestions = [
      ...stateRef.current.generalQuestions.filter((question) => question.pinned),
      ...stateRef.current.liveQuestions.filter((question) => question.pinned),
    ];
    logger.log({
      event: "live_generation.started",
      requestId,
      sessionId,
      modelId: selectedModelId,
      trigger,
      transcriptChars: transcriptText.length,
      promptTranscriptChars: promptTranscriptText.length,
      pinnedQuestionCount: pinnedQuestions.length,
    });

    try {
      const questions = await generateLiveQuestions({
        apiKeys: stateRef.current.appSettings.apiKeys,
        modelId: selectedModelId,
        interviewType: session.templateSnapshot,
        transcriptText: promptTranscriptText,
        pinnedQuestions,
        requestId,
        sessionId,
      });
      logger.log({
        event: "live_generation.succeeded",
        requestId,
        sessionId,
        questionCount: questions.length,
      });
      const nextLiveQuestions = mergeLiveQuestionsWithPinned(
        stateRef.current.liveQuestions,
        questions,
        pinnedQuestions,
      );
      patchAppState({
        liveQuestions: nextLiveQuestions,
        questionPanelMode: "live",
        selectedQuestionIndex: 0,
      });
      persistActiveSession({ liveQuestions: nextLiveQuestions });
      lastLiveTranscriptLengthRef.current = transcriptText.length;
      lastLiveCallAtRef.current = Date.now();
      lastLiveTranscriptTimeMsRef.current = latestTranscriptTimeMs;
      patchAppState({ aiStatus: "idle" });
    } catch (error) {
      logger.log({
        level: "error",
        event: "live_generation.failed",
        requestId,
        sessionId,
        ...formatErrorForLog(error),
      });
      patchAppState({ aiStatus: "error" });
      setAiError(error instanceof Error ? error : String(error));
    } finally {
      logger.log({
        event: "live_generation.completed",
        requestId,
        sessionId,
      });
      liveInFlightRef.current = false;
      if (pendingAutoLiveGenerationRef.current) {
        scheduleAutoLiveQuestionGeneration();
      }
    }
  }

  function toggleSelectedQuestionPin() {
    updateActiveQuestions((questions, selectedIndex) =>
      questions.map((question, index) =>
        index === selectedIndex
          ? { ...question, pinned: question.pinned ? undefined : true }
          : question,
      ),
    );
  }

  function deleteSelectedQuestion() {
    updateActiveQuestions((questions, selectedIndex) =>
      questions.filter((_, index) => index !== selectedIndex),
    );
  }

  function updateActiveQuestions(
    update: (
      questions: InterviewQuestion[],
      selectedIndex: number,
    ) => InterviewQuestion[],
  ) {
    const panelMode = stateRef.current.questionPanelMode;
    const questions =
      panelMode === "general" ? stateRef.current.generalQuestions : stateRef.current.liveQuestions;
    if (questions.length === 0) return;

    const selectedIndex = Math.min(stateRef.current.selectedQuestionIndex, questions.length - 1);
    const nextQuestions = update(questions, selectedIndex);

    if (panelMode === "general") {
      patchAppState({ generalQuestions: nextQuestions });
      persistActiveSession({ generalQuestions: nextQuestions });
    } else {
      patchAppState({ liveQuestions: nextQuestions });
      persistActiveSession({ liveQuestions: nextQuestions });
    }

    const nextSelectedIndex =
      nextQuestions.length === 0 ? 0 : Math.min(selectedIndex, nextQuestions.length - 1);
    patchAppState({ selectedQuestionIndex: nextSelectedIndex });
  }

  function persistActiveSession(
    patch: Partial<
      Pick<
        InterviewSession,
        "resumePath" | "transcriptEvents" | "generalQuestions" | "liveQuestions"
      >
    >,
  ) {
    const currentActiveSessionId = stateRef.current.activeSessionId;
    if (!currentActiveSessionId) return;
    const timestamp = new Date().toISOString();
    const nextSessions = stateRef.current.sessions.map((session) =>
      session.id === currentActiveSessionId
        ? { ...session, ...patch, updatedAt: timestamp }
        : session,
    );
    patchAppState({ sessions: nextSessions });
    void saveInterviewSessions(nextSessions);
  }

  async function saveDraftTemplate(
    state: Extract<EditorState, { mode: "new" | "edit" }>,
  ) {
    const draft = state.draft;
    if (draft.name.trim() === "") {
      patchAppState({ aiStatus: "error" });
      setAiError("Template name is required");
      return;
    }

    try {
      const shouldClosePromptDefaults =
        state.mode === "new" &&
        stateRef.current.mode === "settings" &&
        stateRef.current.settingsSection === "promptDefaults";
      const templatesSectionIndex = settingsSections.findIndex(
        (section) => section.section === "templates",
      );
      const templateToUpdate =
        stateRef.current.interviewTypes[stateRef.current.selectedTemplateIndex] ??
        stateRef.current.interviewTypes[0] ??
        null;
      const nextType =
        state.mode === "new" || !templateToUpdate
          ? createInterviewType({
              ...draftToInterviewTypeInput(draft),
            })
          : updateInterviewType(templateToUpdate, {
              ...draftToInterviewTypeInput(draft),
            });
      const nextInterviewTypes =
        state.mode === "new"
          ? [...interviewTypes, nextType]
          : interviewTypes.map((type) => (type.id === nextType.id ? nextType : type));

      patchAppState({
        interviewTypes: nextInterviewTypes,
        selectedTemplateIndex: Math.max(
          0,
          nextInterviewTypes.findIndex((type) => type.id === nextType.id),
        ),
        ...(shouldClosePromptDefaults
          ? {
              settingsSection: "templates" as const,
              selectedSettingsSectionIndex: Math.max(0, templatesSectionIndex),
            }
          : {}),
        editorState: { mode: "none" },
        aiStatus: "idle",
      });
      setAiError(null);
      await saveInterviewTypes(nextInterviewTypes);
    } catch (error: any) {
      patchAppState({ aiStatus: "error" });
      setAiError(error);
    }
  }

  async function deleteTemplate(template: InterviewType) {
    if (stateRef.current.sessions.some((session) => session.templateId === template.id)) {
      patchAppState({ aiStatus: "error" });
      setAiError("Cannot delete a template with saved interviews");
      return;
    }
    const nextInterviewTypes = interviewTypes.filter((type) => type.id !== template.id);
    updateAppState((draft) => {
      draft.interviewTypes = nextInterviewTypes;
      draft.selectedTemplateIndex = Math.min(
        draft.selectedTemplateIndex,
        Math.max(0, nextInterviewTypes.length - 1),
      );
      draft.aiStatus = "idle";
    });
    setAiError(null);
    await saveInterviewTypes(nextInterviewTypes);
  }

  async function saveApiKeySetting(
    state: Extract<EditorState, { mode: "apiKey" }>,
  ) {
    const nextSettings: AppSettings = {
      ...stateRef.current.appSettings,
      apiKeys: {
        ...stateRef.current.appSettings.apiKeys,
        [state.field]: state.value.trim(),
      },
    };

    try {
      patchAppState({
        appSettings: nextSettings,
        editorState: { mode: "none" },
        aiStatus: "idle",
      });
      setAiError(null);
      await saveAppSettings(nextSettings);
    } catch (error: any) {
      patchAppState({ aiStatus: "error" });
      setAiError(error);
    }
  }

  async function saveNextAvailableModelSetting(kind: "pdf" | "live") {
    const availableModels = getAvailableModelOptions(stateRef.current.appSettings.apiKeys);
    if (availableModels.length === 0) {
      patchAppState({ aiStatus: "error" });
      setAiError("No AI models available. Add an API key first.");
      return;
    }

    const selectedModelId =
      kind === "pdf"
        ? stateRef.current.appSettings.selectedPdfModelId
        : stateRef.current.appSettings.selectedLiveModelId;
    const currentIndex = availableModels.findIndex(
      (option) => option.id === selectedModelId,
    );
    const nextModelIndex =
      currentIndex >= 0 ? (currentIndex + 1) % availableModels.length : 0;
    const nextModel = availableModels[nextModelIndex];
    if (!nextModel) return;
    const nextSettings: AppSettings = {
      ...stateRef.current.appSettings,
      selectedPdfModelId:
        kind === "pdf"
          ? nextModel.id
          : stateRef.current.appSettings.selectedPdfModelId,
      selectedLiveModelId:
        kind === "live"
          ? nextModel.id
          : stateRef.current.appSettings.selectedLiveModelId,
    };

    try {
      patchAppState({ appSettings: nextSettings, aiStatus: "idle" });
      setAiError(null);
      await saveAppSettings(nextSettings);
    } catch (error: any) {
      patchAppState({ aiStatus: "error" });
      setAiError(error);
    }
  }

  return (
    <Box flexDirection="column">
      <Header
        mode={mode}
        pdfModelId={effectivePdfModelId}
        liveModelId={effectiveLiveModelId}
        activeSession={activeSession}
        selectedResumePath={mode === "new" ? newInterviewResumePath : selectedResumePath}
      />
      <StatusBanner aiStatus={aiStatus} aiError={aiError} loaded={loaded} />
      <NoticeBanner notice={notice} />

      {mode === "dashboard" ? (
        <Dashboard activeSession={activeDashboardSession} />
      ) : null}
      {mode === "new" ? (
        <NewInterviewView
          interviewTypes={interviewTypes}
          selectedTemplateIndex={selectedTemplateIndex}
          selectedResumePath={newInterviewResumePath}
          candidateName={newInterviewCandidateName}
          editorState={editorState}
        />
      ) : null}
      {mode === "live" ? (
        <LiveInterviewView
          status={status}
          statusEvents={statusEvents}
          visibleTranscriptEvents={visibleTranscriptEvents}
          transcriptEvents={transcriptEvents}
          questionPanelMode={questionPanelMode}
          aiStatus={aiStatus}
          aiError={aiError}
          activeQuestions={activeQuestions}
          selectedQuestionIndex={selectedQuestionIndex}
          showTranscript={showTranscript}
        />
      ) : null}
      {mode === "past" ? (
        <PastInterviewsView
          sessions={sortedSessions}
          selectedSessionIndex={selectedSessionIndex}
        />
      ) : null}
      {mode === "pastDetail" ? (
        <PastInterviewDetail session={detailSession} />
      ) : null}
      {mode === "settings" ? (
        <SettingsView
          section={settingsSection}
          appSettings={appSettings}
          interviewTypes={interviewTypes}
          selectedTemplateIndex={selectedTemplateIndex}
          defaultPrompts={FULL_STACK_SYSTEM_PROMPT_DEFAULTS}
          selectedDefaultPromptIndex={selectedDefaultPromptIndex}
          selectedSettingsSectionIndex={selectedSettingsSectionIndex}
          selectedApiKeyIndex={selectedApiKeyIndex}
          editorState={editorState}
        />
      ) : null}
    </Box>
  );
}

function mergeLiveQuestionsWithPinned(
  currentLiveQuestions: InterviewQuestion[],
  generatedQuestions: InterviewQuestion[],
  pinnedQuestions: InterviewQuestion[],
): InterviewQuestion[] {
  const pinnedLiveQuestions = currentLiveQuestions.filter((question) => question.pinned);
  const pinnedQuestionText = new Set(
    [...pinnedQuestions, ...pinnedLiveQuestions].map((question) =>
      normalizeQuestionText(question.question),
    ),
  );
  const generatedUnpinnedQuestions = generatedQuestions.filter(
    (question) => !pinnedQuestionText.has(normalizeQuestionText(question.question)),
  );

  return [...pinnedLiveQuestions, ...generatedUnpinnedQuestions];
}

function normalizeQuestionText(question: string): string {
  return question.trim().replace(/\s+/g, " ").toLowerCase();
}

function createAiRequestId(
  prefix: "resume" | "live",
  counterRef: React.MutableRefObject<number>,
): string {
  counterRef.current += 1;
  return `${prefix}-${Date.now().toString(36)}-${counterRef.current}`;
}

function getLatestTranscriptTimeMs(events: TranscriptConsoleEvent[]): number | null {
  let latest: number | null = null;
  for (const event of events) {
    if (!isLiveGenerationTranscriptEvent(event)) continue;
    const timestamp =
      parseTranscriptTimeMs(event.endTimestamp) ??
      parseTranscriptTimeMs(event.startTimestamp);
    if (timestamp === null) continue;
    latest = latest === null ? timestamp : Math.max(latest, timestamp);
  }
  return latest;
}

function getElapsedSinceLastLiveCallMs(
  latestTranscriptTimeMs: number | null,
  lastLiveTranscriptTimeMs: number | null,
  lastLiveCallAtMs: number | null,
): number | null {
  if (latestTranscriptTimeMs !== null && lastLiveTranscriptTimeMs !== null) {
    return Math.max(0, latestTranscriptTimeMs - lastLiveTranscriptTimeMs);
  }
  if (lastLiveCallAtMs === null) return null;
  return Math.max(0, Date.now() - lastLiveCallAtMs);
}

function parseTranscriptTimeMs(value: string | undefined): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatErrorForLog(error: unknown) {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
    };
  }

  return {
    errorName: "NonError",
    errorMessage: String(error),
  };
}
