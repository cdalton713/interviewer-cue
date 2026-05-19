import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useImmer } from "use-immer";

import {
  SUPPORTED_MODEL_OPTIONS,
  isModelOptionAvailable,
  type SupportedModelOption,
} from "../ai/provider-registry.js";
import type { InterviewQuestion } from "../ai/questions.js";
import type {
  ConsoleStatus,
  ErrorConsoleEvent,
  SystemConsoleEvent,
  TranscriptConsoleEvent,
} from "../conversation/types.js";
import type { ApiKeySettings, AppSettings } from "../config/app-settings.js";
import type { DefaultSystemPrompt } from "../interview/default-system-prompts.js";
import type { InterviewSession } from "../interview/interview-sessions.js";
import type { InterviewType } from "../interview/interview-types.js";
import {
  AI_LOADING_SPINNER_FRAMES,
  AI_LOADING_SPINNER_INTERVAL_MS,
  MAX_VISIBLE_QUESTIONS,
  RECENT_TRANSCRIPT_LINES,
  apiKeyFields,
  editorFields,
  settingsSections,
  uiColor,
} from "./chat-app-options.js";
import {
  getFirstVisibleQuestionIndex,
  maskSecret,
  modeLabel,
} from "./chat-app-helpers.js";
import type {
  AiStatus,
  AppMode,
  EditorState,
  QuestionPanelMode,
  SettingsSection,
} from "./chat-app-types.js";

export function Header({
  mode,
  pdfModelId,
  liveModelId,
  activeSession,
  selectedResumePath,
}: {
  mode: AppMode;
  pdfModelId: string;
  liveModelId: string;
  activeSession: InterviewSession | null;
  selectedResumePath: string;
}) {
  return (
    <Box borderStyle="single" borderColor={uiColor.app} paddingX={1}>
      <Box flexDirection="column">
        <Text color={uiColor.app} bold>
          Granola Interviewer
        </Text>
        <Text>
          <Text color={mode === "live" ? uiColor.healthy : uiColor.app} bold>
            {modeLabel(mode)}
          </Text>
          <Text color={uiColor.muted}>
            {" "}· pdf {pdfModelId} · live {liveModelId}
          </Text>
          {activeSession ? <Text> · {activeSession.templateSnapshot.name}</Text> : null}
          {selectedResumePath ? (
            <Text color={uiColor.muted}> · resume {selectedResumePath}</Text>
          ) : null}
        </Text>
      </Box>
    </Box>
  );
}

export function StatusBanner({
  aiStatus,
  aiError,
  loaded,
}: {
  aiStatus: AiStatus;
  aiError: string | null;
  loaded: boolean;
}) {
  if (!loaded) return <Text color={uiColor.muted}>Loading...</Text>;
  if (aiStatus !== "error" || !aiError) return null;
  return (
    <Text color={uiColor.danger} bold>
      AI error: {aiError}
    </Text>
  );
}

export function NoticeBanner({ notice }: { notice: string | null }) {
  if (!notice) return null;
  return (
    <Text color={uiColor.healthy} bold>
      {notice}
    </Text>
  );
}

export function Dashboard({ activeSession }: { activeSession: InterviewSession | null }) {
  return (
    <Box flexDirection="column" paddingY={1}>
      <SectionTitle label="Dashboard" />
      <Text color={uiColor.app}>n New Interview</Text>
      <Text color={uiColor.app}>p Past Interviews</Text>
      <Text color={uiColor.app}>s Settings</Text>
      {activeSession ? (
        <Text color={uiColor.healthy} bold>
          l Live Interview · {activeSession.templateSnapshot.name}
        </Text>
      ) : null}
    </Box>
  );
}

