# Setup — The Dedicated Laptop, Windows Edition (Tier 5)

How to turn a Windows PC you already have into a 24/7 Finance agent runtime.

> **⚠️ v0.1 draft status.** This guide is the Windows parallel to [`SETUP_DEDICATED_LAPTOP.md`](./SETUP_DEDICATED_LAPTOP.md) (the Mac version). The Mac version has been tested end-to-end; this Windows version has not yet been validated on real hardware. Commands and paths follow Microsoft's documented conventions but expect to hit minor variations. Please file issues with anything that doesn't work as documented.

Estimated time: 90–120 minutes the first time (longer than Mac because Windows scheduling is more involved). Then it just runs.

This is the **Tier 5** deployment — your own hardware, your own data, no cloud bills.

The reference setup this doc was authored against:

- **Machine:** any Windows PC with ≥16 GB RAM and an SSD
- **OS:** Windows 11 Pro (Home edition works; Pro is recommended for Task Scheduler conveniences and remote desktop)
- **Other use:** occasional backup work laptop or spare desktop
- **Available to the agents:** ≥80% idle, plugged in 24/7

The Stack uses ~1–2 GB RAM at peak, single-digit % CPU outside scheduled run windows.

---

## Hardware checklist

What you need:

- **A Windows 10 or 11 PC** (Pro preferred for Task Scheduler ergonomics and Remote Desktop). Windows 11 ARM works but expect some Python/MCP package compatibility hiccups.
- **A stable wired Ethernet connection** if possible (or reliable Wi-Fi). Agents are useless if the network drops mid-close.
- **An external drive or cloud backup target** for `%USERPROFILE%\finance-data\`. (Reuse whatever the machine is already backing up to — File History or OneDrive both work.)
- **A power adapter that stays plugged in.** The PC should never run on battery during scheduled agent windows. Set "Sleep when plugged in" to "Never" in Power & Battery settings.

What you do **not** need:

- A second monitor permanently attached — once set up, Remote Desktop from your daily machine handles everything
- A new user account — your existing user works (more on this in Step 1)
- To wipe anything (the agents cohabit fine)

---

## Step 1 — Prepare the PC (cohabitation path)

### 1.1 — Free up resources (10 minutes)

Open **Settings → Apps → Installed apps** and uninstall anything you definitely don't need on this PC:

- Heavy creative apps the backup laptop doesn't need (Adobe Creative Cloud, video editors)
- Old development tools (Visual Studio editions you don't use, abandoned IDEs)
- Auto-launching utilities — open **Settings → Apps → Startup** and disable anything you don't recognize
- Bloatware from the OEM (manufacturer "support" apps, game launchers, trial software)

Goal: remove the obvious bloat. Reclaim 20–50 GB of disk and a few startup processes.

### 1.2 — System settings adjustments (5 minutes)

Open **Settings** and make these changes:

| Setting | Where | Value |
|---|---|---|
| **Sleep when plugged in** | System → Power & battery → Screen and sleep | **Never** |
| **Sleep when on battery** | same | 10–15 min (irrelevant when plugged in) |
| **Wake the device for tasks** | System → Power & battery → Additional settings | **On** (this enables Task Scheduler to wake the PC) |
| **Automatic updates** | Windows Update → Advanced options | Set **Active Hours** to a window that includes your agent schedules (e.g., 6 PM–9 AM) so updates don't reboot mid-run |
| **Sign-in options** | Accounts → Sign-in options | Set "If you've been away, when should Windows require you to sign in again?" → **Never** (only if security policy allows) |
| **Remote Desktop** | System → Remote Desktop | **On**; whitelist your daily-driver IP if you can |
| **Screen lock on idle** | Personalization → Lock screen | Set screen saver timeout to a long value (60+ min). Note: agents run in your user session, so the session must stay logged in. |

For corporate-managed laptops, some of these may be locked by policy. If you can't change "Sleep when plugged in", you'll need a workaround (e.g., a small `caffeinate`-equivalent script that prevents idle sleep — see [Step 10](#step-10--run-it-headless)).

### 1.3 — User account decision (2 minutes)

Same as Mac guide:

**Option A — Use your existing user (recommended).** Simpler, no extra account, existing backup picks up agent data automatically. The Stack lives at `%USERPROFILE%\the-ai-finance-stack\`; agent data at `%USERPROFILE%\finance-data\`.

**Option B — Create a dedicated `financeops` user.** Cleaner separation, easier to scope RDP access. Adds setup overhead.

For v0.1, pick Option A.

### 1.4 — Static internal IP (5 minutes)

Either pin via your router's DHCP reservation (preferred — set and forget) or set a static IP on the network adapter:

```
Settings → Network & Internet → [your adapter] → IP assignment → Edit → Manual → IPv4 ON → fill in static address
```

Note the IP — you'll use it for Remote Desktop from your daily machine.

---

## Step 2 — Install the runtime stack

### 2.1 — Install Git for Windows (5 minutes)

Download from [git-scm.com](https://git-scm.com/download/win). During install:

- Default editor: **Notepad** (or whatever you prefer)
- Path adjustment: **"Git from the command line and also from 3rd-party software"**
- Line endings: **"Checkout as-is, commit as-is"** (avoids accidental CRLF rewrites in committed files)
- Default branch name: **`main`**
- Git Bash + Git GUI: install both (you'll occasionally want Git Bash for Unix-y commands)

After install, open **PowerShell** and verify:

```powershell
git --version
```

### 2.2 — Install Python 3.11+ (10 minutes)

Download from [python.org](https://www.python.org/downloads/windows/). During install:

- **Check "Add python.exe to PATH"** (critical — this is unchecked by default)
- Check "Install for all users" if you'll use a dedicated user
- Default install path is fine

Verify in PowerShell:

```powershell
python --version    # should report 3.11 or higher
pip --version
```

### 2.3 — Install Node.js (5 minutes)

Download the LTS version from [nodejs.org](https://nodejs.org). Default install settings. After install, verify in PowerShell:

```powershell
node --version
npm --version
```

### 2.4 — Install Claude Code (5 minutes)

```powershell
npm install -g @anthropic-ai/claude-code
```

Verify:

```powershell
claude-code --version
```

### 2.5 — Install Wrangler (if you'll deploy registry updates from this machine) (3 minutes)

Optional — only needed if you'll push registry changes from the dedicated laptop. Most users do this from their daily-driver.

```powershell
npm install -g wrangler
```

### 2.6 — Set your Anthropic API key (2 minutes)

```powershell
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-…", "User")
```

Restart PowerShell. Verify:

```powershell
echo $env:ANTHROPIC_API_KEY
```

---

## Step 3 — Clone The AI Finance Stack

```powershell
cd $env:USERPROFILE
git clone https://github.com/sanjayraghavan/the-ai-finance-stack.git
cd the-ai-finance-stack
```

Verify the layout:

```powershell
Get-ChildItem
```

You should see `agents/`, `skills/`, `mcps/`, `customization-stub/`, etc.

---

## Step 4 — Set up the data and log directories

```powershell
mkdir $env:USERPROFILE\finance-data
mkdir $env:USERPROFILE\finance-data\closes
mkdir $env:USERPROFILE\finance-data\variance
mkdir $env:USERPROFILE\finance-data\ir
mkdir $env:USERPROFILE\finance-data\audit
mkdir $env:USERPROFILE\finance-logs
mkdir $env:USERPROFILE\.finance-stack
```

Lock down the secrets folder:

```powershell
icacls $env:USERPROFILE\.finance-stack /inheritance:r /grant:r "$env:USERNAME:F"
```

This restricts access to just your user. Equivalent to `chmod 700` on Mac.

---

## Step 5 — Configure your MCP connections

### 5.1 — Claude Code MCP config

Claude Code's config file on Windows lives at:

```
%APPDATA%\Claude\claude_code_config.json
```

(For Claude Desktop, the path is `%APPDATA%\Claude\claude_desktop_config.json` — note the different file name for the desktop vs. CLI client.)

Open the file (create if missing) and add the registry MCP plus your accounting / banking / Slack MCPs. Same JSON shape as on Mac.

### 5.2 — Run setup-org for customization

From Claude Code in the repo directory:

```
> run the setup-org skill
```

Walk through the 6 steps to populate `customization/` with your tagged CoA, non-GAAP rules, templates, voice samples. See [`customization-stub/README.md`](./customization-stub/README.md) for the full reference.

---

## Step 6 — Schedule your first agent with Task Scheduler

This is the biggest divergence from the Mac guide. Mac uses launchd `.plist` files; Windows uses Task Scheduler XML and PowerShell cmdlets.

### 6.1 — Create a PowerShell script that runs Controller

Create `%USERPROFILE%\the-ai-finance-stack\run-controller.ps1`:

```powershell
# Run Controller — invoked by Task Scheduler
$env:ANTHROPIC_API_KEY = [Environment]::GetEnvironmentVariable("ANTHROPIC_API_KEY", "User")
cd $env:USERPROFILE\the-ai-finance-stack
& claude-code agents/controller/CLAUDE.md *>> $env:USERPROFILE\finance-logs\controller.log
```

Make sure the file is saved with UTF-8 encoding (no BOM) — PowerShell scripts sometimes fail silently if Windows adds a BOM.

### 6.2 — Register the scheduled task

The Mac doc fires Controller at 5 PM on the last business day of each month, with subsequent passes on Day 1 (9 AM, 11 AM), Day 2 (9 AM), Day 3 (9 AM, 2 PM). Task Scheduler can replicate this but the cron-style "last business day" is awkward — we'll set a calendar-day trigger that fires daily but the agent checks "is today the last business day?" internally before doing work.

Easiest install path: register a single task that fires once daily at 5 PM, and let Controller's own logic decide whether today is the right day.

Open PowerShell as Administrator:

```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$env:USERPROFILE\the-ai-finance-stack\run-controller.ps1`""

$trigger = New-ScheduledTaskTrigger -Daily -At 5pm

$principal = New-ScheduledTaskPrincipal -UserID "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType S4U -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName "AIFinanceStack-Controller" `
  -Action $action -Trigger $trigger -Principal $principal -Settings $settings
