#!/usr/bin/env node
import os from "node:os";
import path from "node:path";

import React from "react";
import { render } from "ink";

import { createGranolaEventSource } from "./granola/event-source.js";
import { ChatApp } from "./ui/ChatApp.js";

const DEFAULT_GRANOLA_DIR = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Granola",
);

render(
  <ChatApp
    createEventSource={(callbacks) =>
      createGranolaEventSource(
        {
          granolaDir: DEFAULT_GRANOLA_DIR,
          intervalMs: 2000,
          emitExisting: false,
          json: false,
          summary: true,
          transcriptDocumentId: null,
          keychainService: "Granola Safe Storage",
          keychainAccount: "Granola Key",
          help: false,
        },
        callbacks,
      )
    }
  />,
);