export function NewInterviewView({
  interviewTypes,
  selectedTemplateIndex,
  selectedResumePath,
  candidateName,
  editorState,
}: {
  interviewTypes: InterviewType[];
  selectedTemplateIndex: number;
  selectedResumePath: string;
  candidateName: string;
  editorState: EditorState;
}) {
  const candidateValue =
    editorState.mode === "candidateName" ? editorState.value : candidateName;
  return (
    <Box flexDirection="column" paddingY={1}>
      <SectionTitle label="New Interview" />
      <Text color={uiColor.muted}>
        j/k template · c candidate · r choose resume · enter start · esc dashboard
      </Text>
      {interviewTypes.length === 0 ? (
        <Text color={uiColor.muted}>No templates yet.</Text>
      ) : null}
      {interviewTypes.map((template, index) => (
        <Text
          key={template.id}
          bold={index === selectedTemplateIndex}
          color={index === selectedTemplateIndex ? uiColor.selected : undefined}
        >
          {index === selectedTemplateIndex ? ">" : " "} {template.name}
        </Text>
      ))}
      <Text
        color={
          candidateValue
            ? editorState.mode === "candidateName"
              ? uiColor.selected
              : undefined
            : uiColor.pinned
        }
        bold={editorState.mode === "candidateName"}
      >
        Candidate: {candidateValue || "none"}
      </Text>
      <Text color={selectedResumePath ? undefined : uiColor.pinned}>
        Resume: {selectedResumePath || "none"}
      </Text>
    </Box>
  );
}

export function LiveInterviewView({
  status,
  statusEvents,
  visibleTranscriptEvents,
  transcriptEvents,
  questionPanelMode,
  aiStatus,
  aiError,
  activeQuestions,
  selectedQuestionIndex,
  showTranscript,
}: {
  status: ConsoleStatus;
  statusEvents: Array<SystemConsoleEvent | ErrorConsoleEvent>;
  visibleTranscriptEvents: TranscriptConsoleEvent[];
  transcriptEvents: TranscriptConsoleEvent[];
  questionPanelMode: QuestionPanelMode;
  aiStatus: AiStatus;
  aiError: string | null;
  activeQuestions: InterviewQuestion[];
  selectedQuestionIndex: number;
  showTranscript: boolean;
}) {
  const firstVisibleQuestionIndex = getFirstVisibleQuestionIndex(
    selectedQuestionIndex,
    activeQuestions.length,
    MAX_VISIBLE_QUESTIONS,
  );
  const visibleQuestions = activeQuestions.slice(
    firstVisibleQuestionIndex,
    firstVisibleQuestionIndex + MAX_VISIBLE_QUESTIONS,
  );

  return (
    <Box flexDirection="column">
      <SectionTitle label="Live Interview" />
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={uiColor.muted}
        paddingX={1}
      >
        <Text color={uiColor.pinned} bold>
          {questionPanelMode} questions
        </Text>
        <AiStatusLine aiStatus={aiStatus} aiError={aiError} />
        {activeQuestions.length === 0 ? (
          <Text color={uiColor.muted}>No {questionPanelMode} questions yet.</Text>
        ) : (
          visibleQuestions.map((question, index) => {
            const questionIndex = firstVisibleQuestionIndex + index;
            return (
              <QuestionLine
                key={`${question.question}:${questionIndex}`}
                question={question}
                index={questionIndex}
                selected={questionIndex === selectedQuestionIndex}
              />
            );
          })
        )}
      </Box>
      {showTranscript ? (
        <Box flexDirection="column">
          <Text color={uiColor.muted} bold>
            Recent transcript
          </Text>
          {statusEvents.map((event) => (
            <StatusLine key={`${event.type}:${event.id}`} event={event} />
          ))}
          {visibleTranscriptEvents.length === 0 ? (
            <Text color={uiColor.muted}>Waiting for new transcript changes...</Text>
          ) : (
            visibleTranscriptEvents.slice(-RECENT_TRANSCRIPT_LINES).map((event) => (
              <CompactTranscriptLine key={event.id} event={event} />
            ))
          )}
        </Box>
      ) : null}
      <Box justifyContent="space-between">
        <Text color={status === "error" ? uiColor.danger : uiColor.healthy} bold>
          status {status}
        </Text>
        <Text color={uiColor.muted}>lines {transcriptEvents.length}</Text>
      </Box>
      <Text color={uiColor.muted}>
        keys ↑/↓ select · p pin · delete remove · r regenerate · g general · l live · t transcript · a analyze with Granola · d dashboard
      </Text>
    </Box>
  );
}

