/**
 * Offline operation queue for managing text editor operations when disconnected.
 * Handles queuing, persistence, and synchronization of operations.
 */
export class OfflineQueue {
    constructor(documentId = 'default') {
        this.documentId = documentId;
        this.storageKey = `collaborative-editor-queue-${documentId}`;
        this.documentStateKey = `collaborative-editor-state-${documentId}`;
        this.operations = this.loadFromStorage();
    }

    /**
     * Add an operation to the queue
     */
    enqueue(operation) {
        const queuedOperation = {
            ...operation,
            queuedAt: Date.now(),
            id: this.generateOperationId()
        };
        
        this.operations.push(queuedOperation);
        this.saveToStorage();
        return queuedOperation;
    }

    /**
     * Get all queued operations
     */
    getAll() {
        return [...this.operations];
    }

    /**
     * Get the number of queued operations
     */
    size() {
        return this.operations.length;
    }

    /**
     * Remove operations that have been successfully synchronized
     */
    removeProcessed(operationIds) {
        this.operations = this.operations.filter(op => !operationIds.includes(op.id));
        this.saveToStorage();
    }

    /**
     * Clear all queued operations
     */
    clear() {
        this.operations = [];
        this.saveToStorage();
    }

    /**
     * Save document state to localStorage
     */
    saveDocumentState(state) {
        try {
            localStorage.setItem(this.documentStateKey, JSON.stringify(state));
        } catch (error) {
            console.warn('Failed to save document state to localStorage:', error);
        }
    }

    /**
     * Load document state from localStorage
     */
    loadDocumentState() {
        try {
            const stored = localStorage.getItem(this.documentStateKey);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.warn('Failed to load document state from localStorage:', error);
            return null;
        }
    }

    /**
     * Generate a unique ID for queued operations
     */
    generateOperationId() {
        return `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Save operations to localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.operations));
        } catch (error) {
            console.warn('Failed to save operations to localStorage:', error);
        }
    }

    /**
     * Load operations from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn('Failed to load operations from localStorage:', error);
            return [];
        }
    }

    /**
     * Get operations that are older than specified time (for cleanup)
     */
    getStaleOperations(maxAgeMs = 7 * 24 * 60 * 60 * 1000) { // 7 days default
        const cutoff = Date.now() - maxAgeMs;
        return this.operations.filter(op => op.queuedAt < cutoff);
    }

    /**
     * Remove stale operations from the queue
     */
    cleanupStale(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
        const cutoff = Date.now() - maxAgeMs;
        const originalSize = this.operations.length;
        this.operations = this.operations.filter(op => op.queuedAt >= cutoff);
        
        if (this.operations.length !== originalSize) {
            this.saveToStorage();
            console.log(`Cleaned up ${originalSize - this.operations.length} stale operations`);
        }
    }
}
