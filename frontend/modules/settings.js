// Granite Frontend - User Settings Module

export const settingsMixin = {
    // Load all user settings from server (with localStorage migration)
    async loadUserSettings() {
        try {
            const response = await fetch('/api/settings/user');

            if (response.ok) {
                const settings = await response.json();

                // Apply reading preferences
                if (settings.reading) {
                    this.readingWidth = settings.reading.width || 'full';
                    this.contentAlign = settings.reading.align || 'left';
                    this.contentMargins = settings.reading.margins || 'normal';
                    this.bannerOpacity = settings.reading.bannerOpacity !== undefined ? parseFloat(settings.reading.bannerOpacity) : 0.5;
                }

                // Apply performance settings
                if (settings.performance) {
                    this.performanceSettings = {
                        updateDelay: settings.performance.updateDelay || 100,
                        statsDelay: settings.performance.statsDelay || 300,
                        metadataDelay: settings.performance.metadataDelay || 300,
                        historyDelay: settings.performance.historyDelay || 500,
                        autosaveDelay: settings.performance.autosaveDelay || 1000
                    };
                }

                // Apply paths
                if (settings.paths) {
                    this.templatesDir = settings.paths.templatesDir || '_templates';
                    this.homepageFile = settings.paths.homepageFile || '';
                }

                // Apply datetime settings
                if (settings.datetime) {
                    this.datetimeSettings = {
                        timezone: settings.datetime.timezone || 'local',
                        updateModifiedOnOpen: settings.datetime.updateModifiedOnOpen !== false,
                    };
                }
            } else {
                await this.migrateFromLocalStorage();
            }
        } catch (error) {
            console.error('Error loading user settings:', error);
            await this.migrateFromLocalStorage();
        }
    },

    // Migrate settings from localStorage to server (one-time migration)
    async migrateFromLocalStorage() {
        try {
            const localSettings = {
                reading: {},
                performance: {},
                paths: {}
            };

            let hasLocalSettings = false;

            const savedWidth = localStorage.getItem('readingWidth');
            if (savedWidth) {
                localSettings.reading.width = savedWidth;
                this.readingWidth = savedWidth;
                hasLocalSettings = true;
            }

            const savedAlign = localStorage.getItem('contentAlign');
            if (savedAlign) {
                localSettings.reading.align = savedAlign;
                this.contentAlign = savedAlign;
                hasLocalSettings = true;
            }

            const savedMargins = localStorage.getItem('contentMargins');
            if (savedMargins) {
                localSettings.reading.margins = savedMargins;
                this.contentMargins = savedMargins;
                hasLocalSettings = true;
            }

            const savedPerformance = localStorage.getItem('performanceSettings');
            if (savedPerformance) {
                const perfSettings = JSON.parse(savedPerformance);
                localSettings.performance = perfSettings;
                this.performanceSettings = perfSettings;
                hasLocalSettings = true;
            }

            const savedTemplatesDir = localStorage.getItem('templatesDir');
            if (savedTemplatesDir) {
                localSettings.paths.templatesDir = savedTemplatesDir;
                this.templatesDir = savedTemplatesDir;
                hasLocalSettings = true;
            }

            if (hasLocalSettings) {
                await this.saveUserSettings(localSettings);
                console.log('Migrated settings from localStorage to server');
            }
        } catch (error) {
            console.error('Error migrating from localStorage:', error);
        }
    },

    // Save all user settings to server
    async saveUserSettings(settingsData = null) {
        try {
            const data = settingsData || {
                reading: {
                    width: this.readingWidth,
                    align: this.contentAlign,
                    margins: this.contentMargins,
                    bannerOpacity: this.bannerOpacity
                },
                performance: this.performanceSettings,
                paths: {
                    templatesDir: this.templatesDir,
                    homepageFile: this.homepageFile
                },
                datetime: this.datetimeSettings
            };

            const response = await fetch('/api/settings/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                console.log('User settings saved successfully');
                return true;
            } else {
                console.error('Failed to save user settings');
                return false;
            }
        } catch (error) {
            console.error('Error saving user settings:', error);
            return false;
        }
    },

    // Save reading preferences (called from UI)
    saveReadingPreferences() {
        this.saveUserSettings();
    },

    // Save templates path (called from UI)
    saveTemplatesPath() {
        this.saveUserSettings();
    },

    // Save homepage file path (called from UI)
    saveHomepageFile() {
        this.saveUserSettings();
    },

    // Save performance settings (called from UI)
    savePerformanceSettings() {
        this.saveUserSettings();
    },

    // Save datetime settings (called from UI)
    saveDatetimeSettings() {
        this.saveUserSettings();
    },

    // Reset performance settings to defaults
    resetPerformanceSettings() {
        this.performanceSettings = {
            updateDelay: 100,
            statsDelay: 300,
            metadataDelay: 300,
            historyDelay: 500,
            autosaveDelay: 1000
        };
        this.savePerformanceSettings();
    },
};
