// API discovery module - rewritten from discovery.js
// Discovers Socket Agent API descriptors from URLs

use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SocketAgentDescriptor {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "baseUrl", skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    pub endpoints: Vec<Endpoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Endpoint {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(rename = "operationId", skip_serializing_if = "Option::is_none")]
    pub operation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Serialize)]
pub struct DiscoveryResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub descriptor: Option<SocketAgentDescriptor>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Discover Socket Agent API descriptor from a given URL
pub async fn discover_socket_agent(base_url: &str) -> Result<SocketAgentDescriptor> {
    // Normalize URL
    let url = base_url.trim_end_matches('/');

    // Build discovery URL
    let discovery_url = format!("{}/.well-known/socket-agent", url);

    println!("Discovering Socket Agent at: {}", discovery_url);

    // Create HTTP client
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;

    // Make request
    let response = client
        .get(&discovery_url)
        .header("Accept", "application/json")
        .header("User-Agent", "Socket-Browser/0.1.0")
        .send()
        .await
        .context("Failed to connect to server")?;

    // Check status
    if !response.status().is_success() {
        if response.status().as_u16() == 404 {
            return Err(anyhow!(
                "No Socket Agent API found at {}. Make sure it's a Socket Agent compliant API.",
                base_url
            ));
        } else {
            return Err(anyhow!(
                "HTTP {}: {}",
                response.status().as_u16(),
                response.status().canonical_reason().unwrap_or("Unknown")
            ));
        }
    }

    // Parse response
    let mut descriptor: SocketAgentDescriptor = response
        .json()
        .await
        .context("Failed to parse Socket Agent descriptor")?;

    // Validate descriptor
    if descriptor.name.is_empty() || descriptor.endpoints.is_empty() {
        return Err(anyhow!(
            "Invalid Socket Agent descriptor: missing required fields"
        ));
    }

    // Ensure baseUrl is set
    if descriptor.base_url.is_none() {
        descriptor.base_url = Some(url.to_string());
    }

    println!(
        "Discovered API: {} with {} endpoints",
        descriptor.name,
        descriptor.endpoints.len()
    );

    Ok(descriptor)
}

/// Get endpoint details by operation ID or path
pub fn get_endpoint(descriptor: &SocketAgentDescriptor, endpoint_id: &str) -> Option<Endpoint> {
    descriptor.endpoints.iter().find(|ep| {
        if let Some(op_id) = &ep.operation_id {
            if op_id == endpoint_id {
                return true;
            }
        }
        if ep.path == endpoint_id {
            return true;
        }
        if let Some(method) = &ep.method {
            let combined = format!("{}:{}", method, ep.path);
            if combined == endpoint_id {
                return true;
            }
        }
        false
    }).cloned()
}
