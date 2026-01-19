// Granite Frontend - Templates Module

export const templatesMixin = {
    // Load available templates from _templates folder
    async loadTemplates() {
        try {
            const response = await fetch('/api/templates');
            const data = await response.json();
            this.availableTemplates = data.templates || [];
        } catch (error) {
            console.error('Failed to load templates:', error);
        }
    },

    // Create a new note from a template
    async createNoteFromTemplate() {
        if (!this.selectedTemplate || !this.newTemplateNoteName.trim()) {
            return;
        }

        try {
            let notePath = this.newTemplateNoteName.trim();
            if (!notePath.endsWith('.md')) {
                notePath += '.md';
            }

            // Determine target folder
            let targetFolder;
            if (this.dropdownTargetFolder !== null && this.dropdownTargetFolder !== undefined) {
                targetFolder = this.dropdownTargetFolder;
            } else {
                targetFolder = this.selectedHomepageFolder || '';
            }

            if (targetFolder) {
                notePath = `${targetFolder}/${notePath}`;
            }

            // Check if note already exists
            const existingNote = this.notes.find(note => note.path === notePath);
            if (existingNote) {
                alert(`A note named "${this.newTemplateNoteName.trim()}" already exists in this location.\nPlease choose a different name.`);
                return;
            }

            const response = await fetch('/api/templates/create-note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateName: this.selectedTemplate,
                    notePath: notePath
                })
            });

            if (!response.ok) {
                const error = await response.json();
                alert(error.detail || 'Failed to create note from template');
                return;
            }

            const data = await response.json();

            // Close modal and reset state
            this.showTemplateModal = false;
            this.selectedTemplate = '';
            this.newTemplateNoteName = '';

            // Reload notes and open the new note
            await this.loadNotes();
            await this.loadNote(data.path);

        } catch (error) {
            console.error('Failed to create note from template:', error);
            alert('Failed to create note from template. Please try again.');
        }
    },
};
