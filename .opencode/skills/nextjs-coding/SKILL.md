---
name: nextjs-coding
description: Guidelines for modifying this Next.js e-commerce project safely, including Windows memory and resource safety for builds, tests and dev servers.
---

# Coding Rules

- Follow the existing project architecture.
- Use TypeScript and the App Router conventions.
- Inspect existing code before modifying files.
- Avoid unrelated changes.
- Run appropriate checks after changes.
- Document all changes and why they were made in README.md.
- don't commit any code wait for approval, but provide a recommended commit message after the task end and after the task final tests.
- never seed to the database. 
- never run npm run seed.
- Don't Pull any Enviroment variables from varcel , don't read any secrets or API values.

## Windows Memory and Resource Safety

Check memory before and after any memory-heavy operation (`next build`, full test suite, `npm install`, or starting a dev server).

1. Run only one heavy process at a time. Never run a build, full test suite, install or dev server in parallel with each other, and never while a dev server is already running.
2. Check free RAM with PowerShell first:

   ```powershell
   Get-CimInstance Win32_OperatingSystem |
       Select-Object @{Name="TotalRAM_GB";Expression={[math]::Round($_.TotalVisibleMemorySize / 1MB, 2)}},
                     @{Name="FreeRAM_GB";Expression={[math]::Round($_.FreePhysicalMemory / 1MB, 2)}}
   ```

3. If free RAM is under 2 GB, stop and inform the user before proceeding.
4. Prefer targeted tests and incremental builds over full suites.
5. Do not background a command without checking whether an equivalent process is already running.
6. If a command hangs or memory spikes, stop safely, capture the process and memory details, and report before retrying. Never repeatedly retry a command that freezes or gets killed.
7. Never kill unrelated processes or use broad kill commands without identifying the exact target.
8. Do not change virtual memory settings, delete project files, or modify dependencies as a memory workaround without the user's approval.
9. After a heavy operation, confirm it completed and that memory pressure has returned to normal.

Checking memory does not guarantee the machine will not freeze; if RAM is tight, pause and ask for permission.
