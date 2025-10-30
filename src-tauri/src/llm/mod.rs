// Render client for socketbrowser-api
// Handles UI generation via the render service

use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::api::discovery::SocketAgentDescriptor;

const RENDER_API_URL: &str = "http://localhost:8000";

#[derive(Debug, Serialize)]
pub struct GenerateRequest {
    pub descriptor: SocketAgentDescriptor,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GenerateResponse {
    pub html: String,
    pub credits_remaining: u64,
}

#[derive(Serialize)]
pub struct RenderResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credits_remaining: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub struct RenderClient {
    client: Client,
    base_url: String,
}

impl RenderClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120)) // Long timeout for LLM generation
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: RENDER_API_URL.to_string(),
        }
    }

    pub fn with_url(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, base_url }
    }

    /// Generate UI from Socket Agent descriptor
    /// Requires valid access token from socketagent.id
    pub async fn generate(
        &self,
        access_token: &str,
        descriptor: SocketAgentDescriptor,
        prompt: Option<String>,
    ) -> Result<GenerateResponse> {
        let url = format!("{}/generate", self.base_url);

        let request = GenerateRequest { descriptor, prompt };

        println!("Generating UI at: {}", url);

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .context("Failed to connect to render service")?;

        let status = response.status();

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());

            match status.as_u16() {
                401 => return Err(anyhow!("Authentication failed. Please login again.")),
                402 => return Err(anyhow!("Insufficient credits. Please buy more credits from your account.")),
                429 => return Err(anyhow!("Rate limit exceeded. Please try again later.")),
                500 => return Err(anyhow!("Render service error: {}", error_text)),
                502 => return Err(anyhow!("GPU server error. Please try again later.")),
                _ => return Err(anyhow!("Render failed ({}): {}", status.as_u16(), error_text)),
            }
        }

        let result: GenerateResponse = response
            .json()
            .await
            .context("Failed to parse render response")?;

        println!(
            "UI generated successfully. {} credits remaining",
            result.credits_remaining
        );

        Ok(result)
    }

    /// Health check for render service
    pub async fn health_check(&self) -> Result<bool> {
        let url = format!("{}/health", self.base_url);

        let response = self
            .client
            .get(&url)
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .context("Failed to connect to render service")?;

        Ok(response.status().is_success())
    }
}
