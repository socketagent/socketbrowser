// Solana wallet implementation for Socket Browser
// Complete rewrite from solana-wallet.js (262 lines) in Rust

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_instruction,
    transaction::Transaction,
};
use std::str::FromStr;
use std::sync::Mutex;

// Crypto imports
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use pbkdf2::pbkdf2_hmac;
use rand::Rng;
use sha2::Sha256;

const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
const RPC_URL: &str = "https://api.mainnet-beta.solana.com";

#[derive(Serialize, Deserialize)]
pub struct WalletResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mnemonic: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub balance: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_wallet: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_unlocked: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub struct SolanaWallet {
    keypair: Mutex<Option<Keypair>>,
    rpc_client: RpcClient,
    storage_key: String,
}

impl SolanaWallet {
    pub fn new() -> Self {
        let rpc_client = RpcClient::new_with_commitment(
            RPC_URL.to_string(),
            CommitmentConfig::confirmed(),
        );

        Self {
            keypair: Mutex::new(None),
            rpc_client,
            storage_key: "solana_wallet_encrypted".to_string(),
        }
    }

    /// Check if wallet exists in storage
    pub fn has_wallet(&self, storage: &crate::storage::Storage) -> bool {
        storage.get(&self.storage_key).ok().flatten().is_some()
    }

    /// Generate new wallet with BIP-39 mnemonic
    pub fn generate_new(
        &self,
        password: &str,
        storage: &crate::storage::Storage,
    ) -> Result<WalletResponse> {
        // Generate 12-word mnemonic (128 bits entropy)
        let mnemonic = bip39::Mnemonic::generate(12)?;
        let mnemonic_phrase = mnemonic.to_string();

        // Derive seed from mnemonic
        let seed = mnemonic.to_seed("");
        let keypair = Keypair::from_bytes(&seed[..32])?;

        // Encrypt and save
        self.save_wallet(&keypair, password, storage)?;

        // Unlock wallet
        let mut kp = self.keypair.lock().unwrap();
        *kp = Some(Keypair::from_bytes(&keypair.to_bytes())?);

        Ok(WalletResponse {
            success: true,
            address: Some(keypair.pubkey().to_string()),
            mnemonic: Some(mnemonic_phrase),
            balance: None,
            private_key: None,
            has_wallet: None,
            is_unlocked: None,
            error: None,
        })
    }

    /// Import wallet from BIP-39 mnemonic
    pub fn import_from_mnemonic(
        &self,
        mnemonic_phrase: &str,
        password: &str,
        storage: &crate::storage::Storage,
    ) -> Result<WalletResponse> {
        // Parse and validate mnemonic
        let mnemonic = bip39::Mnemonic::from_phrase(mnemonic_phrase, bip39::Language::English)
            .context("Invalid recovery phrase")?;

        // Derive seed
        let seed = mnemonic.to_seed("");
        let keypair = Keypair::from_bytes(&seed[..32])?;

        // Save encrypted
        self.save_wallet(&keypair, password, storage)?;

        // Unlock
        let mut kp = self.keypair.lock().unwrap();
        *kp = Some(Keypair::from_bytes(&keypair.to_bytes())?);

        Ok(WalletResponse {
            success: true,
            address: Some(keypair.pubkey().to_string()),
            mnemonic: None,
            balance: None,
            private_key: None,
            has_wallet: None,
            is_unlocked: None,
            error: None,
        })
    }

    /// Import from private key (base58)
    pub fn import_from_private_key(
        &self,
        private_key_base58: &str,
        password: &str,
        storage: &crate::storage::Storage,
    ) -> Result<WalletResponse> {
        let decoded = bs58::decode(private_key_base58)
            .into_vec()
            .context("Invalid private key")?;

        let keypair = Keypair::from_bytes(&decoded)?;

        self.save_wallet(&keypair, password, storage)?;

        let mut kp = self.keypair.lock().unwrap();
        *kp = Some(Keypair::from_bytes(&keypair.to_bytes())?);

        Ok(WalletResponse {
            success: true,
            address: Some(keypair.pubkey().to_string()),
            mnemonic: None,
            balance: None,
            private_key: None,
            has_wallet: None,
            is_unlocked: None,
            error: None,
        })
    }

