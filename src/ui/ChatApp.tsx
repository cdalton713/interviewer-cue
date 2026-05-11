import React, { useEffect, useMemo, useState } from "react";
import { Box, Text } from "ink";

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
import type {
  GranolaEventSource,
  GranolaEventSourceCallbacks,
} from "../granola/event-source.js";

interface ChatAppProps {
  createEventSource: (callbacks: GranolaEventSourceCallbacks) => GranolaEventSource;
  initialEvents?: ConsoleEvent[];
}

export function ChatApp({ createEventSource, initialEvents = [] }: ChatAppProps) {
  const [events, setEvents] = useState<ConsoleEvent[]>(initialEvents);
  const [status, setStatus] = useState<ConsoleStatus>("watching");
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

  useEffect(() => {
    const source = createEventSource({
      started(event) {
        setStatus("watching");
        setEvents((current) =>
          mergeConsoleEvents(current, [mapWatchStartedToConsoleEvent(event)]),
        );
      },
      transcriptDiff(event) {
        setEvents((current) =>
          mergeConsoleEvents(current, mapTranscriptDiffToConsoleEvents(event)),
        );
      },
      error(event) {
        setStatus("error");
        setEvents((current) =>
          mergeConsoleEvents(current, [mapWatchErrorToConsoleEvent(event)]),
        );
      },
    });

    source.start();
    return () => {
      source.stop();
    };
  }, [createEventSource]);

  return (
    <Box flexDirection="column" minHeight={18}>
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Box flexDirection="column">
          <Text bold>Granola Transcript Console</Text>
          <Text color="gray">live transcript changes observed after startup</Text>
        </Box>
      </Box>

      <Box flexDirection="column" paddingY={1} minHeight={10}>
        {statusEvents.map((event) => (
          <StatusLine key={`${event.type}:${event.id}`} event={event} />
        ))}
        {visibleTranscriptEvents.length === 0 ? (
          <Text color="gray">Waiting for new transcript changes...</Text>
        ) : (
          visibleTranscriptEvents.map((event) => (
            <TranscriptLine key={event.id} event={event} />
          ))
        )}
      </Box>

      <Box justifyContent="space-between">
        <Text color={status === "error" ? "red" : "gray"}>status {status}</Text>
        <Text color="gray">lines {transcriptEvents.length}</Text>
      </Box>
    </Box>
  );
}

function StatusLine({
  event,
}: {
  event: SystemConsoleEvent | ErrorConsoleEvent;
}) {
  return (
    <Text color={event.type === "error" ? "red" : "gray"}>
      {event.type === "error" ? "Error: " : ""}
      {event.message}
    </Text>
  );
}

function TranscriptLine({ event }: { event: TranscriptConsoleEvent }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan" bold>
        {event.speaker ?? "transcript"}
        {event.isFinal === false ? " ..." : ""}
      </Text>
      <Text>{event.text}</Text>
    </Box>
  );
}
