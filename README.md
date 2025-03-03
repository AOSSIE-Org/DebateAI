# DebateAI
DebateAI is an interactive debating platform that allows users to engage in debates with both AI and real users. The project is built using multiple technologies, integrating real-time WebSocket communication and AI-based argument analysis.

## 🛠️ Tech Stack
### **Backend**
- **Go** (WebSockets) – Real-time User vs User debates.
- **Flask** (REST API) – User vs AI debates and AI analysis.

1. Navigate to the backend directory:
   ```sh
   cd backend
   ```
2. Run the backend server:
   ```sh
   go run cmd/server/main.go
   ```

## Frontend Setup

1. Navigate to the frontend directory:
   ```sh
   cd frontend
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Create an environment file:
   - Create a `.env` file in the frontend directory.
   - Add the following environment variables:
     ```sh
     VITE_BASE_URL="http://localhost:<BACKEND_SERVER_PORT>"
     ```
4. Start the development server:
   ```sh
   npm run dev
   ```

## Setting Up Amazon Cognito

Follow these steps to configure Amazon Cognito for authentication:

1. **Navigate to Cognito**
   - Go to the [AWS Management Console](https://aws.amazon.com/console/) and open Cognito.

2. **Create a User Pool**
   - Configure authentication settings as per your requirements.

3. **Retrieve Credentials**
   - Once the User Pool is set up, obtain the necessary credentials:
     - **User Pool ID**
     - **App Client ID**

4. **Update Application Configuration**
   - Add the retrieved credentials to your application's configuration file (e.g., `config.yml`).
   - Enable the following settings in Cognito's app-client:
     - Choice-based sign-in
     - Username and password authentication
     - Get user tokens from existing authenticated sessions
     - Secure Remote Password (SRP) protocol

For more details, refer to the [official AWS documentation](https://docs.aws.amazon.com/cognito/).

## Setting Up OpenAI API Key

To use OpenAI services, obtain an API key from OpenRouter:

1. Visit [OpenRouter](https://openrouter.ai/) and sign up if you don't have an account.
2. Generate an API key from your OpenRouter dashboard.
3. Add the API key to your `config.yml` file.

---


This guide follows the project implementation approach. If you encounter any issues, check the AWS documentation or relevant project files.