function AiStatusLine({
  aiStatus,
  aiError,
}: {
  aiStatus: AiStatus;
  aiError: string | null;
}) {
  const [spinnerFrameIndex, updateSpinnerFrameIndex] = useImmer(0);

  useEffect(() => {
    if (aiStatus !== "loading") {
      updateSpinnerFrameIndex(0);
      return;
    }

    const intervalId = setInterval(() => {
      updateSpinnerFrameIndex(
        (index) => (index + 1) % AI_LOADING_SPINNER_FRAMES.length,
      );
    }, AI_LOADING_SPINNER_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [aiStatus, updateSpinnerFrameIndex]);

  if (aiStatus === "loading") {
    return (
      <Text color={uiColor.app} bold>
        AI Loading {AI_LOADING_SPINNER_FRAMES[spinnerFrameIndex]}
      </Text>
    );
  }

  return (
    <Text color={aiStatus === "error" ? uiColor.danger : uiColor.healthy}>
      AI {aiStatus}
      {aiError ? `: ${aiError}` : ""}
    </Text>
  );
}

export function PastInterviewsView({
  sessions,
  selectedSessionIndex,
}: {
  sessions: InterviewSession[];
  selectedSessionIndex: number;
}) {
  return (
    <Box flexDirection="column" paddingY={1}>
      <SectionTitle label="Past Interviews" />
      <Text color={uiColor.muted}>j/k select · enter review · esc dashboard</Text>
      {sessions.length === 0 ? (
        <Text color={uiColor.muted}>No saved interviews yet.</Text>
      ) : null}
      {sessions.map((session, index) => (
        <Text
          key={session.id}
          bold={index === selectedSessionIndex}
          color={index === selectedSessionIndex ? uiColor.selected : undefined}
        >
          {index === selectedSessionIndex ? ">" : " "} {formatSessionTitle(session)} ·{" "}
          {session.createdAt} · {session.status}
        </Text>
      ))}
    </Box>
  );
}

export function PastInterviewDetail({ session }: { session: InterviewSession | null }) {
  if (!session) return <Text color={uiColor.muted}>No saved interview selected.</Text>;
  return (
    <Box flexDirection="column" paddingY={1}>
      <SectionTitle label="Past Interview" />
      <Text color={uiColor.muted}>
        {formatSessionTitle(session)} · {session.createdAt}
        {session.resumePath ? ` · resume ${session.resumePath}` : ""}
      </Text>
      <Box>
        <Box flexDirection="column" width="55%" paddingRight={1}>
          <Text color={uiColor.muted} bold>
            Transcript
          </Text>
          {session.transcriptEvents.length === 0 ? (
            <Text color={uiColor.muted}>No transcript saved.</Text>
          ) : (
            session.transcriptEvents.slice(-10).map((event) => (
              <TranscriptLine key={event.id} event={event} />
            ))
          )}
        </Box>
        <Box
          flexDirection="column"
          width="45%"
          borderStyle="single"
          borderColor={uiColor.muted}
          paddingX={1}
        >
          <Text color={uiColor.pinned} bold>
            Saved Questions
          </Text>
          {[...session.generalQuestions, ...session.liveQuestions].length === 0 ? (
            <Text color={uiColor.muted}>No saved questions.</Text>
          ) : (
            [...session.generalQuestions, ...session.liveQuestions].map((question, index) => (
              <QuestionLine
                key={`${question.question}:${index}`}
                question={question}
                index={index}
              />
            ))
          )}
        </Box>
      </Box>
      <Text color={uiColor.muted}>a analyze with Granola · esc past interviews</Text>
    </Box>
  );
}

export function SettingsView({
  section,
  appSettings,
  interviewTypes,
  selectedTemplateIndex,
  defaultPrompts,
  selectedDefaultPromptIndex,
  selectedSettingsSectionIndex,
  selectedApiKeyIndex,
  editorState,
}: {
  section: SettingsSection;
  appSettings: AppSettings;
  interviewTypes: InterviewType[];
  selectedTemplateIndex: number;
  defaultPrompts: DefaultSystemPrompt[];
  selectedDefaultPromptIndex: number;
  selectedSettingsSectionIndex: number;
  selectedApiKeyIndex: number;
  editorState: EditorState;
}) {
  const selectedDefaultPrompt =
    defaultPrompts[selectedDefaultPromptIndex] ?? defaultPrompts[0] ?? null;
  const selectedTemplate = interviewTypes[selectedTemplateIndex] ?? null;

  if (section === "index") {
    return (
      <SettingsShell>
        <SettingsIndexView
          appSettings={appSettings}
          interviewTypes={interviewTypes}
          selectedTemplate={selectedTemplate}
          defaultPrompts={defaultPrompts}
          selectedDefaultPrompt={selectedDefaultPrompt}
          selectedSettingsSectionIndex={selectedSettingsSectionIndex}
        />
      </SettingsShell>
    );
  }

  if (section === "apiKeys") {
    return (
      <SettingsShell>
        <ApiKeysSettingsView
          appSettings={appSettings}
          selectedApiKeyIndex={selectedApiKeyIndex}
        />
        <EditorPanel editorState={editorState} />
      </SettingsShell>
    );
  }

  if (section === "promptDefaults") {
    return (
      <SettingsShell>
        <PromptDefaultsSettingsView
          defaultPrompts={defaultPrompts}
          selectedDefaultPromptIndex={selectedDefaultPromptIndex}
        />
        <EditorPanel editorState={editorState} />
      </SettingsShell>
    );
  }

  return (
    <SettingsShell>
      <TemplateSettingsView
        interviewTypes={interviewTypes}
        selectedTemplateIndex={selectedTemplateIndex}
      />
      <EditorPanel editorState={editorState} />
    </SettingsShell>
  );
}

function SettingsShell({ children }: { children: React.ReactNode }) {
  return (
    <Box flexDirection="column" paddingY={1}>
      {children}
    </Box>
  );
}

function SettingsIndexView({
  appSettings,
  interviewTypes,
  selectedTemplate,
  defaultPrompts,
  selectedDefaultPrompt,
  selectedSettingsSectionIndex,
}: {
  appSettings: AppSettings;
  interviewTypes: InterviewType[];
  selectedTemplate: InterviewType | null;
  defaultPrompts: DefaultSystemPrompt[];
  selectedDefaultPrompt: DefaultSystemPrompt | null;
  selectedSettingsSectionIndex: number;
}) {
  const summaries: Record<Exclude<SettingsSection, "index">, string> = {
    apiKeys: apiKeySummary(appSettings.apiKeys),
    promptDefaults: `${defaultPrompts.length} built-ins${
      selectedDefaultPrompt ? ` · ${selectedDefaultPrompt.name}` : ""
    }`,
    templates:
      interviewTypes.length === 0
        ? "0 saved"
        : `${interviewTypes.length} saved${
            selectedTemplate ? ` · ${selectedTemplate.name} selected` : ""
          }`,
  };

  return (
    <>
      <SectionTitle label="Settings" />
      <Text color={uiColor.muted}>j/k section · enter open · esc dashboard</Text>
      {settingsSections.map((item, index) => (
        <Text
          key={item.section}
          bold={index === selectedSettingsSectionIndex}
          color={index === selectedSettingsSectionIndex ? uiColor.selected : undefined}
        >
          {index === selectedSettingsSectionIndex ? ">" : " "} {item.label}{" "}
          <Text color={uiColor.muted}>{summaries[item.section]}</Text>
        </Text>
      ))}
    </>
  );
}

function ApiKeysSettingsView({
  appSettings,
  selectedApiKeyIndex,
}: {
  appSettings: AppSettings;
  selectedApiKeyIndex: number;
}) {
  return (
    <>
      <SectionTitle label="Settings / API Keys" />
      <Text color={uiColor.muted}>j/k key · enter edit · esc settings</Text>
      <Text color={uiColor.muted}>p PDF model · m live model</Text>
      <Box flexDirection="column" marginBottom={1}>
        {apiKeyFields.map((field, index) => (
          <Text
            key={field.field}
            bold={index === selectedApiKeyIndex}
            color={index === selectedApiKeyIndex ? uiColor.selected : undefined}
          >
            {index === selectedApiKeyIndex ? ">" : " "} {field.label}{" "}
            <Text
              color={
                appSettings.apiKeys[field.field] ? uiColor.healthy : uiColor.pinned
              }
            >
              {appSettings.apiKeys[field.field] ? "set" : "not set"}
            </Text>
          </Text>
        ))}
      </Box>
      <ModelPicker
        label="PDF model"
        apiKeys={appSettings.apiKeys}
        selectedModelId={appSettings.selectedPdfModelId}
      />
      <ModelPicker
        label="Live model"
        apiKeys={appSettings.apiKeys}
        selectedModelId={appSettings.selectedLiveModelId}
      />
    </>
  );
}

function PromptDefaultsSettingsView({
  defaultPrompts,
  selectedDefaultPromptIndex,
}: {
  defaultPrompts: DefaultSystemPrompt[];
  selectedDefaultPromptIndex: number;
}) {
  const selectedDefaultPrompt =
    defaultPrompts[selectedDefaultPromptIndex] ?? defaultPrompts[0] ?? null;

  return (
    <>
      <SectionTitle label="Settings / Prompt Defaults" />
      <Text color={uiColor.muted}>
        j/k default · enter use as draft · esc settings
      </Text>
      <Box flexDirection="column" marginBottom={1}>
        {defaultPrompts.map((prompt, index) => (
          <Text
            key={prompt.name}
            bold={index === selectedDefaultPromptIndex}
            color={index === selectedDefaultPromptIndex ? uiColor.selected : undefined}
          >
            {index === selectedDefaultPromptIndex ? ">" : " "} {prompt.name}
          </Text>
        ))}
      </Box>
      {selectedDefaultPrompt ? <PromptDefaultPanel prompt={selectedDefaultPrompt} /> : null}
    </>
  );
}

function TemplateSettingsView({
  interviewTypes,
  selectedTemplateIndex,
}: {
  interviewTypes: InterviewType[];
  selectedTemplateIndex: number;
}) {
  return (
    <>
      <SectionTitle label="Settings / Interview Templates" />
      <Text color={uiColor.muted}>
        j/k template · enter edit · c new · d delete · esc settings
      </Text>
      {interviewTypes.length === 0 ? (
        <Text color={uiColor.muted}>No templates yet.</Text>
      ) : null}
      {interviewTypes.map((template, index) => (
        <Text
          key={template.id}
          bold={index === selectedTemplateIndex}
          color={index === selectedTemplateIndex ? uiColor.selected : undefined}
        >
          {index === selectedTemplateIndex ? ">" : " "} {template.name}
        </Text>
      ))}
    </>
  );
}

function apiKeySummary(apiKeys: ApiKeySettings): string {
  const openai = apiKeys.openaiApiKey ? "OpenAI set" : "OpenAI missing";
  const google = apiKeys.googleGenerativeAiApiKey ? "Google set" : "Google missing";
  const anthropic =
    apiKeys.anthropicApiKey || apiKeys.anthropicAuthToken
      ? "Anthropic set"
      : "Anthropic missing";
  return `${openai} · ${google} · ${anthropic}`;
}

function formatSessionTitle(session: InterviewSession): string {
  return session.candidateName
    ? `${session.candidateName} · ${session.templateSnapshot.name}`
    : session.templateSnapshot.name;
}

function ModelPicker({
  label,
  apiKeys,
  selectedModelId,
}: {
  label: string;
  apiKeys: ApiKeySettings;
  selectedModelId: string;
}) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={uiColor.muted} bold>
        {label}
      </Text>
      {SUPPORTED_MODEL_OPTIONS.map((option) => (
        <ModelOptionLine
          key={option.id}
          option={option}
          selected={option.id === selectedModelId}
          available={isModelOptionAvailable(option, apiKeys)}
        />
      ))}
    </Box>
  );
}