    /// Unlock existing wallet with password
    pub fn unlock(
        &self,
        password: &str,
        storage: &crate::storage::Storage,
    ) -> Result<WalletResponse> {
        let encrypted = storage
            .get(&self.storage_key)?
            .ok_or_else(|| anyhow!("No wallet found"))?;

        let encrypted_str = encrypted
            .as_str()
            .ok_or_else(|| anyhow!("Invalid wallet data"))?;

        let secret_key = self.decrypt(encrypted_str, password)
            .context("Wrong password")?;

        let keypair = Keypair::from_bytes(&secret_key)?;

        let mut kp = self.keypair.lock().unwrap();
        *kp = Some(Keypair::from_bytes(&keypair.to_bytes())?);

        Ok(WalletResponse {
            success: true,
            address: Some(keypair.pubkey().to_string()),
            mnemonic: None,
            balance: None,
            private_key: None,
            has_wallet: None,
            is_unlocked: None,
            error: None,
        })
    }

    /// Lock wallet
    pub fn lock(&self) {
        let mut kp = self.keypair.lock().unwrap();
        *kp = None;
    }

    /// Get wallet address
    pub fn get_address(&self) -> Result<String> {
        let kp = self.keypair.lock().unwrap();
        match &*kp {
            Some(keypair) => Ok(keypair.pubkey().to_string()),
            None => Err(anyhow!("Wallet not unlocked")),
        }
    }

    /// Get balance in SOL
    pub fn get_balance(&self) -> Result<f64> {
        let kp = self.keypair.lock().unwrap();
        match &*kp {
            Some(keypair) => {
                let lamports = self.rpc_client.get_balance(&keypair.pubkey())?;
                Ok(lamports as f64 / LAMPORTS_PER_SOL as f64)
            }
            None => Err(anyhow!("Wallet not unlocked")),
        }
    }

    /// Export private key (base58)
    pub fn export_private_key(&self) -> Result<String> {
        let kp = self.keypair.lock().unwrap();
        match &*kp {
            Some(keypair) => Ok(bs58::encode(keypair.to_bytes()).into_string()),
            None => Err(anyhow!("Wallet not unlocked")),
        }
    }

    /// Check if wallet is unlocked
    pub fn is_unlocked(&self) -> bool {
        let kp = self.keypair.lock().unwrap();
        kp.is_some()
    }

    /// Save wallet encrypted to storage
    fn save_wallet(
        &self,
        keypair: &Keypair,
        password: &str,
        storage: &crate::storage::Storage,
    ) -> Result<()> {
        let encrypted = self.encrypt(&keypair.to_bytes(), password)?;
        storage.set(
            self.storage_key.clone(),
            serde_json::Value::String(encrypted),
        )?;
        storage.set(
            "solana_wallet_address".to_string(),
            serde_json::Value::String(keypair.pubkey().to_string()),
        )?;
        Ok(())
    }

    /// Encrypt data with password using AES-256-GCM
    fn encrypt(&self, data: &[u8], password: &str) -> Result<String> {
        // Generate salt and nonce
        let mut rng = rand::thread_rng();
        let salt: [u8; 16] = rng.gen();
        let nonce_bytes: [u8; 12] = rng.gen();
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Derive key from password using PBKDF2
        let mut key = [0u8; 32];
        pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, 100_000, &mut key);

        // Encrypt using AES-256-GCM
        let cipher = Aes256Gcm::new_from_slice(&key)
            .context("Failed to create cipher")?;
        let ciphertext = cipher
            .encrypt(nonce, data)
            .map_err(|_| anyhow!("Encryption failed"))?;

        // Combine: salt (16) + nonce (12) + ciphertext (which includes auth tag)
        let mut combined = Vec::new();
        combined.extend_from_slice(&salt);
        combined.extend_from_slice(&nonce_bytes);
        combined.extend_from_slice(&ciphertext);

        // Encode as base64
        Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, combined))
    }

    /// Decrypt data with password
    fn decrypt(&self, encrypted_data: &str, password: &str) -> Result<Vec<u8>> {
        // Decode from base64
        let combined = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encrypted_data)
            .context("Invalid base64")?;

        if combined.len() < 28 {
            return Err(anyhow!("Invalid encrypted data"));
        }

        // Extract components
        let salt = &combined[0..16];
        let nonce_bytes = &combined[16..28];
        let ciphertext = &combined[28..];

        let nonce = Nonce::from_slice(nonce_bytes);

        // Derive key
        let mut key = [0u8; 32];
        pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, 100_000, &mut key);

        // Decrypt
        let cipher = Aes256Gcm::new_from_slice(&key)
            .context("Failed to create cipher")?;
        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| anyhow!("Decryption failed (wrong password?)"))?;

        Ok(plaintext)
    }
}