```

Verify in Task Scheduler GUI (`taskschd.msc`) — you should see "AIFinanceStack-Controller" in the Task Scheduler Library.

To fire it immediately for a smoke test:

```powershell
Start-ScheduledTask -TaskName "AIFinanceStack-Controller"
```

Watch the log:

```powershell
Get-Content $env:USERPROFILE\finance-logs\controller.log -Wait
```

### 6.3 — Replicate the pattern for each agent

Repeat 6.1 + 6.2 for each agent you want scheduled: FP&A Analyst (Day 4 9 AM), Treasury (daily 8 AM), AR Follow-Up (daily 8 AM), AP Watcher (daily 9 AM), Bank Recon (daily 7 AM), etc. See each agent's `config.yaml` for its `schedule.cron` to translate.

We're building a helper script (`scripts/register-windows-tasks.ps1`) to register all agents in one shot — coming in a v0.2 update. For now, manual per-agent registration.

---

## Step 7 — Set up notifications

Slack works the same on Windows. Configure your Slack MCP per the existing instructions in agent READMEs.

Email notifications are platform-agnostic via SMTP. If you want OS-level toast notifications (Windows action center), use the `BurntToast` PowerShell module:

```powershell
Install-Module BurntToast -Scope CurrentUser
```

Then in `run-controller.ps1`, add:

```powershell
New-BurntToastNotification -Text "Controller", "Pass 2 complete — 9 accruals proposed"
```

Optional polish.

---

## Step 8 — Set up logging and rotation

Windows doesn't have `logrotate` natively. Two options:

**Option A: PowerShell logging cmdlets with built-in rolling.** Replace the `*>> file.log` redirect in your scripts with the `Tee-Object` + a daily-rolling filename:

```powershell
$logfile = "$env:USERPROFILE\finance-logs\controller-$(Get-Date -Format 'yyyy-MM-dd').log"
& claude-code … *>&1 | Tee-Object -FilePath $logfile -Append
```

**Option B: Schedule a cleanup task** that deletes logs older than 90 days:

```powershell
$cleanupAction = New-ScheduledTaskAction -Execute "PowerShell.exe" `
  -Argument "-NoProfile -Command `"Get-ChildItem $env:USERPROFILE\finance-logs -File | Where-Object {`$_.LastWriteTime -lt (Get-Date).AddDays(-90)} | Remove-Item`""
