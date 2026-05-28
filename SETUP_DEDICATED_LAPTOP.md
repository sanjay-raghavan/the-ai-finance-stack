# Setup — The Dedicated Laptop (Tier 5)

How to turn a Mac you already have into a 24/7 Finance agent runtime. Estimated time: 90 minutes the first time, then it just runs.

This is the **Tier 5** deployment from the *AI-Powered Finance* deployment framework — your own hardware, your own data, no cloud bills, no third-party risk on the agent runtime itself.

This guide is written for the most common case: a Mac you don't use daily but want to keep functional for occasional other duty (a backup work laptop, a hand-me-down family machine, a spare). The agents will **cohabit** with whatever else is on the machine; you don't need to wipe anything.

The reference setup this doc was authored against:

- **Mac model:** MacBook Pro M3 Max, 36 GB RAM
- **macOS:** latest (Sequoia or newer)
- **Other use:** occasional work backup laptop, infrequently active
- **Available to the agents:** the machine is otherwise idle 95% of the time

The Stack uses ~1–2 GB RAM at peak, single-digit % CPU outside scheduled run windows. On an M3 Max you won't notice it.

---

## Hardware checklist

What you need:

- **A Mac running Apple Silicon** (M1/M2/M3/M4 series). Intel works but skip the homebrew install commands for Apple Silicon paths.
- **A stable network connection** (Ethernet if possible; reliable WiFi acceptable). Agents are useless if the network drops mid-close.
- **An external drive or Time Machine target** for backing up `~/finance-data/`. (Reuse whatever the machine is already backing up to.)
- **A power adapter that stays plugged in.** The Mac should never run on battery during scheduled agent windows. Lid-closed-while-plugged-in is fine; sleep is the enemy.

What you do **not** need:

- A second display, keyboard, or mouse permanently attached — once set up, SSH from your daily machine handles everything
- A new user account — your existing user is fine (more on this in Step 1)
- To wipe anything (unless you genuinely want to; see *Appendix A — clean slate path* at the bottom of this doc)

---

## Step 1 — Prepare the Mac (cohabitation path)

Skip nothing here, but most steps take <2 minutes.

### 1.1 — Free up resources (10 minutes)

The M3 Max has plenty of horsepower, but you still want fewer background apps competing for cycles when the agents are running. Open Applications and delete or move to a backup drive anything you definitely don't need on this machine:

- **Heavy creative apps** the backup laptop doesn't need (Adobe Creative Cloud, Final Cut, Logic, etc.)
- **Old development tools** you've forgotten about (Xcode if you don't use it, abandoned IDEs, ancient simulators)
- **Streaming / media apps** that auto-launch (Spotify desktop, Plex Server, etc.)
- **Cloud sync clients** for accounts you don't actively use on this machine (Dropbox, OneDrive, Box if you're not actively syncing here)
- **Auto-start utilities** you don't recognize — check System Settings → General → Login Items

Anything you're unsure about: leave it. The goal is to remove the obvious bloat, not to achieve a minimalist setup. Reclaiming 20–50 GB of disk and a few login-item processes is the whole win.

### 1.2 — System settings adjustments (5 minutes)

Open **System Settings** and make these changes:

