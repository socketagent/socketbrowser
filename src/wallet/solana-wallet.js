/**
 * Solana Wallet Integration for Socket Browser
 *
 * Built-in wallet with automatic micropayments for page generation
 */

const { Connection, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } = require('@solana/web3.js');
const bip39 = require('bip39');
const bs58 = require('bs58');
const { Buffer } = require('buffer');

class SolanaWallet {
    constructor(storage = null) {
        this.keypair = null;
        this.connection = new Connection(
            'https://api.mainnet-beta.solana.com',
            'confirmed'
        );
        this.isUnlocked = false;

        // Storage adapter - defaults to localStorage for renderer, or can be injected
        this.storage = storage || {
            getItem: (key) => localStorage.getItem(key),
            setItem: (key, value) => localStorage.setItem(key, value),
            removeItem: (key) => localStorage.removeItem(key)
        };
    }

    /**
     * Check if wallet exists
     */
    hasWallet() {
        return this.storage.getItem('solana_wallet_encrypted') !== null;
    }

    /**
     * Generate new wallet with recovery phrase
     */
    async generateNew(password) {
        // Generate 12-word mnemonic
        const mnemonic = bip39.generateMnemonic(128);

        // Derive keypair from mnemonic
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const keypair = Keypair.fromSeed(seed.slice(0, 32));

        // Encrypt and save
        await this.saveWallet(keypair, password);

        this.keypair = keypair;
        this.isUnlocked = true;

        return {
            address: keypair.publicKey.toString(),
            mnemonic: mnemonic
        };
    }

    /**
     * Import wallet from recovery phrase
     */
    async importFromMnemonic(mnemonic, password) {
        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error('Invalid recovery phrase');
        }

        const seed = await bip39.mnemonicToSeed(mnemonic);
        const keypair = Keypair.fromSeed(seed.slice(0, 32));

        await this.saveWallet(keypair, password);

        this.keypair = keypair;
        this.isUnlocked = true;

        return {
            address: keypair.publicKey.toString()
        };
    }

    /**
     * Import from private key (base58)
     */
    async importFromPrivateKey(privateKeyBase58, password) {
        try {
            const decoded = bs58.decode(privateKeyBase58);
            const keypair = Keypair.fromSecretKey(decoded);

            await this.saveWallet(keypair, password);

            this.keypair = keypair;
            this.isUnlocked = true;

            return {
                address: keypair.publicKey.toString()
            };
        } catch (error) {
            throw new Error('Invalid private key');
        }
    }

    /**
     * Unlock existing wallet
     */
    async unlock(password) {
        const encrypted = this.storage.getItem('solana_wallet_encrypted');
        if (!encrypted) {
            throw new Error('No wallet found');
        }

        try {
            const secretKey = await this.decrypt(encrypted, password);
            this.keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
            this.isUnlocked = true;

            return {
                address: this.keypair.publicKey.toString()
            };
        } catch (error) {
            throw new Error('Wrong password');
        }
    }

    /**
     * Lock wallet
     */
    lock() {
        this.keypair = null;
        this.isUnlocked = false;
    }

    /**
     * Get wallet address
     */
    getAddress() {
        if (!this.keypair) {
            return null;
        }
        return this.keypair.publicKey.toString();
    }

    /**
     * Get balance in SOL
     */
    async getBalance() {
        if (!this.keypair) {
            throw new Error('Wallet not unlocked');
        }

        const lamports = await this.connection.getBalance(this.keypair.publicKey);
        return lamports / LAMPORTS_PER_SOL;
    }

    /**
     * Auto-pay for page generation (no user interaction)
     */
    async autoPayForGeneration(recipientAddress, amountLamports = 10000) {
        if (!this.keypair) {
            throw new Error('Wallet not unlocked');
        }

        // Check balance first
        const balance = await this.getBalance();
        const requiredSOL = amountLamports / LAMPORTS_PER_SOL;

        if (balance < requiredSOL) {
            throw new Error('Insufficient balance');
        }

        // Create transaction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: this.keypair.publicKey,
                toPubkey: new PublicKey(recipientAddress),
                lamports: amountLamports
            })
        );

        // Send transaction (automatic, no popup)
        const signature = await this.connection.sendTransaction(
            transaction,
            [this.keypair]
        );

        // Wait for confirmation
        await this.connection.confirmTransaction(signature, 'confirmed');

        return signature;
    }

    /**
     * Save wallet encrypted to storage
     */
    async saveWallet(keypair, password) {
        const encrypted = await this.encrypt(keypair.secretKey, password);
        this.storage.setItem('solana_wallet_encrypted', encrypted);
        this.storage.setItem('solana_wallet_address', keypair.publicKey.toString());
    }

    /**
     * Encrypt data with password using Web Crypto API
     */
    async encrypt(data, password) {
        const encoder = new TextEncoder();

        // Derive key from password
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        const salt = crypto.getRandomValues(new Uint8Array(16));

        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );

        // Combine salt + iv + encrypted data
        const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encrypted), salt.length + iv.length);

        return Buffer.from(combined).toString('base64');
    }

    /**
     * Decrypt data with password
     */
    async decrypt(encryptedData, password) {
        const combined = Buffer.from(encryptedData, 'base64');

        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const data = combined.slice(28);

        const encoder = new TextEncoder();

        const passwordKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );

        return new Uint8Array(decrypted);
    }

    /**
     * Export private key (for backup)
     */
    exportPrivateKey() {
        if (!this.keypair) {
            throw new Error('Wallet not unlocked');
        }
        return bs58.encode(this.keypair.secretKey);
    }
}

// Export for use in renderer
if (typeof window !== 'undefined') {
    window.SolanaWallet = SolanaWallet;
}

module.exports = SolanaWallet;
