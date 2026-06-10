---
name: tool-page-documentation
description: Create or update documentation for a product tool, dashboard widget, or app page. Use when documenting how a tool/page works, how to interpret it, what data it uses, examples, pitfalls, and coach or user guidance.
---

## Purpose

Create documentation that helps a real user understand:
- what the tool or page does
- what it does not do
- which data it uses
- how the output should be interpreted
- what to do in common scenarios

Use this skill for:
- coach dashboard widgets
- scoring tools
- analysis pages
- program or nutrition tools
- any page that needs a clear help article or product guide

## Workflow

1. Read the real code first.
2. Identify the true product role of the tool or page.
3. Extract the actual inputs, outputs, states, and limits.
4. Separate:
   - conceptual explanation
   - interpretation guidance
   - usage guidance
   - pitfalls
5. Write in natural language for the target user, not for engineers.
6. Add practical examples and “if the widget says X, do Y”.
7. Add links or buttons in the UI when requested.

## Required content blocks

Every documentation page should cover at least:

1. `À quoi sert cet outil`
2. `Comment il fonctionne`
3. `Quelles données sont utilisées`
4. `Comment interpréter le résultat`
5. `Limites et précautions`
6. `Comment obtenir le meilleur de l’outil`

If the tool is decision-oriented, also add:

7. `Cas concrets de lecture`
8. `Erreurs d’interprétation à éviter`
9. `Que faire si le widget dit X`

## Writing rules

- Prefer plain French when the audience is coach or user-facing.
- Avoid repeating internal variable names unless they help.
- Explain the meaning of a score before explaining thresholds.
- Do not oversell certainty.
- If the system uses partial data, say so clearly.
- Distinguish `score`, `verdict`, and `confidence` when relevant.

## UI integration rules

When the user asks for integrated documentation:
- add a standard help/documentation entry point near the section title
- prefer a reusable button component
- create a stable route under the relevant product area
- keep the visual pattern consistent across similar tools

## Validation checklist

- Does the doc match the actual code?
- Can a non-technical coach understand it?
- Does it explain how to act, not just how to read?
- Does it mention missing-data behavior if relevant?
- Does it explain what the tool does not claim to do?

## References

For reusable structure and examples, read:
- [references/doc-page-template.md](references/doc-page-template.md)