| Setting | Where | Value |
|---------|-------|-------|
| **Prevent automatic sleeping** | Battery → Options (or Energy Saver on older macOS) | ON, set to "Always when plugged in" |
| **Turn display off after** | Battery / Lock Screen | 10 minutes is fine (the display turning off is OK; sleep is not) |
| **Wake for network access** | Battery → Options | ON |
| **Start up automatically after a power failure** | Battery → Options (Mac mini) or General (laptops) | ON if available |
| **Automatic updates** | General → Software Update → Automatic Updates | Security updates: ON. macOS major versions: OFF (you control upgrades) |
| **Remote Login (SSH)** | General → Sharing → Remote Login | ON; restrict to specific users (your user only) |
| **Screen Saver lock** | Lock Screen | "Require password after sleep" — set to "Never" while plugged in (the machine shouldn't be locking out the agents) |

For a backup work laptop where security policy matters, keep the screen-saver lock on — just make sure the agents don't depend on an unlocked GUI session. Claude Code runs headless, so this is fine.

### 1.3 — User account decision (2 minutes)

Two choices:

**Option A — Use your existing user (recommended for the M3 Max backup-laptop case).** Simpler, no extra account to maintain, your existing Time Machine backup picks up the agent data automatically. The Stack lives under `~/the-ai-finance-stack/`; the agent data under `~/finance-data/`.

**Option B — Create a dedicated `financeops` user.** Cleaner separation, easier to grant SSH access to just this user, audit logs are unambiguous. Adds 30 minutes of setup overhead. Only worth it if you're paranoid about scoping or anticipate other people SSHing into the machine.

For v0.1, pick Option A. You can graduate to Option B later by copying the Stack folder across users.

### 1.4 — Static internal IP (5 minutes)

You'll be SSHing into this Mac from your daily driver. Easiest way to always reach it:

- In your router's admin, find this Mac in the connected-devices list
- Reserve its IP (DHCP reservation) so it always gets the same address (e.g., `192.168.1.50`)
- Optionally: alias that IP in your daily Mac's `~/.ssh/config`:
  ```
  Host finance-runtime
    HostName 192.168.1.50
    User <your-username>
  ```
  Then `ssh finance-runtime` from anywhere on the local network.

### 1.5 — Confirm Remote Login works

From your daily driver, try the SSH:

```bash
ssh <your-username>@192.168.1.50
```

You should land on the Mac's shell. If not — re-check Step 1.2 Remote Login setting.

---

## Step 2 — Install the runtime stack

SSH in from your daily-driver Mac:

```bash
ssh financeops@<your-mini-ip>
```

Then:

```bash
# Homebrew (if not already)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Python 3.12 (default; use whatever's current at time of setup)
brew install python@3.12

# Claude Code
brew install claude-code   # if available via brew at time of reading
# OR install from https://claude.com/code per the official docs

# Git
brew install git

# Useful CLI tools
brew install jq yq ripgrep

# tmux (for keeping things alive during interactive setup)
brew install tmux
```

Verify:

```bash
python3 --version    # 3.12.x
claude --version      # whatever the latest is
git --version
```

---

## Step 3 — Clone The AI Finance Stack

```bash
cd ~
git clone https://github.com/<your-username>/the-ai-finance-stack.git
cd the-ai-finance-stack
```

If you haven't pushed to GitHub yet, you can copy the folder over from your daily-driver Mac via `scp`:

```bash
# on your daily-driver Mac
scp -r "~/Documents/Claude/Projects/Learning AI for Finance/the-ai-finance-stack" finance-runtime:~/
```

(Assumes you set up the `finance-runtime` SSH alias in Step 1.4. If not, use `<your-username>@192.168.1.50` instead.)

---

## Step 4 — Set up the data and log directories

```bash
mkdir -p ~/finance-data/{closes,variance,cash,fraud,reconciliations,reports}
mkdir -p ~/finance-logs
chmod 700 ~/finance-data ~/finance-logs
```

The `chmod 700` matters: this is sensitive Finance data. Only your user should be able to read it — other accounts on the same machine (if any) get nothing.

---

## Step 5 — Configure your MCP connections

For each MCP your agents need (QuickBooks, Slack, Gmail, etc.), set up the connection per the MCP's documentation. Most use OAuth or API keys.

**Store secrets in macOS Keychain, not in files.** Example:

```bash
# Store the Anthropic API key
security add-generic-password -a "$USER" -s "anthropic-api-key" -w "sk-ant-..."

# Retrieve it in an agent script
security find-generic-password -a "$USER" -s "anthropic-api-key" -w
```

A `~/.finance-stack/secrets.env` file is a fallback if Keychain integration isn't worth setting up yet, but Keychain is the right answer.

---

## Step 6 — Schedule your first agent with launchd

macOS uses `launchd` (not cron) for native scheduling. cron works but launchd is the macOS-native path and handles wake-from-sleep correctly.

Create `~/Library/LaunchAgents/com.theaifinancestack.close-orchestrator.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.theaifinancestack.close-orchestrator</string>

  <key>ProgramArguments</key>
  <array>
    <string>/Users/<your-username>/the-ai-finance-stack/runtime/run-agent.sh</string>
    <string>close-orchestrator</string>
  </array>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Day</key>
    <integer>1</integer>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>

  <key>StandardOutPath</key>
  <string>/Users/<your-username>/finance-logs/close-orchestrator.out.log</string>

  <key>StandardErrorPath</key>
  <string>/Users/<your-username>/finance-logs/close-orchestrator.err.log</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.theaifinancestack.close-orchestrator.plist
launchctl list | grep theaifinancestack    # confirm it's loaded
```

Test it manually:

```bash
launchctl start com.theaifinancestack.close-orchestrator
tail -f ~/finance-logs/close-orchestrator.out.log
```

The actual `run-agent.sh` helper script lives in `runtime/` — it's what wraps the `claude` CLI invocation with the right working directory and env vars.

---

## Step 7 — Set up notifications

You want to know **when an agent runs**, **when it surfaces something**, and **when it errors**. Three categories, three signals.

The cleanest pattern: every agent posts to Slack on every run. Critical alerts go to a separate channel with `@channel` tags.

If you don't use Slack, Telegram is a free alternative — see the future Post 38 (Telegram Integration) in the curriculum.

A simple notification helper (in `runtime/notify.py`) wraps Slack/Telegram so agents don't need to know which is in use.

---

## Step 8 — Set up logging and rotation

Logs grow forever if you don't rotate them. Use `newsyslog` (macOS built-in):

Create `/etc/newsyslog.d/the-ai-finance-stack.conf`:

```
# logfilename                                  [owner:group]  mode count size when  flags
/Users/<your-username>/finance-logs/*.log           financeops:staff 644  7     5000 *    JN
```

This keeps 7 rotations of each log, capped at 5MB, rotated whenever a log hits the size.

---

## Step 9 — Verify end-to-end

Test the full pipeline with a one-off dry run:

```bash
cd ~/the-ai-finance-stack
./runtime/run-agent.sh close-orchestrator --dry-run
```

A `--dry-run` invocation should:
- Load the agent
- Connect to all required MCPs (and report any failures)
- Walk through the close steps in "preview" mode without writing anything to systems of record
- Save the preview output to `~/finance-data/closes/dry-run/`
- Post a "DRY RUN" message to Slack

If that works end-to-end, you're ready to let the scheduled runs go live.

---

## Step 10 — Run it headless

Disconnect the keyboard, mouse, and display. Mount the Mac on a shelf with good ventilation. SSH in from your daily machine whenever you want to check on it.

Set a calendar reminder for **once a week** to:

1. SSH in
2. Check `~/finance-logs/` for any errors
3. Verify `launchctl list | grep theaifinancestack` shows all agents loaded
4. Check disk usage (`df -h`)
5. Verify the last run of each scheduled agent in Slack

That's it. It's a server now.

---

## What can go wrong

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Agent didn't run at its scheduled time | Mac was asleep | Verify sleep is fully disabled; check launchd logs |
| Agent ran but produced nothing | MCP connection failed | Re-auth the MCP; check `~/finance-logs/<agent>.err.log` |
| Slack messages stopped | Slack token rotated/expired | Re-issue the token in Slack, update in Keychain |
| Agent hangs | Claude Code waiting on a prompt | All agent invocations should use `--non-interactive` / `--yes-to-all` flags |
| Disk full | Logs not rotating | Check newsyslog config; manually rotate to recover |
| The Mac rebooted and nothing came back | launchd agent not set to RunAtLoad | Add `<key>RunAtLoad</key><true/>` to the plist |

---

## Hardening (do once, then never think about it)

- **Backup**: Time Machine to an external drive, snapshotting `~/finance-data/` and `~/finance-logs/`. If the machine is already on a Time Machine schedule, the agent data inherits it automatically.
- **Firewall**: Enable macOS firewall, allow only SSH from your daily-driver IP
- **Disk encryption**: FileVault on (likely already on for a work-issued backup laptop)
- **No screen sharing**: Disable VNC / Screen Sharing in System Settings
- **No file sharing**: Off
- **No printer sharing**: Off
- **Anti-tamper**: Keep the Mac in a physically reasonable place (your home office, not a coworking-space common area). For a personal backup laptop on a shelf in your home, this is moot.

---

## Appendix A — The clean-slate path (optional)

If you want to wipe and start over (e.g., the backup laptop has accumulated cruft, or you'd rather not have any non-Finance Stack software on it), the steps differ slightly:

1. **Back up first.** Time Machine to an external drive. If this is a work-issued backup laptop, confirm with IT before wiping — there may be MDM enrollment to consider.
2. **Wipe via macOS Recovery.** Boot into Recovery (hold the power button on Apple Silicon), Disk Utility → erase the volume, then Reinstall macOS.
3. **Initial setup.** Sign in with an Apple ID or skip (local-only account is fine for a runtime).
4. **Create a single user account** named whatever you like — `financeops` makes the audit trail unambiguous, but it's not required.
5. **From here, follow the cohabitation path** (Steps 1.2 onward) — you're now in the same state as a freshly cohabited machine, just with no other apps installed.

The clean-slate path adds ~2 hours but gives you a Mac that does literally one thing. Useful for fully-dedicated rigs. Skip for the M3 Max backup-laptop case unless you're feeling fastidious.

---

## When to upgrade to better infrastructure

You'd graduate from "old MacBook on a shelf" to something more enterprise-grade if:

- You're processing financial transactions through the agents (vs. reading from them) — then a cloud VM with better SLA matters
- The Finance team grows beyond one person and others need access
- You're handling regulated data that requires SOC 2 / ISO 27001 controls
- You want failover / HA

For v0.1 — none of those apply. An old laptop on a shelf is the right answer.
