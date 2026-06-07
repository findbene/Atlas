#!/usr/bin/env bash
# SessionStart hook — injects the standing owner directive so the mini-report +
# archive obligation is in context every session (reinforces CLAUDE.md, which is
# also loaded every turn). Non-blocking; always exits 0.
cat <<'EOF'
╔══ ATLAS MINI-REPORT PROTOCOL (owner directive — MANDATORY) ═══════════════════╗
After EVERY Atlas task / mini-phase you complete, you MUST:
  1) Return the exact 12-section "# Claude Code Mini-Report"
     (format: .claude/atlas-mini-report-template.md). No vague summary; never just "done".
  2) Archive it: add src/NN-<slug>.md to
     Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/ then run `python build.py` and commit.
Do NOT start the next phase unless explicitly approved. End with the explicit stop statement.
╚═══════════════════════════════════════════════════════════════════════════════╝
EOF
exit 0
