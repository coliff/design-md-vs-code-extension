# Agents

<!-- https://agents.md -->

## General Rules

- Before declaring a task is complete, compile the extension to ensure it completes with no errors.
- Never downgrade dependencies.
- Newly added version/features for the Extension Changelog go at the top.
- As a general rule: some rules, attributes, lists should be in alphabetical order.
- Format everything with Prettier.

## Markdown Code Style

- Format with Prettier.

## JavaScript Code Style

- Format with Prettier.
- Use vanilla JavaScript.

## Git / Pull Requests

- Always use meaningful branch names. Never use random or auto-generated names (e.g. claude/nifty-bardeen-ysr7xa).
- Always squash each PR to a single commit. When you push follow-up changes to an open PR (review or CI fixes), fold them into that commit and force-push with git push --force-with-lease instead of adding new commits.
