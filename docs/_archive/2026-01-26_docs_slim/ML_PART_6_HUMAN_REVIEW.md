# ML Part 6 - Human Review: Suggest, Edit, Undo (Never Auto-Apply)

Siddes' AI/ML goal is clerical work elimination without creating mis-post risk.

Winning pattern:
1) Suggest (local-first)
2) Let the user edit (remove members, rename, choose Side)
3) Apply only on Accept
4) Undo immediately after creation

Why:
- Misclassification is not just a model error - it is trust loss.
- Trust loss kills posting. Posting is the oxygen of a social graph.

UI affordances (implemented):
- Member chips with remove X
- Needs 2 members guard
- Side pills (chameleon law)
- Rename before Accept
- Undo after create (short window)

Telemetry (privacy-safe):
- suggestion_shown / accepted / skipped / edited / undo
Counts only. No handles. No contact identifiers.
\n\n## Backend support\n- Undo uses DELETE /api/circles/<id> (owner-only).\n