$cleanupTrigger = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -TaskName "AIFinanceStack-LogCleanup" `
  -Action $cleanupAction -Trigger $cleanupTrigger
```

---

## Step 9 — Verify end-to-end

1. **Manual smoke test:** `Start-ScheduledTask -TaskName "AIFinanceStack-Controller"`. Watch the log. Confirm a `#finance-ops` Slack message appears.

2. **Scheduled test:** wait for the next natural trigger (or temporarily set the trigger to a few minutes ahead to verify the schedule actually fires). Watch Task Scheduler History (right-click the task → History).

3. **Reboot test:** restart Windows. Verify Task Scheduler still has the task registered (`Get-ScheduledTask -TaskName "AIFinanceStack-*"`). Verify the task fires on its next scheduled trigger.

4. **Sleep test:** force the PC into sleep for 5 minutes, then check if a scheduled task that's due fires correctly. The `-WakeToRun` flag in Step 6.2 should handle this.

---

## Step 10 — Run it headless

Once verified, you want the PC to run unattended.

### 10.1 — Stay-awake protection

If "Sleep when plugged in: Never" was overridden by policy, install [`Caffeine for Windows`](https://github.com/zhaytam/Caffeine) or use the PowerShell equivalent in a startup script:

```powershell
# In a startup script — keeps system awake
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class Sleep { [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags); }
"@
[Sleep]::SetThreadExecutionState(0x80000003)   # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
```

### 10.2 — Lock the screen but keep the session

For physical security, lock the screen (`Win + L`) before walking away. Locking the screen does NOT log out the user — Task Scheduler tasks running as your user continue executing.

### 10.3 — Auto-start tasks on boot

Add this to your Task Scheduler tasks so they survive reboots (already covered in Step 6's `-StartWhenAvailable`):

```powershell
Set-ScheduledTask -TaskName "AIFinanceStack-Controller" `
  -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -WakeToRun)
```

### 10.4 — Monitor remotely

From your daily machine, Remote Desktop in (`mstsc.exe`) when you need to check on something. The agents run regardless of whether you're connected.

---

## What can go wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Task Scheduler shows "0x41301" (running) but no log output | Task is launching but the PowerShell script is failing silently — usually a path or BOM issue | Open PowerShell, run the script directly. Fix any errors. Re-save the script as UTF-8 *without* BOM. |
| Task fires but nothing posts to Slack | Slack MCP not loaded — Claude Code can't find the config | Verify `%APPDATA%\Claude\claude_code_config.json` exists and is valid JSON; restart Claude Code |
| Task doesn't fire at all on schedule | Sleep settings still kicking in OR Wake settings not enabled | Recheck Step 1.2 power settings; ensure `-WakeToRun` is set on the task |
| `claude-code` not found by Task Scheduler | npm global path not on Task Scheduler's PATH | Either hardcode the full path to `claude-code.cmd` in `run-controller.ps1`, or set `PATH` explicitly at the top of the script |
| Python MCP fails with `ModuleNotFoundError` | Python venv not activated, or wrong Python on PATH | Use a venv: `python -m venv ~/.finance-stack/venv` then `pip install` deps in it; reference the venv's Python in the script |
| Agent's working directory is wrong | Task Scheduler defaults to `C:\Windows\System32` | Add `-WorkingDirectory $env:USERPROFILE\the-ai-finance-stack` to the action, or `cd` at top of script (already done in our example) |

---

## Hardening (do once, then never think about it)

1. **Windows Firewall** — block inbound on everything except RDP (3389) and your specific MCPs that need ports
2. **BitLocker** — encrypt the drive. `manage-bde -on C:` (or via Settings UI). Especially important if the laptop ever travels.
3. **Standard user account** for daily login, Admin only for setup work — reduces blast radius if your daily session ever gets compromised
4. **OneDrive / File History backing up `%USERPROFILE%\finance-data\`** — your books are critical
5. **Microsoft account 2FA** — assumes the PC is signed into a Microsoft account; if it's local-only, this doesn't apply

---

## Differences from the Mac guide at a glance

| Concern | Mac | Windows |
|---|---|---|
| Scheduling | launchd `.plist` files in `~/Library/LaunchAgents/` | Task Scheduler tasks via `Register-ScheduledTask` |
| Claude Desktop config path | `~/Library/Application Support/Claude/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Code config path | `~/Library/Application Support/Claude/claude_code_config.json` | `%APPDATA%\Claude\claude_code_config.json` |
| Default shell for scripts | zsh | PowerShell |
| Stay-awake | `caffeinate` (built-in) | PowerShell `SetThreadExecutionState` or Caffeine for Windows |
| Remote access | SSH (`Settings → Sharing → Remote Login`) | Remote Desktop (`Settings → Remote Desktop`) |
| Log rotation | `logrotate` (Homebrew) | Daily Task Scheduler cleanup task or `Tee-Object` with date-stamped filenames |
| Backup target | Time Machine | File History or OneDrive |
| Auto-restart after power failure | macOS Energy preference | UEFI/BIOS "AC Power Recovery" setting |

---

## When to upgrade to better infrastructure

When the Stack is paying for itself and you want better reliability than a repurposed laptop, see the "When to upgrade" section in [`SETUP_DEDICATED_LAPTOP.md`](./SETUP_DEDICATED_LAPTOP.md#when-to-upgrade-to-better-infrastructure) (the Mac guide). The infrastructure options (NUC, Mac mini, Hetzner box, AWS Lightsail) are platform-agnostic — pick the one that matches your operational comfort.

---

*v0.1 draft. Needs validation on real Windows hardware. File issues at the repo with anything that doesn't match documented behavior.*
