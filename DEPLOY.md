# Deploying GATE DA Companion for daily personal use

**What you need from a host:** it must run a Python/Docker app **and** keep a disk that survives restarts
(your progress, notes, study time and flashcards live in `data/`). Static hosts (Netlify, Vercel, GitHub Pages)
and *free* web instances (e.g. Render Free) cannot do this: your data would be wiped.

| Option | Cost | Effort | Notes |
|---|---|---|---|
| **A. Render (recommended)** | about $7 per month for the always-on Starter instance, plus about $0.25 per GB per month for the disk (1 GB is plenty) | 15 min, no server skills | Auto-HTTPS, auto-deploy when you push changes |
| **B. Oracle Cloud free VM** | $0 (needs a card for sign-up) | 45 min, some terminal use | Free, but Oracle can reclaim idle free VMs and has changed its free limits before |

Prices were checked in October 2026 and change often; confirm on the provider's pricing page before you pay.

Whichever you pick, do these two things: **set `APP_PASSWORD`** (otherwise anyone who finds the link can spend your AI key),
and **download a backup now and then** (Settings > Your data & backup).

---

## Option A: Render (step by step)

### 1. Put the project on GitHub (once)
1. Make a free account at github.com and create a **new private repository** named `gate-da-companion` (no README).
2. Install Git (git-scm.com). Unzip the project, open a terminal **inside the unzipped folder**, and run:
   ```
   git init
   git add .
   git commit -m "first version"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/gate-da-companion.git
   git push -u origin main
   ```
   (`.gitignore` already keeps `data/`, `.env` and keys out of the repo.)

### 2. Create the service on Render
1. Sign up at render.com with your GitHub account and add a payment method.
2. **New > Blueprint** > choose your `gate-da-companion` repo. Render reads `render.yaml`
   (Docker service, 1 GB disk mounted at `/app/data`, health check).
3. When asked for environment variables, fill in:
   - `APP_PASSWORD`: a long password you will remember
   - `GEMINI_API_KEY` (free key from aistudio.google.com/apikey), **or** `ANTHROPIC_API_KEY`.
     You can also leave both empty and paste the key in the app's Settings instead.
4. Click **Apply**. The first build takes a few minutes. Your address will look like
   `https://gate-da-companion-xxxx.onrender.com`.

### 3. First use
1. Open the address. The browser asks for a login: username = anything, password = your `APP_PASSWORD`.
2. Go to **Settings & API key** > pick the provider > (paste key if you didn't set the variable) > **Save** > **Test AI connection**.
3. **Phone:** open the address in Chrome (Android: menu > *Add to Home screen* / *Install app*) or Safari (iPhone: Share > *Add to Home Screen*). It then opens like an app.

### 4. Daily life
- Just open it and study. Everything you tick, write or time is saved on the Render disk.
- **Update the app later** (new version of the files): copy the new files over the folder, then
  `git add . && git commit -m "update" && git push`. Render redeploys automatically and keeps your data.
- **Backups:** Settings > *Download backup* (a zip). The server also keeps 14 daily snapshots in `data/backups`.
  To move to another server: deploy it there, then Settings > *Restore from backup*.

### Troubleshooting
- *"Not Found" or build fails:* check the Render logs; make sure `web/` (the built app) is in your repo.
- *Data vanished after deploy:* the disk is not attached. In Render > your service > **Disks**, it must be mounted at `/app/data`. Restore from your backup zip.
- *Asks for password every time:* normal for browser Basic-auth if you clear cookies; let the browser save it.

---

## Option B: Oracle Cloud free VM (own server, with HTTPS)

1. **Sign up** at oracle.com/cloud/free (a card is needed for verification). Pick a home region close to you.
2. **Create a VM:** Compute > Instances > Create. Image: **Ubuntu 24.04**. Shape: **Ampere (VM.Standard.A1.Flex)**
   with 1 OCPU / 6 GB RAM (more than enough). Download the SSH key it offers. If it says "out of capacity", try again later or another availability domain.
3. **Open the web ports:** Networking > your VCN > Security Lists > Default > *Add Ingress Rules*:
   source `0.0.0.0/0`, TCP, destination ports `80` and `443`.
4. **Free address:** at duckdns.org sign in, create a name like `mystudy`, and set its IP to your VM's public IP.
   Your address will be `mystudy.duckdns.org`.
5. **Connect** (replace the key path and IP): `ssh -i path/to/key ubuntu@VM_IP`
6. **Install Docker and open the firewall** on the VM:
   ```
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker ubuntu && newgrp docker
   sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
   sudo apt-get install -y iptables-persistent   # answer Yes to save the rules
   ```
7. **Copy the project** to the VM (from your computer): `scp -i path/to/key -r gate_da_companion ubuntu@VM_IP:~/`
8. **Configure and start** (on the VM):
   ```
   cd ~/gate_da_companion
   cp .env.example .env
   nano .env        # set APP_PASSWORD, DOMAIN=mystudy.duckdns.org, and your API key (or add it later in Settings)
   docker compose up -d --build
   ```
9. Open `https://mystudy.duckdns.org` (the first load may take a minute while Caddy gets the HTTPS certificate).
10. **Keep it alive:** Oracle may reclaim VMs that sit idle for 7 days. Using the app daily helps; also keep a backup zip.
11. **Update later:** copy new files over with `scp`, then `docker compose up -d --build`. Your data stays in `~/gate_da_companion/data`.

> Without a domain name you cannot get HTTPS, and the password would travel unencrypted. Use the DuckDNS name.

---

## Run locally instead (no hosting)
`run.bat` (Windows) or `./run.sh` (Mac/Linux). Data stays in `data/` on your computer. This is free and private,
but only works on that computer.
