# Put AutoPrint AI online with Render Free

This package is prepared for one **Free Web Service** that runs the React website and Flask backend together. You do not need separate frontend hosting, Docker on your computer, a payment gateway, or a Raspberry Pi for the demonstration. It has not yet been deployed into your Render account.

## 1. Put the extracted source on GitHub

1. Extract `AutoPrint_AI.zip` into a fresh folder so you keep your current local copy.
2. Open the inner `AutoPrint_AI` folder. It contains `Dockerfile`, `render.yaml`, `frontend`, `backend`, and `scripts`.
3. Create a new GitHub repository, for example `autoprint-ai-demo`. A private repository is fine if you allow Render to read it.
4. Upload the **contents of the inner folder**, not the ZIP itself. At the repository's top level you should see `Dockerfile` and `render.yaml`. Keep the folder structure.
5. Include `.dockerignore` and `.gitignore`. Do not upload your local `.env`, `node_modules`, virtual environment, or `backend/data`.

If you use Git in PowerShell, run these from that inner project folder after creating an empty GitHub repository. Replace the example repository address with your own:

```powershell
git init
git add .
git commit -m "Prepare AutoPrint AI for Render demo"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/autoprint-ai-demo.git
git push -u origin main
```

These commands are for a fresh extracted folder. If you are using an existing repository, commit and push the changes through your normal workflow instead.

## 2. Create the free service

1. Sign in to [Render](https://dashboard.render.com/).
2. Choose **New → Blueprint**, connect GitHub, and select your repository.
3. Use the `main` branch and the default Blueprint file path, `render.yaml`.
4. Render should show one service named `autoprint-ai-demo` on the **Free** instance. The file requests no paid disk or database.
5. When asked for `ADMIN_PASSWORD`, enter your own unique password of **at least 12 characters**. Keep it in your password manager. The username is `admin`; change `ADMIN_USERNAME` in the service's Environment settings if you prefer another name.
6. Create/deploy the Blueprint. Render generates `SECRET_KEY` automatically and builds the Docker image. The first build may take several minutes.
7. Wait until the service is **Live**, then open the exact website address shown in its dashboard. Render provides HTTPS and an `onrender.com` address.

There are no separate npm Build Command or Python Start Command fields to fill for this Docker deployment: the supplied Dockerfile handles both. Do not select Static Site; Flask needs a Web Service.

## 3. Try the demonstration

- Open the website. It should go directly to **New Print**.
- Upload a small PDF, review the analysis and print settings, and complete a **test** UPI/QR payment.
- Keep tracking open to watch the queue and printing animation, then try **Print another document**.
- Choose **Admin workspace**, or add `/admin/login` to the service address. Sign in with `admin` and the password you entered in Render.
- Open an admin subpage and refresh it. It should load correctly. Sign out, then revisit it to confirm that the login page appears.
- For a deployment health check, add `/healthz` to the service address; it should return `{"status":"ok"}`.

The current prototype gives each browser profile its own workspace. Use the same browser for uploading documents and demonstrating administration. An administrator in a different browser does not receive a combined queue of other visitors' jobs.

## If you prefer New → Web Service

Use this alternative only if you did not create the Blueprint:

| Render field | Value |
| --- | --- |
| Service type | Web Service |
| Repository / branch | Your repository / main |
| Language / runtime | Docker |
| Root Directory | Leave empty when `Dockerfile` is at the repository root |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context | `.` |
| Docker Command | Leave empty; use the Dockerfile's command |
| Instance Type | Free |
| Health Check Path | `/healthz` |

Add these Environment variables before deploying:

| Variable | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `SECRET_KEY` | A generated random secret of at least 32 characters |
| `ADMIN_USERNAME` | `admin` or your chosen username |
| `ADMIN_PASSWORD` | Your own password, at least 12 characters |
| `COOKIE_SECURE` | `true` |
| `DEMO_MODE` | `true` |
| `PRINT_MODE` | `simulation` |
| `ALLOW_TEST_PRINTING` | `false` |
| `DATA_DIR` | `/tmp/autoprint` |

To generate a session secret locally, run `python -c "import secrets; print(secrets.token_hex(32))"` and copy its result into Render's `SECRET_KEY` value. Keep that value stable across deployments. Do not paste it into source code or chat. Render supplies `PORT`; the server reads it automatically.

## Free service behavior

Render Free is suitable for this testing/demo use. As documented when this package was prepared:

- A service sleeps after 15 minutes without incoming traffic. The next visitor may wait about a minute while it starts. Open the site shortly before presenting.
- **Uploaded PDFs, jobs, prices, and other local SQLite data reset when the service sleeps, restarts, or redeploys.** Sample records are recreated for the next workspace request. This package uses temporary local storage to stay on the Free service.
- The workspace has 750 free instance hours per month, shared by its free web services. Bandwidth and build-minute limits also apply; check the account's usage page.
- Printing and payments remain simulated. Hosting the app does not connect it to a physical printer or enable real UPI payments.

See [Render's current free-service limits](https://render.com/docs/free) for details. Persistent document storage and a shared customer queue require a separate storage/account design; they are not included in this free demo configuration.

## Update the website later

Edit your local source, commit, and push to the linked GitHub branch. With Render auto-deploy enabled, it rebuilds the service. Otherwise choose **Manual Deploy → Deploy latest commit**. A deployment resets the demo's local data.

Keep secrets in Render's **Environment** page. To change the administrator password, update `ADMIN_PASSWORD` there and deploy/restart the service. To sign every existing session out, also rotate `SECRET_KEY`; this starts fresh browser workspaces.

## If deployment fails

| Symptom | What to check |
| --- | --- |
| Dockerfile or frontend lockfile not found | GitHub must contain extracted files with the same folder structure; the ZIP alone is not enough. |
| Startup says to set `SECRET_KEY` or `ADMIN_PASSWORD` | Fill the missing Environment value, respecting its required length, then redeploy. |
| `/healthz` returns 503 | The compiled frontend is missing. Use the supplied Dockerfile and inspect the frontend build logs. |
| Website starts after a delay | This is expected after a Free service has slept. |
| Jobs/PDFs disappeared | Free local storage was reset on sleep, restart, or redeployment. Upload demo files again. |
| Correct admin details fail | Check username and password in Render Environment, use the HTTPS address, and allow browser cookies. After ten login attempts, wait one minute. |
| Direct page refresh gives 404 | Confirm the service runs this Flask/Docker version and not a separately configured static deployment. |

## What changed in this package

- Added `Dockerfile`, `render.yaml`, `.dockerignore`, `.gitignore`, and the Gunicorn runtime configuration.
- Flask serves the compiled frontend, keeps `/api` on the same origin, and supports refreshed links to nested pages.
- Added `/healthz`, HTTPS proxy handling, production credential checks, admin session expiry, login throttling, and sign-out.
- Preserved your New Print first page, hidden settings/options, printing animation, highlighted queue/time, and Print another document link.
- Kept PDF.js at the patched `6.2.108` version. Docker installs the frontend dependencies without the unused root Worker tooling.

The frontend build, production dependency audit, workflow tests, and deployment tests passed during preparation. The browser preview could not reach the local test server in this environment. A Docker engine was unavailable, so the image itself and the live Render deployment still need Render's build and the checks above.

Official setup references: [Docker deployments](https://render.com/docs/docker), [Blueprint configuration](https://render.com/docs/blueprint-spec), and [Flask on Render](https://render.com/docs/deploy-flask).
