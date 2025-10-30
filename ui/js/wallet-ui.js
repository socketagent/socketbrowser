/**
 * Wallet UI Module
 * Handles Solana wallet interface and operations
 */

import * as api from './tauri-api.js';
import * as ui from './ui.js';

let walletState = {
    hasWallet: false,
    isUnlocked: false,
    address: null,
    balance: null
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export async function initWalletUI() {
    console.log('🔌 Initializing wallet UI...');

    // Check if wallet exists
    await checkWalletStatus();

    // Render initial UI
    await renderWalletUI();

    console.log('✅ Wallet UI initialized');
}

async function checkWalletStatus() {
    try {
        const hasWalletResult = await api.wallet.hasWallet();
        walletState.hasWallet = hasWalletResult.has_wallet || false;

        if (walletState.hasWallet) {
            const isUnlockedResult = await api.wallet.isUnlocked();
            walletState.isUnlocked = isUnlockedResult.is_unlocked || false;

            if (walletState.isUnlocked) {
                await updateWalletInfo();
            }
        }
    } catch (error) {
        console.error('Failed to check wallet status:', error);
    }
}

async function updateWalletInfo() {
    try {
        const addressResult = await api.wallet.getAddress();
        if (addressResult.success) {
            walletState.address = addressResult.address;
        }

        const balanceResult = await api.wallet.getBalance();
        if (balanceResult.success) {
            walletState.balance = balanceResult.balance;
        }
    } catch (error) {
        console.error('Failed to update wallet info:', error);
    }
}

// ============================================================================
// UI RENDERING
// ============================================================================

async function renderWalletUI() {
    const container = document.getElementById('wallet-content');

    if (!container) return;

    if (!walletState.hasWallet) {
        container.innerHTML = renderSetupWallet();
    } else if (!walletState.isUnlocked) {
        container.innerHTML = renderUnlockWallet();
    } else {
        container.innerHTML = renderWalletDashboard();
    }

    // Attach event listeners
    attachWalletEventListeners();
}

function renderSetupWallet() {
    return `
        <div class="wallet-setup">
            <h3>Set Up Wallet</h3>
            <p class="text-secondary mb-3">Create a new wallet or import an existing one.</p>

            <button id="wallet-btn-create" class="btn btn-full mb-2">
                Create New Wallet
            </button>

            <button id="wallet-btn-import-mnemonic" class="btn btn-secondary btn-full mb-2">
                Import from Recovery Phrase
            </button>

            <button id="wallet-btn-import-key" class="btn btn-secondary btn-full">
                Import from Private Key
            </button>
        </div>
    `;
}

function renderUnlockWallet() {
    return `
        <div class="wallet-unlock">
            <h3>Unlock Wallet</h3>
            <p class="text-secondary mb-3">Enter your password to unlock your wallet.</p>

            <form id="wallet-form-unlock">
                <div class="form-group">
                    <label>Password</label>
                    <input
                        type="password"
                        id="wallet-input-password"
                        placeholder="Enter password"
                        required
                    >
                </div>

                <button type="submit" class="btn btn-full">
                    Unlock Wallet
                </button>
            </form>
        </div>
    `;
}

function renderWalletDashboard() {
    const shortAddress = walletState.address
        ? `${walletState.address.slice(0, 8)}...${walletState.address.slice(-8)}`
        : 'N/A';

    return `
        <div class="wallet-dashboard">
            <div class="wallet-info mb-3">
                <div class="info-row mb-2">
                    <span class="label">Address:</span>
                    <span class="value">${shortAddress}</span>
                </div>

                <div class="info-row mb-2">
                    <span class="label">Balance:</span>
                    <span class="value">${walletState.balance?.toFixed(4) || '0.0000'} SOL</span>
                </div>
            </div>

            <button id="wallet-btn-refresh" class="btn btn-secondary btn-full mb-2">
                Refresh Balance
            </button>

            <button id="wallet-btn-export" class="btn btn-secondary btn-full mb-2">
                Export Private Key
            </button>

            <button id="wallet-btn-lock" class="btn btn-danger btn-full">
                Lock Wallet
            </button>
        </div>
    `;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function attachWalletEventListeners() {
    // Setup buttons
    document.getElementById('wallet-btn-create')?.addEventListener('click', handleCreateWallet);
    document.getElementById('wallet-btn-import-mnemonic')?.addEventListener('click', handleImportMnemonic);
    document.getElementById('wallet-btn-import-key')?.addEventListener('click', handleImportKey);

    // Unlock form
    document.getElementById('wallet-form-unlock')?.addEventListener('submit', handleUnlock);

    // Dashboard buttons
    document.getElementById('wallet-btn-refresh')?.addEventListener('click', handleRefresh);
    document.getElementById('wallet-btn-export')?.addEventListener('click', handleExport);
    document.getElementById('wallet-btn-lock')?.addEventListener('click', handleLock);
}

async function handleCreateWallet() {
    const password = prompt('Enter a password to encrypt your wallet:');
    if (!password) return;

    const confirmPassword = prompt('Confirm password:');
    if (password !== confirmPassword) {
        ui.showToast('Passwords do not match', 'error');
        return;
    }

    try {
        const result = await api.wallet.generateNew(password);

        if (!result.success) {
            throw new Error(result.error || 'Failed to create wallet');
        }

        alert(`⚠️ SAVE YOUR RECOVERY PHRASE ⚠️\n\n${result.mnemonic}\n\nWrite this down and keep it safe. You will need it to recover your wallet.`);

        walletState.hasWallet = true;
        walletState.isUnlocked = true;
        walletState.address = result.address;

        await updateWalletInfo();
        await renderWalletUI();

        ui.showToast('Wallet created successfully', 'success');
    } catch (error) {
        ui.showToast(`Failed to create wallet: ${error.message}`, 'error');
    }
}

async function handleImportMnemonic() {
    const mnemonic = prompt('Enter your 12-word recovery phrase:');
    if (!mnemonic) return;

    const password = prompt('Enter a password to encrypt your wallet:');
    if (!password) return;

    try {
        const result = await api.wallet.importMnemonic(mnemonic, password);

        if (!result.success) {
            throw new Error(result.error || 'Failed to import wallet');
        }

        walletState.hasWallet = true;
        walletState.isUnlocked = true;
        walletState.address = result.address;

        await updateWalletInfo();
        await renderWalletUI();

        ui.showToast('Wallet imported successfully', 'success');
    } catch (error) {
        ui.showToast(`Failed to import wallet: ${error.message}`, 'error');
    }
}

async function handleImportKey() {
    const privateKey = prompt('Enter your private key (base58):');
    if (!privateKey) return;

    const password = prompt('Enter a password to encrypt your wallet:');
    if (!password) return;

    try {
        const result = await api.wallet.importPrivateKey(privateKey, password);

        if (!result.success) {
            throw new Error(result.error || 'Failed to import wallet');
        }

        walletState.hasWallet = true;
        walletState.isUnlocked = true;
        walletState.address = result.address;

        await updateWalletInfo();
        await renderWalletUI();

        ui.showToast('Wallet imported successfully', 'success');
    } catch (error) {
        ui.showToast(`Failed to import wallet: ${error.message}`, 'error');
    }
}

async function handleUnlock(e) {
    e.preventDefault();

    const password = document.getElementById('wallet-input-password')?.value;
    if (!password) return;

    try {
        const result = await api.wallet.unlock(password);

        if (!result.success) {
            throw new Error(result.error || 'Failed to unlock wallet');
        }

        walletState.isUnlocked = true;
        walletState.address = result.address;

        await updateWalletInfo();
        await renderWalletUI();

        ui.showToast('Wallet unlocked', 'success');
    } catch (error) {
        ui.showToast(`Failed to unlock wallet: ${error.message}`, 'error');
    }
}

async function handleRefresh() {
    try {
        await updateWalletInfo();
        await renderWalletUI();
        ui.showToast('Balance refreshed', 'success');
    } catch (error) {
        ui.showToast(`Failed to refresh balance: ${error.message}`, 'error');
    }
}

async function handleExport() {
    if (!confirm('⚠️ Warning: Your private key will be displayed. Make sure no one is watching your screen.')) {
        return;
    }

    try {
        const result = await api.wallet.exportPrivateKey();

        if (!result.success) {
            throw new Error(result.error || 'Failed to export private key');
        }

        alert(`Your Private Key:\n\n${result.private_key}\n\nKeep this safe and never share it.`);
    } catch (error) {
        ui.showToast(`Failed to export private key: ${error.message}`, 'error');
    }
}

async function handleLock() {
    try {
        await api.wallet.lock();

        walletState.isUnlocked = false;
        walletState.address = null;
        walletState.balance = null;

        await renderWalletUI();

        ui.showToast('Wallet locked', 'success');
    } catch (error) {
        ui.showToast(`Failed to lock wallet: ${error.message}`, 'error');
    }
}
