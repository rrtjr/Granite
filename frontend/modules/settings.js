// Granite Frontend - User Settings Module

import { Debug } from './config.js';
import { refreshAllPaneEditors } from './panes.js';

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

                // Apply typography settings
                if (settings.typography) {
                    this.typographySettings = {
                        fontSize: settings.typography.fontSize || 'base',
                        fontFamily: settings.typography.fontFamily || 'system',
                        editorFontFamily: settings.typography.editorFontFamily || 'mono',
                        editorFontSize: settings.typography.editorFontSize || 'base'
                    };
                } else {
                    // Initialize with defaults if not present
                    this.typographySettings = {
                        fontSize: 'base',
                        fontFamily: 'system',
                        editorFontFamily: 'mono',
                        editorFontSize: 'base'
                    };
                }
                // Always apply typography on load
                this.applyTypographySettings();
            } else {
                await this.migrateFromLocalStorage();
            }
        } catch (error) {
            Debug.error('Error loading user settings:', error);
            await this.migrateFromLocalStorage();
        }

        // Always ensure typography is applied (even if settings load fails)
        if (!this.typographySettings) {
            this.typographySettings = {
                fontSize: 'base',
                fontFamily: 'system',
                editorFontFamily: 'mono',
                editorFontSize: 'base'
            };
        }
        this.applyTypographySettings();
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
                Debug.log('Migrated settings from localStorage to server');
            }
        } catch (error) {
            Debug.error('Error migrating from localStorage:', error);
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
                datetime: this.datetimeSettings,
                typography: this.typographySettings
            };

            const response = await fetch('/api/settings/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                Debug.log('User settings saved successfully');
                return true;
            } else {
                Debug.error('Failed to save user settings');
                return false;
            }
        } catch (error) {
            Debug.error('Error saving user settings:', error);
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

    // Save typography settings (called from UI)
    saveTypographySettings() {
        this.applyTypographySettings();
        this.saveUserSettings();
    },

    // Apply typography settings to DOM
    applyTypographySettings() {
        if (!this.typographySettings) {
            Debug.warn('Typography settings not initialized, using defaults');
            this.typographySettings = {
                fontSize: 'base',
                fontFamily: 'system',
                editorFontFamily: 'mono',
                editorFontSize: 'base'
            };
        }

        // Backfill new editor settings for existing configs that don't have them
        if (!this.typographySettings.editorFontFamily) {
            this.typographySettings.editorFontFamily = 'mono';
        }
        if (!this.typographySettings.editorFontSize) {
            this.typographySettings.editorFontSize = 'base';
        }

        const root = document.documentElement;

        // Font size mapping (multiplier × 16px)
        const fontSizeMap = {
            'xs': 0.875,     // 87.5% = 14px base
            'sm': 0.9375,    // 93.75% = 15px base
            'base': 1.0,     // 100% = 16px base (default)
            'lg': 1.0625,    // 106.25% = 17px base
            'xl': 1.125,     // 112.5% = 18px base
            '2xl': 1.25,     // 125% = 20px base
            '3xl': 1.375     // 137.5% = 22px base
        };

        // Apply font size to root
        const fontSizeMultiplier = fontSizeMap[this.typographySettings.fontSize] || 1.0;
        const baseFontSize = fontSizeMultiplier * 16;
        root.style.fontSize = `${baseFontSize}px`;

        // Font family mapping
        const fontFamilyMap = {
            'system': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            'serif': 'Georgia, Cambria, "Times New Roman", Times, serif',
            'mono': '"SF Mono", Monaco, Menlo, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
            'inter': '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            'open-sans': '"Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        };

        // Apply font family to CSS variable
        const fontFamily = fontFamilyMap[this.typographySettings.fontFamily] || fontFamilyMap['system'];
        root.style.setProperty('--font-family-base', fontFamily);

        // Apply editor font family to CSS variable
        const editorFontFamily = fontFamilyMap[this.typographySettings.editorFontFamily] || fontFamilyMap['mono'];
        root.style.setProperty('--font-family-editor', editorFontFamily);

        // Apply editor font size to CSS variable
        const editorFontSizeMultiplier = fontSizeMap[this.typographySettings.editorFontSize] || 1.0;
        const editorFontSize = editorFontSizeMultiplier * 16;
        root.style.setProperty('--font-size-editor', `${editorFontSize}px`);

        Debug.log('Typography settings applied:', {
            fontSize: this.typographySettings.fontSize,
            fontFamily: this.typographySettings.fontFamily,
            editorFontFamily: this.typographySettings.editorFontFamily,
            editorFontSize: this.typographySettings.editorFontSize,
            computedFontSize: `${baseFontSize}px`,
            computedFontFamily: fontFamily,
            computedEditorFontFamily: editorFontFamily,
            computedEditorFontSize: `${editorFontSize}px`
        });

        // Tell CodeMirror editors to re-measure after CSS variable changes
        if (this.editorView) {
            this.editorView.requestMeasure();
        }
        refreshAllPaneEditors();
    },

    // Reset typography settings to defaults
    resetTypographySettings() {
        this.typographySettings = {
            fontSize: 'base',
            fontFamily: 'system',
            editorFontFamily: 'mono',
            editorFontSize: 'base'
        };
        this.saveTypographySettings();
    },
};