function ModelOptionLine({
  option,
  selected,
  available,
}: {
  option: SupportedModelOption;
  selected: boolean;
  available: boolean;
}) {
  const status = available
    ? "available"
    : `missing ${option.missingCredentialLabel}`;

  return (
    <Text
      bold={selected}
      color={available ? (selected ? uiColor.selected : uiColor.body) : uiColor.muted}
    >
      {selected ? ">" : " "} {option.label} · {status}
    </Text>
  );
}

function PromptDefaultPanel({
  prompt,
}: {
  prompt: DefaultSystemPrompt;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={uiColor.app}
      paddingX={1}
      marginBottom={1}
    >
      <Text color={uiColor.app} bold>
        Preview
      </Text>
      <Text color={uiColor.selected} bold>
        {prompt.name}
      </Text>
      <Box minHeight={3}>
        <Text>{prompt.systemPrompt}</Text>
      </Box>
      <Text>
        <Text color={uiColor.muted}>Qualities: </Text>
        {prompt.qualities.join(", ")}
      </Text>
      <Text>
        <Text color={uiColor.muted}>Question types: </Text>
        {prompt.questionTypes.join(", ")}
      </Text>
    </Box>
  );
}

function EditorPanel({ editorState }: { editorState: EditorState }) {
  if (editorState.mode === "none") return null;
  if (editorState.mode === "candidateName") return null;

  if (editorState.mode === "apiKey") {
    const field = apiKeyFields.find((candidate) => candidate.field === editorState.field);
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={uiColor.editing}
        paddingX={1}
      >
        <Text color={uiColor.editing} bold>
          {field?.label ?? editorState.field}
        </Text>
        <Text color={uiColor.muted}>enter save · esc cancel</Text>
        <Text>{maskSecret(editorState.value)}</Text>
      </Box>
    );
  }

  const activeField = editorFields[editorState.fieldIndex];
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={uiColor.editing}
      paddingX={1}
    >
      <Text color={uiColor.editing} bold>
        {editorState.mode === "new" ? "New" : "Edit"} template · {activeField}
      </Text>
      <Text>
        <Text color={uiColor.muted}>Name: </Text>
        {editorState.draft.name}
      </Text>
      <Text color={uiColor.muted}>System prompt:</Text>
      <Box minHeight={5} paddingX={1}>
        <Text>{editorState.draft.systemPrompt || " "}</Text>
      </Box>
      <Text>
        <Text color={uiColor.muted}>Qualities: </Text>
        {editorState.draft.qualities}
      </Text>
      <Text>
        <Text color={uiColor.muted}>Question types: </Text>
        {editorState.draft.questionTypes}
      </Text>
    </Box>
  );
}

