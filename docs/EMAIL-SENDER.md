# Apps Script Email Sender — free Reply.io replacement (sending leg)

`sender/` is a self-contained, Google-native scheduled email sender: a **Google
Apps Script web app** (`Code.gs`) that drafts and sends from *your* Gmail /
Workspace account on Google's servers, plus a **zero-dependency Python CLI**
(`gmail_pipeline.py`) that validates, chunks, and submits batches to it.

Why it exists: the engine's outreach leg currently rides on Reply.io
(~$800/yr). For the *sending* part of that job — personalized one-off emails,
scheduled per-recipient at their local morning, with attachments — a Gmail
account you already own can do the work for $0. This module is the bring-your-
own-sender the roadmap promises: your agent writes the batch JSON (the
language work), the sender does everything mechanical.

```
agent writes batch.json ──> gmail_pipeline.py submit ──> Apps Script web app
                                                          │  creates real Gmail drafts NOW
                                                          │  (attachments pulled from Drive / POST)
                                                          └─ time-based triggers send at send_at
                                                             — laptop off, Google's servers do it
```

**What it is not:** a sequencer with open/click tracking or reply detection.
Reply.io still does those. This replaces the *scheduled sending* leg; replies
land in the same Gmail inbox where your reply-handling (or you) already live.

---

## Deploy (one-time, ~5 min)

Do this in the Google account the emails should be sent **from**.

1. Generate a secret locally and copy it:
   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(24))"
   ```
2. Open **script.google.com** → **New project** (name it e.g. `email-sender`).
3. Paste all of `sender/Code.gs` over the default code. Save. No code edits needed.
4. **Project Settings → Script properties**:
   - `SECRET` = the string from step 1 (required)
   - `FROM_NAME` = display name for outgoing mail (optional)
   - `DEFAULT_ATTACHMENT_FILE_ID` = Drive file ID to attach to every email
     (optional — e.g. a one-pager; omit for no default attachment)
5. Left sidebar **Services → + → Gmail API → Add** (the Advanced Gmail Service;
   used to send drafts).
6. **Deploy → New deployment → Web app**: Execute as **Me**, access **Anyone
   with the link** → Deploy → authorize (Advanced → Go to … (unsafe) → Allow —
   it's your own script). Copy the **`/exec` URL**.
7. **Required safety net**: in the editor's function dropdown pick
   `installDailySweep` → **Run**. This installs a daily ~7 AM sweep that
   delivers any batch whose one-shot trigger was lost (quota, crash, race).
8. Point the CLI at it and test:
   ```bash
   cd sender
   python3 gmail_pipeline.py init --url '<the /exec URL>'   # prompts for the secret
   python3 gmail_pipeline.py ping                           # -> pong from <your account> (server v4)
   ```

Redeploying after a `Code.gs` change: **Deploy → Manage deployments → ✏️ →
Version: New version → Deploy** (URL, secret, and properties are unchanged).
Rotating the secret or swapping the default attachment is a Script-properties
edit only — no redeploy.

---

## Daily use

```bash
# 1. your agent generates batch.json: [{to, subject, body, firm?, send_at?}, ...]

# 2. submit — --tracker is the recontact guard (addresses already in the CSV
#    are a HARD error); skipping it must be explicit via --no-tracker-check
python3 gmail_pipeline.py submit --batch batch.json \
    --send-at "2026-08-01 08:00" --tz CT --label aug01 \
    --tracker campaign-tracker.csv

# per-email send times (e.g. each recipient's local ~9 AM): put "send_at" on
# each record — "2026-08-01 09:00 ET" — and omit --send-at

