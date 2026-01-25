// Granite Frontend - Plugins Module

import { Debug, ErrorHandler } from './config.js';

export const pluginsMixin = {
    // Load all available plugins and update their states
    async loadPlugins() {
        try {
            const response = await fetch('/api/plugins');
            const data = await response.json();
            this.availablePlugins = data.plugins || [];

            // Update individual plugin states
            const statsPlugin = this.availablePlugins.find(p => p.id === 'note_stats');
            this.statsPluginEnabled = statsPlugin && statsPlugin.enabled;

            // Calculate stats for current note if stats plugin is enabled
            if (this.statsPluginEnabled && this.noteContent) {
                this.calculateStats();
            }
        } catch (error) {
            ErrorHandler.handle('load plugins', error, false);
            this.availablePlugins = [];
            this.statsPluginEnabled = false;
        }
    },

    // Toggle a plugin on/off
    async togglePlugin(pluginId, enabled) {
        try {
            const response = await fetch(`/api/plugins/${pluginId}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });

            if (!response.ok) {
                throw new Error(`Failed to toggle plugin: ${response.statusText}`);
            }

            await this.loadPlugins();
        } catch (error) {
            ErrorHandler.handle('toggle plugin', error, true);
        }
    },

    // Open git settings modal
    async openGitSettings() {
        Debug.info('Git Settings', 'Opening modal...');
        try {
            this.gitSettings = null;
            this.gitStatus = null;

            const settingsResponse = await fetch('/api/plugins/git/settings');
            if (settingsResponse.ok) {
                const settingsData = await settingsResponse.json();
                this.gitSettings = settingsData.settings || {};
            }

            const statusResponse = await fetch('/api/plugins/git/status');
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                this.gitStatus = statusData;
            }

            this.showGitSettingsModal = true;
        } catch (error) {
            ErrorHandler.handle('load git settings', error, true);
            this.gitSettings = {};
            this.gitStatus = {};
        }
    },

    // Save git settings
    async saveGitSettings() {
        try {
            const response = await fetch('/api/plugins/git/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.gitSettings)
            });

            if (!response.ok) {
                throw new Error(`Failed to save git settings: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                this.gitSettings = data.settings;
                this.showGitSettingsModal = false;
                Debug.log('Git settings saved successfully');
            }
        } catch (error) {
            ErrorHandler.handle('save git settings', error, true);
        }
    },

    // Manual git backup
    async manualGitBackup() {
        Debug.info('Git Plugin', 'Manual backup triggered');
        try {
            const response = await fetch('/api/plugins/git/manual-backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorText = await response.text();
                Debug.error('[Git Plugin] Backup failed:', response.status, errorText);
                throw new Error(`Failed to trigger git backup: ${response.statusText}`);
            }

            const data = await response.json();
            Debug.info('Git Plugin', 'Backup response:', data);
            if (data.success) {
                Debug.info('Git Plugin', 'Backup completed successfully');
                alert('Git backup completed! Check Docker logs for details.');
                await this.openGitSettings();
            } else {
                Debug.warn('[Git Plugin] Backup returned success=false');
            }
        } catch (error) {
            Debug.error('[Git Plugin] Backup error:', error);
            ErrorHandler.handle('manual git backup', error, true);
        }
    },

    // Manual git pull
    async manualGitPull() {
        Debug.info('Git Plugin', 'Manual pull triggered');
        try {
            const response = await fetch('/api/plugins/git/manual-pull', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorText = await response.text();
                Debug.error('[Git Plugin] Pull failed:', response.status, errorText);
                throw new Error(`Failed to trigger git pull: ${response.statusText}`);
            }

            const data = await response.json();
            Debug.info('Git Plugin', 'Pull response:', data);
            if (data.success) {
                Debug.info('Git Plugin', 'Pull completed successfully');
                alert('Git pull completed! Check Docker logs for details.');
                await this.loadNotes();
            } else {
                Debug.warn('[Git Plugin] Pull returned success=false');
            }
        } catch (error) {
            Debug.error('[Git Plugin] Pull error:', error);
            ErrorHandler.handle('manual git pull', error, true);
        }
    },

    // Open PDF Export settings modal
    async openPdfExportSettings() {
        Debug.info('PDF Export Settings', 'Opening modal...');
        try {
            const response = await fetch('/api/plugins/pdf_export/settings');
            if (response.ok) {
                const data = await response.json();
                this.pdfExportSettings = data.settings || this.pdfExportSettings;
                Debug.info('PDF Export Settings', 'Loaded settings:', this.pdfExportSettings);
            } else {
                Debug.warn('[PDF Export Settings] Failed to load settings');
            }

            this.showPdfExportSettingsModal = true;
        } catch (error) {
            ErrorHandler.handle('load PDF export settings', error, true);
        }
    },

    // Save PDF Export settings
    async savePdfExportSettings() {
        Debug.info('PDF Export Settings', 'Saving settings...');
        try {
            const response = await fetch('/api/plugins/pdf_export/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.pdfExportSettings)
            });

            if (!response.ok) {
                throw new Error(`Failed to save PDF export settings: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                this.pdfExportSettings = data.settings;
                this.showPdfExportSettingsModal = false;
                Debug.info('PDF Export Settings', 'Settings saved successfully');
                alert('PDF export settings saved successfully!');
            } else {
                throw new Error(data.message || 'Failed to save settings');
            }
        } catch (error) {
            ErrorHandler.handle('save PDF export settings', error, true);
        }
    },

    // Open Unsplash banner picker modal
    openUnsplashPicker() {
        this.unsplashUrl = '';
        this.unsplashPreviewError = false;
        this.showUnsplashModal = true;
    },

    // Handle Unsplash URL preview
    previewUnsplashUrl() {
        this.unsplashPreviewError = false;
    },

    // Handle preview image error
    handleUnsplashPreviewError() {
        this.unsplashPreviewError = true;
    },

    // Insert Unsplash URL as banner
    insertUnsplashBanner() {
        if (!this.unsplashUrl.trim()) return;

        const bannerUrl = this.unsplashUrl.trim();
        let content = this.noteContent;
        let newContent = content;

        if (content.trim().startsWith('---')) {
            const lines = content.split('\n');
            let endIdx = -1;
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '---') {
                    endIdx = i;
                    break;
                }
            }

            if (endIdx > 0) {
                let bannerIdx = -1;
                for (let i = 1; i < endIdx; i++) {
                    if (lines[i].trim().startsWith('banner:')) {
                        bannerIdx = i;
                        break;
                    }
                }

                if (bannerIdx > 0) {
                    lines[bannerIdx] = `banner: "${bannerUrl}"`;
                } else {
                    lines.splice(endIdx, 0, `banner: "${bannerUrl}"`);
                }
                newContent = lines.join('\n');
            } else {
                newContent = `---\nbanner: "${bannerUrl}"\n---\n\n${content}`;
            }
        } else {
            newContent = `---\nbanner: "${bannerUrl}"\n---\n\n${content}`;
        }

        this.noteContent = newContent;
        this.updateEditorContent(newContent);

        this.showUnsplashModal = false;
        this.unsplashUrl = '';
        this.unsplashPreviewError = false;

        this.debouncedSave();
    },
};
