# FieldProof mobile

Expo + React Native application for technicians to sign in, view business jobs, and submit voice/photo captures to the FastAPI backend.

The mobile app and `frontend/` dashboard are both clients of the same FastAPI backend and database. Jobs refresh when a technician returns to the list and every 20 seconds while the list is active; the dashboard also refreshes in the background for asynchronous capture processing.

## Requirements

- Node.js 20 LTS or later
- Expo Go on a physical device, or Android Studio / Xcode for an emulator or simulator
- The FieldProof FastAPI server running and reachable from the device

## Install and run

```powershell
cd D:\projects\FieldProof\mobile
Copy-Item .env.example .env
npm install
npx expo start
```

Use `npm run android` for Android or `npm run ios` for iOS. The development server reads `EXPO_PUBLIC_API_URL` when it starts; restart Expo after changing `.env`.

## API URL configuration

Set `EXPO_PUBLIC_API_URL` in `.env` (no trailing slash):

| Target | API URL |
| --- | --- |
| Android emulator | `http://10.0.2.2:8000` |
| iOS simulator | `http://127.0.0.1:8000` |
| Android/iOS phone on the same Wi-Fi | `http://YOUR_COMPUTER_LAN_IP:8000` |

For a physical phone, start Uvicorn so it listens on the local network: `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Permit port 8000 through the computer firewall if prompted. `localhost` on a phone refers to the phone itself, not this computer.

On Android and iOS, the JWT is encrypted with Expo SecureStore. Secure storage is unavailable in a browser, so Expo Web keeps the token in `sessionStorage` for that browser session only.

## Backend setup

```powershell
cd D:\projects\FieldProof\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Demo technician login:

- Email: `marcus@meridianfieldworks.com`
- Password: `demo-password-123`

The owner demo login also works: `priya@meridianfieldworks.com` / `demo-password-123`.

## Capture behaviour

Each selected image and the optional voice note is sent separately as:

`POST /capture` multipart form data with `job_id`, `kind` (`voice` or `photo`), and `file`, plus `Authorization: Bearer <JWT>`.

The API responds immediately with `{ id, job_id, kind, status: "queued" }`. It has no endpoint to retrieve a capture’s processing status, so the app can accurately show upload completion/queueing but cannot show transcription or vision completion. Run Redis and a Celery worker to process submitted captures:

```powershell
cd D:\projects\FieldProof\backend
celery -A app.celery_app worker --loglevel=info
```

Without the worker, uploads are still stored locally by the backend but remain unprocessed.
