# Pair Writer

Pair Writer is an AI-assisted thinking and writing workspace designed for the stage before polished writing.

It helps users think, structure, refine, and preserve the reasoning behind a document — not just generate text.

## Overview

Most AI writing tools focus on output.
Pair Writer focuses on the full path that leads to output:

- writing and editing the document
- reasoning through chat
- preserving important decisions as checkpoints
- recovering relevant context across sessions
- using project and global knowledge without losing control

The document is the center of the experience, while the conversation, checkpoints, and memory remain connected to it.

## Core concept

Instead of separating “document” and “conversation”, Pair Writer keeps them together:

- **Document** as the current output
- **Chat** as the reasoning trail
- **Checkpoints** as preserved decisions
- **Memory** as recoverable context

This makes the workspace more useful for long-form technical, strategic, and iterative writing.

## Product direction

Pair Writer is currently being designed as a desktop-first product with the following direction:

- **Tauri** desktop shell
- **React** frontend
- **.NET 10** backend/API
- AI provider abstraction compatible with OpenAI-style APIs
- local and project-aware contextual persistence
- document versioning and contextual recall

## Current status

This project is currently in an early architecture and foundation phase.

Current focus includes:

- desktop shell structure
- document-centered workspace
- document-bound chat flow
- editor integration planning
- local persistence design
- context engine definition

## Planned capabilities

Planned capabilities include:

- document-centered chat sessions
- checkpoint system
- contextual memory
- knowledge toggles per file
- inline AI refactor actions
- version-aware writing workflow
- persistent local and project context

## Goals

Pair Writer aims to:

- help users think before writing
- preserve important reasoning, not only final output
- allow AI-assisted refinement without losing context
- make long-form writing feel more natural and structured
- reduce the gap between exploration, decision, and documentation

## Concept preview

This repository includes an early visual concept that illustrates the intended experience.

![Pair Writer concept](docs/images/pair-writer-preview.png)

See also:

- `docs/concepts/pairwriter-concept.html`

## Repository notes

This repository is expected to evolve along with the product architecture.
Naming, structure, and implementation details may continue to be refined as the foundation solidifies.

## License

License not yet defined.
