# ⚠️ REFERENCE TEMPLATE — NOT AN ACTIVE SKILL

**This file is a template only.** Use it as a reference to understand the Agent Skill format.
When you're ready to create a real skill, copy this structure and fill in your own content.

---

## What are Agent Skills?

Agent Skills are lightweight packages that extend AI agent capabilities with specialized knowledge 
and workflows. A skill folder contains a `SKILL.md` file with metadata and instructions, plus optional 
supporting files for code, docs, and templates.

---

```yaml
---
name: my-skill-name
description: Extract tables from PDF files, with headers and formatting preserved
metadata:
  author: your-org
  version: "1.0"
---
```

## Instructions

Clear step-by-step guide for how this skill works:

1. **Input validation** - Check that input is valid PDF file
2. **Table detection** - Find all tables in the document
3. **Extract structure** - Preserve headers, rows, columns
4. **Format output** - Return as JSON or CSV

## Examples

### Input
```
User provides: PDF file path
```

### Output
```json
{
  "tables": [
    {
      "headers": ["Name", "Age", "City"],
      "rows": [
        ["Alice", "28", "NYC"],
        ["Bob", "34", "LA"]
      ]
    }
  ]
}
```

---

## Optional: Extend Your Skill

You can create these folders to enhance your skill:

### `scripts/` — Executable Code
**Use when:** Your skill needs to run code (Python, JavaScript, Bash)

**Example:** If your skill processes PDFs, put the extraction logic here
```
my-skill-name/
├── SKILL.md
└── scripts/
    ├── extract_tables.py      ← PDF table extraction
    └── format_output.js       ← Convert to JSON
```

**Why helpful:** Agents can execute code to do real work, not just guide users

---

### `references/` — Documentation Files
**Use when:** Your skill needs detailed specs, formats, or API docs

**Example:** If your skill handles different PDF types, document them here
```
my-skill-name/
├── SKILL.md
└── references/
    ├── REFERENCE.md           ← Technical deep-dive
    └── PDF-FORMATS.md         ← Supported PDF types
```

**Why helpful:** Agents load these on-demand, keeping SKILL.md lightweight

---

### `assets/` — Templates & Resources
**Use when:** Your skill needs templates, sample data, or config files

**Example:** If your skill helps users create documents, provide templates
```
my-skill-name/
├── SKILL.md
└── assets/
    ├── report-template.docx   ← Sample output
    └── config-example.json    ← Config template
```

**Why helpful:** Agents can reference real examples without storing them in SKILL.md

---

## Description Tips

✅ **Good** (specific, actionable):
- "Extract tables from PDF files, preserving headers and formatting"
- "Generate TypeScript types from GraphQL schema"
- "Find unused imports in Python projects"

❌ **Poor** (vague, too broad):
- "Helps with documents"
- "General tool for various tasks"
- "Assists with file processing"

---

## Next Steps

1. Copy this structure to a new folder: `my-skill-name/`
2. Replace `_SKILL-REFERENCE.md` filename with `SKILL.md`
3. Fill in your own name, description, and instructions
4. Add code to `scripts/` if needed
5. Add docs to `references/` if needed
6. Run scanner to validate ✓