function QuestionLine({
  question,
  index,
  selected = false,
}: {
  question: InterviewQuestion;
  index: number;
  selected?: boolean;
}) {
  const marker = selected ? ">" : " ";
  const pinnedLabel = question.pinned ? "[pinned] " : "";
  const selectedDetail = [
    question.focus ? `focus: ${question.focus}` : null,
    question.rationale,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");

  return (
    <Box flexDirection="column">
      <Text
        bold={selected}
        inverse={selected}
        color={
          selected ? uiColor.selected : question.pinned ? uiColor.pinned : undefined
        }
      >
        {marker} {pinnedLabel}
        {index + 1}. {question.question}
      </Text>
      {selected && selectedDetail ? (
        <Text color={uiColor.muted}>
          {"   "}
          {selectedDetail}
        </Text>
      ) : null}
    </Box>
  );
}

function StatusLine({
  event,
}: {
  event: SystemConsoleEvent | ErrorConsoleEvent;
}) {
  return (
    <Text color={event.type === "error" ? uiColor.danger : uiColor.muted}>
      {event.type === "error" ? "Error: " : ""}
      {event.message}
    </Text>
  );
}

function TranscriptLine({ event }: { event: TranscriptConsoleEvent }) {
  const speakerColor = getSpeakerColor(event);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={event.isFinal === false ? uiColor.pinned : speakerColor} bold>
        {event.speaker ?? "transcript"}
        {event.isFinal === false ? " ..." : ""}
      </Text>
      <Text>{event.text}</Text>
    </Box>
  );
}

function CompactTranscriptLine({ event }: { event: TranscriptConsoleEvent }) {
  const speakerColor = getSpeakerColor(event);

  return (
    <Box>
      <Text wrap="truncate">
        <Text color={event.isFinal === false ? uiColor.pinned : speakerColor} bold>
          {event.speaker ?? "transcript"}
          {event.isFinal === false ? " ..." : ""}
        </Text>
        {" "}{event.text}
      </Text>
    </Box>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <Text color={uiColor.app} bold>
      {label}
    </Text>
  );
}

function getSpeakerColor(event: TranscriptConsoleEvent): string {
  const speaker = event.speaker?.toLowerCase() ?? "";
  if (speaker.includes("interviewer")) return uiColor.interviewer;
  if (speaker.includes("candidate")) return uiColor.candidate;
  return uiColor.app;
}
