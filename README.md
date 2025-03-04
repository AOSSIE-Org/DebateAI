# Project Setup Guide

## Project Setup

1. Install dependencies by running the following command in the root directory:

   ```sh
   npm run installer
   ```

2. Create an environment file:

   - Navigate to the **frontend** directory.
   - Create a `.env` file and add the following environment variable:
     ```sh
     VITE_BASE_URL="http://localhost:<BACKEND_SERVER_PORT>"
     ```

3. Start the development server (this will start both the frontend and backend concurrently):
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
