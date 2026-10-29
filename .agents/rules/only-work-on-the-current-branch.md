---
trigger: always_on
---

# Branch Protection Rule
- Only work on the current branch.
- NEVER run `git checkout main` or `git merge main`.
- NEVER push changes to the `main` branch.
- All commits and pushes must be made to the current feature branch only.
- always specify and mention which file and line in the file the suggested code change should be applied to.
- NEVER READ any .env files
