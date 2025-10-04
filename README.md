<p align="left">
  <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRpPlI1P7SK3pemg67VMPbvNzxYyk0UtlmJiQ&s" alt="Aossie Logo" height="120"/>
</p>

<h1 align="right">
  <b>AOSSIE | DebateAI</b>
</h1>

---

## About DebateAI

**DebateAI** is an AI-enhanced, real-time debating platform designed to sharpen communication skills. Whether competing against human opponents or LLM-powered AI challengers, users can participate in structured debates that mimic formal competitions.

### Key Features

- **User vs. User Debates**
- Real-time debates via **WebSockets**, **WebRTC** (audio/video/text)
- Structured formats: **opening**, **cross-exam**, and **closing**

- **User vs. AI Debates**
- LLM-generated counterarguments that adapt to your input

- **Custom Debate Rooms**
- Create private, topic-specific debate spaces

---

## Project Setup Guide

### Backend Configuration

1. Create a file named `config.prod.yml` in the `backend/config/` directory.

Paste the following configuration:

```
server:
  port: 1313  # The port number your backend server will run on

database:
  uri: "mongodb+srv://<username>:<password>@<cluster-url>/<database-name>"
  # Replace with your MongoDB Atlas connection string
  # Get this from your MongoDB Atlas dashboard after creating a cluster and database

gemini:
  apiKey: "<YOUR_GEMINI_API_KEY>"
  # API key for OpenAI / Gemini model access
  # Obtain from your OpenRouter.ai or OpenAI account dashboard

jwt:
  secret: "<YOUR_JWT_SECRET>"
  # A secret string used to sign JWT tokens
  # Generate a strong random string (e.g. use `openssl rand -hex 32`)

  expiry: 1440
  # Token expiry time in minutes (e.g. 1440 = 24 hours)

smtp:
  host: "smtp.gmail.com"
  # SMTP server host for sending emails (example is Gmail SMTP)

  port: 587
  # SMTP server port (587 for TLS)

  username: "<YOUR_EMAIL_ADDRESS>"
  # Email username (your email address)

  password: "<YOUR_EMAIL_PASSWORD_OR_APP_PASSWORD>"
  # Password for the email or app-specific password if 2FA is enabled

  senderEmail: "<YOUR_EMAIL_ADDRESS>"
  # The 'from' email address used when sending mails

  senderName: "DebateAI Team"

googleOAuth:
  clientID: "<YOUR_GOOGLE_OAUTH_CLIENT_ID>"
  # Google OAuth Client ID for OAuth login
  # Obtain from Google Cloud Console (APIs & Services > Credentials > OAuth 2.0 Client IDs)
```

> **Note**: Do **not** commit this file to a public repository. Use `.gitignore`.

---

### Running the Backend (Go)

1. Navigate to the backend folder:

   ```
   cd backend
   ```

2. Initialize Go modules (if not already done):

   ```
   go mod tidy
   ```

3. Run the server:
   ```
   go run cmd/server/main.go
   ```

---

### Frontend Configuration

1. In the `frontend/` directory, create a file named `.env`.

2. Add the following environment variables to the `.env` file:

```
VITE_BASE_URL="http://localhost:1313"
VITE_GOOGLE_CLIENT_ID="<YOUR_GOOGLE_OAUTH_CLIENT_ID>"
```

- Replace `<YOUR_GOOGLE_OAUTH_CLIENT_ID>` with your actual Google OAuth Client ID from Google Cloud Console.

> **Note:** Do **not** commit this file to a public repository. Add `.env` to your `.gitignore` to keep it secure.

---

### Running the Frontend (React + Vite)

1. Open a new terminal and navigate to the frontend directory:

   ```
   cd frontend
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Create a `.env` file and add:

   ```
   VITE_BASE_URL="http://localhost:1313"
   ```

4. Start the development server:
   ```
   npm run dev
   ```

---

## Contribution Guidelines

Thank you for your interest in contributing to **DebateAI**! We appreciate your efforts in making this project better. Please follow these best practices to ensure smooth collaboration.

### How to Contribute

#### 1. Fork the Repository

- Navigate to the [DebateAI repository](https://github.com/AOSSIE-Org/DebateAI).
- Click the **Fork** button in the top right corner.
- Clone the forked repository to your local machine:

```sh
git clone https://github.com/your-username/DebateAI.git
cd DebateAI
```

#### 2. Create a Feature Branch

- Always create a new branch for your contributions:

```sh
git checkout -b feature-name
```

#### 3. Make Changes and Commit

- Follow coding best practices and maintain code consistency.
- Write clear commit messages:

```sh
git commit -m "Added [feature/fix]: Short description"
```

#### 4. Push Changes and Open a Pull Request

- Push your changes to your forked repository:

```sh
git push origin feature-name
```

- Navigate to the original repository and open a **Pull Request (PR)**.
- Provide a detailed description of the changes in the PR.

---

### Best Practices

- **Code Quality**: Ensure your code is clean, readable, and consistent with the existing codebase.
- **Testing**: Test your changes locally before submitting a PR.
- **Security**: Never commit sensitive information (e.g., API keys or passwords).
- **Communication**: Be responsive to reviews and update your PRs as requested.
- **License Compliance**: By contributing to this project, you agree that your contributions will be licensed under the same MIT License that covers the project.

---

### Submitting a Video Demonstration

To help maintainers understand your changes, consider submitting a short video showcasing the feature or fix:

- Record a short demo (you can use tools like Loom or OBS).
- Upload and include the video link in your Pull Request description.

---

### Reporting Issues

If you find a bug or have a feature request:

- Open an issue [here](https://github.com/AOSSIE-Org/DebateAI/issues).
- Clearly describe the problem and, if possible, suggest solutions.

We look forward to your contributions!

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### What this means for contributors and users:

**For Contributors:**
- You can freely contribute to this project
- Your contributions will be licensed under the same MIT License
- You retain copyright to your contributions while granting the project permission to use them

**For End Users:**
- You can use this software for any purpose (commercial or non-commercial)
- You can modify and distribute the software
- You can create derivative works
- You must include the original copyright notice and license text in any distribution

**For Commercial Use:**
- ✅ Commercial use is allowed
- ✅ Modification is allowed
- ✅ Distribution is allowed
- ✅ Private use is allowed
- ❌ No warranty or liability protection provided

The MIT License is one of the most permissive open-source licenses, making it ideal for educational projects like DebateAI that aim to foster learning and collaboration.

---

**Copyright © 2024 [AOSSIE](https://aossie.org)**

---
