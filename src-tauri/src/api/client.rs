// API client module - rewritten from client.js
// Makes HTTP calls to Socket Agent APIs

use anyhow::{anyhow, Context, Result};
use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::time::Duration;

use super::discovery::{get_endpoint, SocketAgentDescriptor};

#[derive(Serialize)]
pub struct ApiCallResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_code: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Make an API call to a Socket Agent endpoint
pub async fn call_api(
    base_url: &str,
    endpoint_id: &str,
    params: HashMap<String, Value>,
    descriptor: Option<&SocketAgentDescriptor>,
) -> Result<Value> {
    let mut method = "GET";
    let mut path = endpoint_id;

    // If we have the descriptor, use it to get endpoint details
    let endpoint = if let Some(desc) = descriptor {
        get_endpoint(desc, endpoint_id)
    } else {
        None
    };

    if let Some(ep) = &endpoint {
        if let Some(m) = &ep.method {
            method = m.as_str();
        }
        path = &ep.path;
    }

    // Substitute path parameters and separate query/body params
    let mut final_path = path.to_string();
    let mut query_params: HashMap<String, String> = HashMap::new();
    let mut body_params: HashMap<String, Value> = HashMap::new();

    for (key, value) in params {
        let placeholder = format!("{{{}}}", key);
        if final_path.contains(&placeholder) {
            // Path parameter
            let value_str = value.as_str().unwrap_or_else(|| value.to_string().trim_matches('"'));
            final_path = final_path.replace(&placeholder, value_str);
        } else if method == "GET" || method == "DELETE" {
            // Query parameter
            let value_str = value.as_str().unwrap_or_else(|| value.to_string().trim_matches('"'));
            query_params.insert(key, value_str.to_string());
        } else {
            // Body parameter
            body_params.insert(key, value);
        }
    }

    // Build final URL
    let url = format!("{}{}", base_url.trim_end_matches('/'), final_path);

    println!("Making API call: {} {}", method, url);
    if !query_params.is_empty() {
        println!("Query params: {:?}", query_params);
    }
    if !body_params.is_empty() {
        println!("Body params: {:?}", body_params);
    }

    // Create HTTP client
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()?;

    // Parse method
    let http_method = Method::from_bytes(method.as_bytes())
        .context("Invalid HTTP method")?;

    // Build request
    let mut request = client
        .request(http_method, &url)
        .header("Accept", "application/json")
        .header("User-Agent", "Socket-Browser/0.1.0");

    // Add query parameters
    if !query_params.is_empty() {
        request = request.query(&query_params);
    }

    // Add body for non-GET/DELETE requests
    if method != "GET" && method != "DELETE" && !body_params.is_empty() {
        request = request
            .header("Content-Type", "application/json")
            .json(&body_params);
    }

    // Send request
    let response = request.send().await.context("Failed to send request")?;

    let status = response.status();
    println!("API response: {}", status);

    // Handle error responses
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());

        if status.as_u16() >= 400 && status.as_u16() < 500 {
            return Err(anyhow!("Client error ({}): {}", status.as_u16(), error_text));
        } else if status.as_u16() >= 500 {
            return Err(anyhow!("Server error ({}): {}", status.as_u16(), error_text));
        } else {
            return Err(anyhow!("HTTP {}: {}", status.as_u16(), error_text));
        }
    }

    // Parse response
    let data: Value = response
        .json()
        .await
        .context("Failed to parse API response")?;

    println!("API response data: {:?}", data);

    Ok(data)
}
