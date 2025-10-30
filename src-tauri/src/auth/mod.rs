// Authentication client for socketagent.id
// Handles user registration, login, token management

use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const ID_SERVICE_URL: &str = "https://socketagent.io";

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: Option<String>,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterResponse {
    pub user_id: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
    pub token_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LogoutRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LogoutResponse {
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: u64,
    pub username: String,
    pub email: Option<String>,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_in: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<UserInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub struct AuthClient {
    client: Client,
    base_url: String,
}

impl AuthClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: ID_SERVICE_URL.to_string(),
        }
    }

    pub fn with_url(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, base_url }
    }

    /// Register a new user
    pub async fn register(&self, username: String, email: Option<String>, password: String) -> Result<u64> {
        let url = format!("{}/v1/users", self.base_url);

        let request = RegisterRequest {
            username,
            email,
            password,
        };

        println!("Registering user at: {}", url);

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .context("Failed to connect to authentication service")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());

            if status.as_u16() == 409 {
                return Err(anyhow!("Username already exists"));
            }

            return Err(anyhow!("Registration failed ({}): {}", status.as_u16(), error_text));
        }

        let result: RegisterResponse = response
            .json()
            .await
            .context("Failed to parse registration response")?;

        println!("User registered successfully with ID: {}", result.user_id);

        Ok(result.user_id)
    }

    /// Login and get access/refresh tokens
    pub async fn login(&self, username: String, password: String) -> Result<LoginResponse> {
        let url = format!("{}/v1/auth/login", self.base_url);

        let request = LoginRequest { username, password };

        println!("Logging in at: {}", url);

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .context("Failed to connect to authentication service")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());

            if status.as_u16() == 401 {
                return Err(anyhow!("Invalid username or password"));
            }

            return Err(anyhow!("Login failed ({}): {}", status.as_u16(), error_text));
        }

        let result: LoginResponse = response
            .json()
            .await
            .context("Failed to parse login response")?;

        println!("Login successful, access token expires in {} seconds", result.expires_in);

        Ok(result)
    }

    /// Get current user information
    pub async fn get_user(&self, access_token: &str) -> Result<UserInfo> {
        let url = format!("{}/v1/me", self.base_url);

        println!("Getting user info from: {}", url);

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .context("Failed to connect to authentication service")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());

            if status.as_u16() == 401 {
                return Err(anyhow!("Invalid or expired access token"));
            }

            return Err(anyhow!("Failed to get user info ({}): {}", status.as_u16(), error_text));
        }

        let user: UserInfo = response
            .json()
            .await
            .context("Failed to parse user info response")?;

        println!("User info retrieved: {}", user.username);

        Ok(user)
    }

    /// Refresh access token using refresh token
    pub async fn refresh(&self, refresh_token: String) -> Result<LoginResponse> {
        let url = format!("{}/v1/auth/refresh", self.base_url);

        let request = RefreshRequest { refresh_token };

        println!("Refreshing access token at: {}", url);

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .context("Failed to connect to authentication service")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());

            if status.as_u16() == 401 {
                return Err(anyhow!("Invalid or expired refresh token"));
            }

            return Err(anyhow!("Token refresh failed ({}): {}", status.as_u16(), error_text));
        }

        let result: LoginResponse = response
            .json()
            .await
            .context("Failed to parse refresh response")?;

        println!("Token refreshed successfully");

        Ok(result)
    }

    /// Logout and revoke refresh token
    pub async fn logout(&self, refresh_token: String) -> Result<()> {
        let url = format!("{}/v1/auth/logout", self.base_url);

        let request = LogoutRequest { refresh_token };

        println!("Logging out at: {}", url);

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .context("Failed to connect to authentication service")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(anyhow!("Logout failed ({}): {}", status.as_u16(), error_text));
        }

        let result: LogoutResponse = response
            .json()
            .await
            .context("Failed to parse logout response")?;

        println!("Logout successful: {}", result.status);

        Ok(())
    }
}
