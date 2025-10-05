/**
 * Wallet UI Manager
 * Handles all wallet interactions and UI state management
 */

class WalletUI {
    constructor() {
        this.wallet = null;
        this.currentMnemonic = null; // Store temporarily for display

        // Initialize DOM elements
        this.modal = document.getElementById('wallet-modal');
        this.walletBtn = document.getElementById('wallet-btn');
        this.walletBalanceDisplay = document.getElementById('wallet-balance');

        // Screens
        this.screens = {
            setup: document.getElementById('wallet-setup'),
            create: document.getElementById('wallet-create'),
            recovery: document.getElementById('wallet-recovery'),
            import: document.getElementById('wallet-import'),
            unlock: document.getElementById('wallet-unlock'),
            main: document.getElementById('wallet-main'),
            export: document.getElementById('wallet-export')
        };

        // Initialize wallet instance
        if (typeof SolanaWallet !== 'undefined') {
            this.wallet = new SolanaWallet();
        }

        this.bindEvents();
        this.checkWalletStatus();
    }

    bindEvents() {
        // Open/close wallet modal
        this.walletBtn.addEventListener('click', () => this.openWallet());
        document.getElementById('wallet-close-btn').addEventListener('click', () => this.closeModal());

        // Setup screen
        document.getElementById('create-wallet-btn').addEventListener('click', () => this.showScreen('create'));
        document.getElementById('import-wallet-btn').addEventListener('click', () => this.showScreen('import'));

        // Create wallet flow
        document.getElementById('create-wallet-submit-btn').addEventListener('click', () => this.handleCreateWallet());
        document.getElementById('create-wallet-back-btn').addEventListener('click', () => this.showScreen('setup'));

        // Recovery phrase screen
        document.getElementById('copy-recovery-btn').addEventListener('click', () => this.copyRecoveryPhrase());
        document.getElementById('recovery-continue-btn').addEventListener('click', () => {
            this.showScreen('main');
            this.loadWalletInfo();
        });

        // Import tabs
        const importTabs = document.querySelectorAll('.import-tab');
        importTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchImportTab(tab.dataset.tab));
        });

        // Import wallet flow
        document.getElementById('import-wallet-submit-btn').addEventListener('click', () => this.handleImportWallet());
        document.getElementById('import-wallet-back-btn').addEventListener('click', () => this.showScreen('setup'));

        // Unlock wallet
        document.getElementById('unlock-wallet-btn').addEventListener('click', () => this.handleUnlockWallet());
        document.getElementById('wallet-unlock-close-btn').addEventListener('click', () => this.closeModal());
        document.getElementById('unlock-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleUnlockWallet();
        });

        // Reset wallet link
        document.getElementById('reset-wallet-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleResetWallet();
        });

        // Main wallet screen
        document.getElementById('copy-address-btn').addEventListener('click', () => this.copyAddress());
        document.getElementById('refresh-balance-btn').addEventListener('click', () => this.refreshBalance());
        document.getElementById('export-keys-btn').addEventListener('click', () => this.showExportScreen());
        document.getElementById('lock-wallet-btn').addEventListener('click', () => this.lockWallet());

        // Export screen
        document.getElementById('copy-export-mnemonic-btn').addEventListener('click', () => this.copyExportMnemonic());
        document.getElementById('copy-export-key-btn').addEventListener('click', () => this.copyExportPrivateKey());
        document.getElementById('export-back-btn').addEventListener('click', () => this.showScreen('main'));

        // Close modal on background click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });
    }

    checkWalletStatus() {
        if (!this.wallet) {
            this.walletBalanceDisplay.textContent = 'N/A';
            return;
        }

        // Check if wallet exists in storage
        const hasWallet = this.wallet.hasWallet();
        if (hasWallet && this.wallet.isUnlocked) {
            this.loadWalletInfo();
        }
    }

    openWallet() {
        if (!this.wallet) {
            this.showStatus('Wallet not available', 'error');
            return;
        }

        const hasWallet = this.wallet.hasWallet();

        if (!hasWallet) {
            this.showScreen('setup');
        } else if (!this.wallet.isUnlocked) {
            this.showScreen('unlock');
        } else {
            this.showScreen('main');
            this.loadWalletInfo();
        }

        this.modal.classList.remove('hidden');
    }

    closeModal() {
        this.modal.classList.add('hidden');
        this.clearInputs();
        this.hideStatus();
    }

    showScreen(screenName) {
        // Hide all screens
        Object.values(this.screens).forEach(screen => {
            if (screen) screen.classList.add('hidden');
        });

        // Show requested screen
        if (this.screens[screenName]) {
            this.screens[screenName].classList.remove('hidden');
        }

        this.hideStatus();
    }

    async handleCreateWallet() {
        const password = document.getElementById('create-password').value;
        const confirmPassword = document.getElementById('create-password-confirm').value;

        if (!password || !confirmPassword) {
            this.showStatus('Please enter and confirm password', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showStatus('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            this.showStatus('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            this.showStatus('Creating wallet...', 'info');

            const result = await this.wallet.generateNew(password);
            this.currentMnemonic = result.mnemonic;

            // Display recovery phrase
            document.getElementById('recovery-phrase-display').textContent = result.mnemonic;

            this.showScreen('recovery');
            this.showStatus('Wallet created! Save your recovery phrase.', 'success');
        } catch (error) {
            this.showStatus(`Failed to create wallet: ${error.message}`, 'error');
        }
    }

    copyRecoveryPhrase() {
        const phrase = document.getElementById('recovery-phrase-display').textContent;
        navigator.clipboard.writeText(phrase).then(() => {
            this.showStatus('Recovery phrase copied!', 'success');
        }).catch(() => {
            this.showStatus('Failed to copy', 'error');
        });
    }

    switchImportTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.import-tab').forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Show/hide tab content
        if (tabName === 'mnemonic') {
            document.getElementById('import-mnemonic-tab').classList.remove('hidden');
            document.getElementById('import-private-key-tab').classList.add('hidden');
        } else {
            document.getElementById('import-mnemonic-tab').classList.add('hidden');
            document.getElementById('import-private-key-tab').classList.remove('hidden');
        }
    }

    async handleImportWallet() {
        const activeTab = document.querySelector('.import-tab.active').dataset.tab;

        try {
            this.showStatus('Importing wallet...', 'info');

            if (activeTab === 'mnemonic') {
                const mnemonic = document.getElementById('import-mnemonic').value.trim();
                const password = document.getElementById('import-password').value;

                if (!mnemonic || !password) {
                    this.showStatus('Please enter recovery phrase and password', 'error');
                    return;
                }

                await this.wallet.importFromMnemonic(mnemonic, password);
            } else {
                const privateKey = document.getElementById('import-private-key').value.trim();
                const password = document.getElementById('import-key-password').value;

                if (!privateKey || !password) {
                    this.showStatus('Please enter private key and password', 'error');
                    return;
                }

                await this.wallet.importFromPrivateKey(privateKey, password);
            }

            this.showStatus('Wallet imported successfully!', 'success');
            this.showScreen('main');
            this.loadWalletInfo();
        } catch (error) {
            this.showStatus(`Failed to import: ${error.message}`, 'error');
        }
    }

    async handleUnlockWallet() {
        const password = document.getElementById('unlock-password').value;

        if (!password) {
            this.showStatus('Please enter password', 'error');
            return;
        }

        try {
            this.showStatus('Unlocking wallet...', 'info');

            await this.wallet.unlock(password);

            this.showStatus('Wallet unlocked!', 'success');
            this.showScreen('main');
            this.loadWalletInfo();
        } catch (error) {
            this.showStatus('Incorrect password', 'error');
        }
    }

    async loadWalletInfo() {
        if (!this.wallet || !this.wallet.isUnlocked) return;

        try {
            // Get and display address
            const address = this.wallet.getAddress();
            document.getElementById('wallet-address-display').textContent = address;

            // Get and display balance
            await this.refreshBalance();
        } catch (error) {
            console.error('Failed to load wallet info:', error);
        }
    }

    async refreshBalance() {
        if (!this.wallet || !this.wallet.isUnlocked) return;

        try {
            document.getElementById('wallet-balance-display').textContent = 'Loading...';
            this.walletBalanceDisplay.textContent = '...';

            const balance = await this.wallet.getBalance();
            const balanceText = `${balance.toFixed(4)} SOL`;

            document.getElementById('wallet-balance-display').textContent = balanceText;
            this.walletBalanceDisplay.textContent = balance.toFixed(2);
        } catch (error) {
            document.getElementById('wallet-balance-display').textContent = 'Error';
            this.walletBalanceDisplay.textContent = '--';
            console.error('Failed to get balance:', error);
        }
    }

    copyAddress() {
        const address = document.getElementById('wallet-address-display').textContent;
        navigator.clipboard.writeText(address).then(() => {
            this.showStatus('Address copied!', 'success');
        }).catch(() => {
            this.showStatus('Failed to copy', 'error');
        });
    }

    showExportScreen() {
        if (!this.wallet || !this.wallet.isUnlocked) {
            this.showStatus('Wallet must be unlocked', 'error');
            return;
        }

        try {
            // Get private key
            const privateKey = this.wallet.exportPrivateKey();
            document.getElementById('export-private-key-display').textContent = privateKey;

            // Note: We can't retrieve the mnemonic after wallet creation
            // It's only available during generateNew()
            if (this.currentMnemonic) {
                document.getElementById('export-mnemonic-display').textContent = this.currentMnemonic;
            } else {
                document.getElementById('export-mnemonic-display').textContent =
                    'Recovery phrase not available. It was shown only during wallet creation.';
            }

            this.showScreen('export');
        } catch (error) {
            this.showStatus(`Failed to export: ${error.message}`, 'error');
        }
    }

    copyExportMnemonic() {
        const mnemonic = document.getElementById('export-mnemonic-display').textContent;
        if (mnemonic.includes('not available')) {
            this.showStatus('Recovery phrase not available', 'error');
            return;
        }

        navigator.clipboard.writeText(mnemonic).then(() => {
            this.showStatus('Recovery phrase copied!', 'success');
        }).catch(() => {
            this.showStatus('Failed to copy', 'error');
        });
    }

    copyExportPrivateKey() {
        const privateKey = document.getElementById('export-private-key-display').textContent;
        navigator.clipboard.writeText(privateKey).then(() => {
            this.showStatus('Private key copied!', 'success');
        }).catch(() => {
            this.showStatus('Failed to copy', 'error');
        });
    }

    lockWallet() {
        this.wallet.lock();
        this.currentMnemonic = null;
        this.walletBalanceDisplay.textContent = '--';
        this.showStatus('Wallet locked', 'info');
        this.showScreen('unlock');
    }

    handleResetWallet() {
        const confirmed = confirm(
            'Are you sure you want to reset your wallet? ' +
            'Make sure you have backed up your recovery phrase or private key!'
        );

        if (confirmed) {
            // Clear localStorage
            localStorage.removeItem('solana_wallet_encrypted');
            localStorage.removeItem('solana_wallet_address');

            this.wallet.lock();
            this.currentMnemonic = null;
            this.walletBalanceDisplay.textContent = '--';

            this.showStatus('Wallet reset. You can now import a different wallet.', 'info');
            this.showScreen('setup');
        }
    }

    showStatus(message, type = 'info') {
        const status = document.getElementById('wallet-status');
        status.textContent = message;
        status.className = `wallet-status ${type}`;
        status.classList.remove('hidden');
    }

    hideStatus() {
        const status = document.getElementById('wallet-status');
        status.classList.add('hidden');
    }

    clearInputs() {
        // Clear all password inputs
        document.querySelectorAll('input[type="password"]').forEach(input => {
            input.value = '';
        });

        // Clear textareas
        document.querySelectorAll('textarea').forEach(textarea => {
            textarea.value = '';
        });
    }
}

// Initialize wallet UI when DOM is ready
let walletUI;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        walletUI = new WalletUI();
    });
} else {
    walletUI = new WalletUI();
}

// Export for use in other scripts
window.walletUI = walletUI;
