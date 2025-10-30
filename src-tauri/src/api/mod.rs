// API module
pub mod client;
pub mod discovery;

pub use client::{call_api, ApiCallResponse};
pub use discovery::{discover_socket_agent, SocketAgentDescriptor, DiscoveryResponse};
