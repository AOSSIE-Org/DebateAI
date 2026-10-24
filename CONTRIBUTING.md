# Contributing to DebateAI

Thank you for your interest in contributing to **DebateAI**! We welcome contributions of all kinds—from fixing bugs and adding new features to improving documentation, writing automated tests, or optimizing performance.

This document outlines the guidelines and step-by-step instructions for getting started, running the project locally (using Docker or manual setup), and submitting your contributions.

---

##  Community & Discussion

If you have questions, feedback, or want to discuss ideas before building:
- **AOSSIE Discord Server:** [https://discord.gg/hjUhu33uAn](https://discord.gg/hjUhu33uAn)
- **Discord Channel:** `#AI for Debate` channel in the [AOSSIE Server](https://discord.com/channels/1022871757289422898/1312986807914463252)
- **GitHub Issues:** [https://github.com/AOSSIE-Org/DebateAI/issues](https://github.com/AOSSIE-Org/DebateAI/issues)

---

##  Prerequisites

Before you start, ensure you have installed:

| Tool | Version / Requirement | Notes |
| :--- | :--- | :--- |
| **Git** | Latest | Version control |
| **Docker & Docker Compose** | Latest | **Recommended** for one-command full-stack setup |
| **Go** | `1.20` or higher (`1.24` recommended) | Required for manual backend setup |
| **Node.js & npm** | `Node.js 20+` & `npm 9+` | Required for manual frontend setup |
| **MongoDB** | `6.0+` (or MongoDB Atlas URI) | Required for manual backend setup |
| **Redis** | `7.0+` (local or remote) | Required for sessions/caching in manual setup |

---

##  Getting Started

### 1. Fork and Clone the Repository

1. Navigate to the official [DebateAI repository](https://github.com/AOSSIE-Org/DebateAI).
2. Click the **Fork** button in the top right corner.
3. Clone your fork to your local machine:

```bash
git clone https://github.com/<your-username>/DebateAI.git
cd DebateAI
```

4. Add the upstream repository:

```bash
git remote add upstream https://github.com/AOSSIE-Org/DebateAI.git
```

---

##  Local Development Setup

You can run DebateAI locally using either **Docker Compose** (recommended) or by setting up the **Backend** and **Frontend** manually.

---

### Option A: Using Docker Compose (Recommended)

DebateAI includes pre-configured Dockerfiles (`backend/Dockerfile.dev`, `frontend/Dockerfile.dev`) and a root `docker-compose.yml` that orchestrates:
- **Backend Service** (Go Gin server on port `1313`)
- **Frontend Service** (Vite + React dev server on port `5173`)
- **MongoDB Service** (Port `27017`)
- **Redis Service** (Port `6379`)

#### 1. Setup Environment Files

Set up the `.env` files for both the backend and frontend using the provided `.env.example` templates:

```bash
# 1. Setup Backend environment & configuration
cd backend
cp .env.example .env
cp config/config.prod.sample.yml config/config.prod.yml
cd ..

# 2. Setup Frontend environment
cd frontend
cp .env.example .env
cd ..
```

Configure your credentials inside `backend/.env` and `frontend/.env` as needed:
- `backend/.env`:
  - `GEMINI_API_KEY`: API key for AI debate features
  - `JWT_SECRET`: Secret key for signing authentication tokens
  - `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `frontend/.env`:
  - `VITE_BASE_URL`: `http://localhost:1313`
  - `VITE_API_URL`: `http://localhost:1313`
  - `VITE_GOOGLE_CLIENT_ID`: Google OAuth client ID

#### 2. Build and Start the Containers

From the root project directory, run:

```bash
docker compose up --build
```

To run in detached (background) mode:

```bash
docker compose up -d --build
```

#### 3. Access the Application

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:1313](http://localhost:1313)
- **MongoDB:** `localhost:27017`
- **Redis:** `localhost:6379`

#### 4. Stopping Containers

```bash
docker compose down
```

---

### Option B: Manual Local Setup

If you prefer to run services natively on your host machine without Docker:

#### 1. Backend Setup (Go)

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Create the required configuration and environment files:
   ```bash
   cp .env.example .env
   cp config/config.prod.sample.yml config/config.prod.yml
   ```

3. Configure `backend/config/config.prod.yml`:
   - Set your MongoDB connection URI:
     ```yaml
     database:
       uri: "mongodb://localhost:27017/debateai"
     ```
   - Set your Gemini API key for AI debate features:
     ```yaml
     gemini:
       apiKey: "<YOUR_GEMINI_API_KEY>"
     ```
   - Set your Redis for room creation for debate and more:
     ```yaml
     redis:
       addr: "localhost:6379"
       password: ""
       db: 0
     ```
   - Set JWT secret, SMTP, or Google OAuth Client ID as needed.

4. Download Go dependencies:
   ```bash
   go mod download
   ```

5. Start the backend server:
   ```bash
   go run cmd/server/main.go
   ```
   The backend will start on port `1313` (or the port defined in `config.prod.yml`).

---

#### 2. Frontend Setup (React + Vite + TypeScript)

1. Open a new terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your `.env` file from the example template:
   ```bash
   cp .env.example .env
   ```
   Configure `VITE_BASE_URL` and `VITE_API_URL` (default: `http://localhost:1313`) and optionally add your `VITE_GOOGLE_CLIENT_ID`.

4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

##  Testing & Code Quality Standards

Before submitting any changes, verify that your code compiles, passes tests, and satisfies project linting standards.

### Backend Validation

From the `backend/` directory:

```bash
cd backend

# Download dependencies
go mod download

# Build check
go build ./...

# Run Go vet linter
go vet ./...

# Run automated tests
go test ./...
```

### Frontend Validation

From the `frontend/` directory:

```bash
cd frontend

# Run ESLint
npm run lint

# Check TypeScript build
npm run build
```

---

##  Pull Request Guidelines

### 1. Create a Topic Branch

Always work on a separate branch rather than `main`:

```bash
git checkout -b feat/your-feature-name
# or for bug fixes:
git checkout -b fix/issue-description
```

### 2. Follow Commit Conventions & DCO

- Use clear and concise commit messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification:
  - `feat: add real-time argument timer in debate room`
  - `fix: handle WebSocket reconnect on token expiration`
  - `docs: update setup instructions in CONTRIBUTING.md`
  - `refactor: extract speech analysis service`
  - `test: add unit tests for debate room controller`
- Sign off your commits to comply with the Developer Certificate of Origin:
  ```bash
  git commit -s -m "feat: your commit message"
  ```

### 3. Submitting a Video Demonstration (UI / Feature Changes)

If your Pull Request introduces UI/UX changes, user interactions, or new features:
- Record a short video demonstration (e.g., using [Loom](https://www.loom.com/), OBS, or an equivalent screen recording tool).
- Attach the video link or embed the recording in your Pull Request description. This helps reviewers understand and test your changes quickly.

### 4. Open a Pull Request

1. Push your branch to your forked repository:
   ```bash
   git push origin feat/your-feature-name
   ```
2. Go to the [DebateAI repository](https://github.com/AOSSIE-Org/DebateAI) and click **New Pull Request**.
3. Clearly state:
   - What problem this PR solves or what feature it introduces.
   - Any relevant issue numbers (e.g., `Fixes #42` or `Closes #15`).
   - Steps to reproduce or verify your changes locally.
   - Demo video or screenshots (if applicable).
4. Be responsive to feedback and maintainer reviews.

---

##  Architecture & Tech Stack

- **Backend**:
  - Language: **Go** (`1.24`)
  - Web Framework: **Gin**
  - Real-Time Communication: **WebSockets** & **WebRTC**
  - Authorization: **Casbin RBAC**
  - Database: **MongoDB**
  - Caching & State: **Redis**
  - AI Engine: **Google Gemini API** (`google.golang.org/genai`)
- **Frontend**:
  - Core: **React 18** with **TypeScript**
  - Bundler: **Vite**
  - Styling: **Tailwind CSS**
  - Component Primitives: **Radix UI**
  - State Management: **Jotai**
  - Networking: **Axios**, **Socket.IO Client**, **Reconnecting WebSocket**

---

##  Maintainers & Support

For key contacts, mentors, and maintainers, refer to [`MAINTAINER.md`](MAINTAINER.md).

Thank you for contributing to AOSSIE & DebateAI! Let's build the future of AI-assisted debating together.