# 3. any time later
python3 gmail_pipeline.py status              # batches: pending/sent/failed/sent_assumed
python3 gmail_pipeline.py status --verbose    # per-recipient + errors
python3 gmail_pipeline.py cancel --batch-id bXXXX --trash-drafts
python3 gmail_pipeline.py send-now --batch-id bXXXX
```

- **Times**: `"2026-08-01 08:00" --tz CT` · ISO with offset · relative `+10m`.
  Aliases `ET/CT/MT/PT` are DST-aware per the actual date; `CDT/EST/...` force
  a fixed offset.
- **Attachments**: `--attach FILE` (repeatable, ≤10 files, ≤22 MB decoded
  total) attaches to every email in the batch, on top of / instead of the
  default Drive attachment (`--no-default-attach` turns that one off).
- **Bodies** are sent as plain text + a rich-text (HTML) alternative so
  recipients don't see hard-wrapped "boxed" text; `--plain` disables the HTML
  part. URLs become links.
- **Validation** blocks before anything is submitted: duplicate recipients,
  unfilled placeholders (`{First Name}`, `<NAME>`, `[Firm]`, empty greeting),
  send times in the past, subjects with newlines, bodies under 200 chars, and
  tracker recontacts.
- `convert` turns tracker-style JSON rows into a batch with per-recipient
  local-morning send times (see `--help`).

## Reliability model (why you can trust it with a real campaign)

- **Idempotent submits.** Every chunk carries a `client_key` derived from
  recipients + copy + attachments + flags. Retrying a timed-out or crashed
  submit can never double-send; changed options produce a new key on purpose.
- **Incremental receipts.** `sender/receipts/` gets the server receipt after
  every chunk, a `remainder-*.json` with exactly the un-submitted emails if a
  submit dies mid-way, and a `failed-*.json` for per-recipient draft failures —
  each with printed recovery steps.
- **Rescue triggers + daily sweep.** The send handler arms a rescue trigger
  before touching anything, quarantines corrupt batch records instead of dying,
  persists state after every single send, and the daily sweep re-delivers
  anything a lost trigger stranded.
- **`sent_assumed`** means the draft was gone at send time (sent manually or by
  an earlier crashed run) — check Gmail Sent before re-sending anyone.
- Everything is visible: the drafts it creates are ordinary Gmail drafts, so
  the fallback when anything is unclear is just… looking at Gmail.

## Honest limitations

- **Gmail sending quotas apply**: roughly 500 recipients/day for consumer
  Gmail, ~2,000/day for Google Workspace. Fine for boutique-scale outreach;
  not a bulk platform.
- **Deliverability is your account's reputation.** New accounts should ramp
  volume gradually; a custom-domain Workspace sender beats a bare Gmail for
  sustained campaigns.
- **No open/click tracking and no reply detection** — pair with inbox-side
  tooling if you need those.
- Apps Script quotas cap a single POST at 30 emails (the CLI chunks
  automatically) and Script Properties at 500 KB (old records self-purge after
  7 days).

## Local testing without deploying anything

```bash
python3 sender/mock_server.py &                # fake web app on 127.0.0.1:8787
EMAIL_SENDER_CONFIG=/tmp/sender-test.json \
python3 sender/gmail_pipeline.py init --url http://127.0.0.1:8787/exec --secret testsecret-123
EMAIL_SENDER_CONFIG=/tmp/sender-test.json \
python3 sender/gmail_pipeline.py submit --batch sender/fixtures/batch.example.json \
    --send-at "+10m" --label smoke --no-tracker-check --yes
```

The mock implements the full POST contract (idempotency included; a recipient
whose local part starts with `faildraft` simulates a per-email draft failure).
For a real smoke test, edit `sender/fixtures/batch.example.json` to your own
addresses and submit against the deployed URL.

## Security notes

- The secret lives in Script Properties (cloud) and `~/.config/apps-script-email-sender/config.json`
  (local, 0600) — never in code or the repo. `init` without `--secret` prompts
  with hidden input, keeping it out of shell history.
- Leak response: change `SECRET` in Script Properties (instant, no redeploy) and
  re-run `init` locally.
- URL without the secret gets `auth failed` and nothing else. The server
  re-validates recipient format (comma-injection guard) and only ever attaches
  the Drive file configured server-side — the request can't point it at
  arbitrary Drive files.
