# Firebase Setup Instructions

## 1. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Create a project"
3. Name: `ocr-pro-react`
4. Enable Google Analytics (optional)
5. Create project

## 2. Enable Authentication

1. In Firebase Console, go to Authentication
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Google" provider
5. Add authorized domains:
   - `localhost` (for development)
   - `ocr-pro-react.pages.dev` (for production)
   - `367bd595.ocr-pro-react.pages.dev` (current deployment)
   - `copilot-vscode1757945964163.ocr-pro-react.pages.dev` (branch deployment)

## 3. Add Admin User

1. Go to Authentication > Users
2. Click "Add user"
3. Email: `dev.yosefali@gmail.com`
4. Set as admin (assign custom claims if needed)

## 4. Generate Service Account

1. Go to Project Settings (gear icon)
2. Click "Service accounts" tab
3. Click "Generate new private key"
4. Download the JSON file
5. Extract the required fields:
   - `project_id`
   - `private_key` 
   - `client_email`

## 5. Web App Configuration

1. Go to Project Settings > General
2. Scroll to "Your apps"
3. Click "Web" icon to add web app
4. Name: `OCR Pro React`
5. Copy the Firebase config object

## 6. Environment Variables

Set these in your environment:

```bash
# Frontend (Vite)
VITE_FIREBASE_CONFIG='{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}'

# Backend (Cloudflare Workers)
JWT_SECRET=your_jwt_secret_here
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## 7. Cloudflare Configuration

Add to wrangler.toml:

```toml
[vars]
JWT_SECRET = "your_jwt_secret_here"
FIREBASE_ADMIN_PROJECT_ID = "your_project_id"
FIREBASE_ADMIN_CLIENT_EMAIL = "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"

[[env.production.vars]]
FIREBASE_ADMIN_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Note: FIREBASE_ADMIN_PRIVATE_KEY should be set as a secret in Cloudflare dashboard for security.

### Cloudflare Pages (CLI) — recommended

When deploying on Cloudflare Pages, set project variables and secrets with the Pages commands (the `[vars]` in `wrangler.toml` are not applied to Pages builds):

1) Confirm project name

```bash
npx wrangler pages project list
# Expect: ocr-pro-react
```

2) Set secrets (will prompt for the value)

```bash
# Multiline PEM, paste exactly as-is
npx wrangler pages secret put FIREBASE_ADMIN_PRIVATE_KEY --project-name ocr-pro-react

# Optionally scope to production environment
# npx wrangler pages secret put FIREBASE_ADMIN_PRIVATE_KEY --project-name ocr-pro-react --environment production
```

3) Set variables used by Pages Functions

```bash
npx wrangler pages project variable put JWT_SECRET --project-name ocr-pro-react
npx wrangler pages project variable put FIREBASE_ADMIN_PROJECT_ID --project-name ocr-pro-react
npx wrangler pages project variable put FIREBASE_ADMIN_CLIENT_EMAIL --project-name ocr-pro-react

# Optional: scope to a specific environment
# npx wrangler pages project variable put JWT_SECRET --project-name ocr-pro-react --environment production
# npx wrangler pages project variable put FIREBASE_ADMIN_PROJECT_ID --project-name ocr-pro-react --environment production
# npx wrangler pages project variable put FIREBASE_ADMIN_CLIENT_EMAIL --project-name ocr-pro-react --environment production
```

4) Set frontend build variable (Vite)

```bash
# Paste the exact JSON you copied from Firebase web app settings (single line)
npx wrangler pages project variable put VITE_FIREBASE_CONFIG --project-name ocr-pro-react

# For production-only value
# npx wrangler pages project variable put VITE_FIREBASE_CONFIG --project-name ocr-pro-react --environment production
```

5) Redeploy so changes take effect

```bash
# If using Git integration, push a commit to trigger a build

# Or build locally and deploy the dist folder
pnpm build
npx wrangler pages deploy ./dist --project-name ocr-pro-react
```

## 8. Test Configuration

1. Deploy the app with new environment variables
2. Test Google OAuth login
3. Verify JWT token validation
4. Check user-specific data isolation

## Production Deployment Checklist

- [ ] Firebase project created
- [ ] Google OAuth enabled
- [ ] Admin user added (dev.yosefali@gmail.com)
- [ ] Service account generated
- [ ] Environment variables configured
- [ ] Cloudflare secrets set
- [ ] App deployed and tested