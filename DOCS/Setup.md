# Project Setup Guide

## Backend Go Setup

1. Navigate to the backend directory:
   ```sh
   cd ./backend
   ```
2. Run the backend server:
   ```sh
   go run cmd/server/main.go
   ```

## Backend Flask Setup

This document explains how to set up the Flask backend for the AI debate analysis project.
1. cd backend
2. python -m venv venv
3. 
   On Linux/MacOS:
   source venv/bin/activate

   On Windows:
   venv\Scripts\activate

4. pip install -r requirements.txt

5. Rename .env.example file to .env file 

6. Generate Your API keys from https://openrouter.ai/ 
7. Run the application using python main.py 



## Frontend Setup

1. Navigate to the frontend directory:
   ```sh
   cd ./frontend
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the development server:
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

For more details, refer to the [official AWS documentation](https://docs.aws.amazon.com/cognito/).

---

This guide follows the approach used in the project implementation. If you encounter any issues, check the AWS documentation or relevant project files.

