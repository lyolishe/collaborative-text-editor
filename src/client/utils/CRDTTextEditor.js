/**
 * A simplified CRDT (Conflict-free Replicated Data Type) implementation for text editing.
 * This implementation uses Lamport timestamps and site IDs for conflict resolution.
 */
export class CRDTTextEditor {
    constructor(siteId) {
        this.siteId = siteId;
        this.lamportTime = 0;
        this.data = [];
        this.tombstones = new Map(); // Track deleted characters
        this.idCounter = 0; // Counter for generating unique operation IDs
    }

    generateIdBetween(prevId, nextId, depth = 0) {
        const BASE = 1000000; // Large base for ID generation
        
        // Handle edge cases first
        if (!prevId && !nextId) {
            return [BASE];
        }
        
        if (!prevId) {
            const nextPos = nextId[depth] || 0;
            if (nextPos > 1) {
                return [...(nextId.slice(0, depth)), Math.floor(nextPos / 2)];
            } else {
                return [...(nextId.slice(0, depth)), 0, BASE];
            }
        }
        
        if (!nextId) {
            const prevPos = prevId[depth] || 0;
            return [...(prevId.slice(0, depth)), prevPos + BASE];
        }
        
        // Both IDs exist, generate between them
        const prevPos = prevId[depth] || 0;
        const nextPos = nextId[depth] || BASE * 2;
        
        if (prevPos < nextPos - 1) {
            const newPos = Math.floor((prevPos + nextPos) / 2);
            return [...(prevId.slice(0, depth)), newPos];
        } else {
            // Need to go deeper
            const prevIdExtended = [...prevId];
            const nextIdExtended = [...nextId];
            
            // Extend the shorter ID with zeros
            while (prevIdExtended.length <= depth) prevIdExtended.push(0);
            while (nextIdExtended.length <= depth) nextIdExtended.push(BASE * 2);
            
            return this.generateIdBetween(prevIdExtended, nextIdExtended, depth + 1);
        }
    }

    compareIds(id1, id2) {
        const minLength = Math.min(id1.length, id2.length);
        for (let i = 0; i < minLength; i++) {
            if (id1[i] !== id2[i]) return id1[i] - id2[i];
        }
        return id1.length - id2.length;
    }

    findIndexForId(targetId) {
        let low = 0;
        let high = this.data.length;

        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            const midId = this.data[mid].id;
            const comparison = this.compareIds(midId, targetId);

            if (comparison < 0) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        return low;
    }

    /**
     * Insert a character at the specified index locally.
     * Creates a new operation that can be sent to other clients.
     */
    localInsert(index, char) {
        this.lamportTime++;
        this.idCounter++;

        // Create a unique ID for this character: [timestamp, siteId, counter]
        const newId = [this.lamportTime, this.siteId, this.idCounter];
        
        const newChar = {
            id: newId,
            value: char,
            timestamp: this.lamportTime,
            siteId: this.siteId,
            position: index
        };

        // Insert the character at the specified index
        this.data.splice(index, 0, newChar);

        // Return operation for broadcasting to other clients
        return {
            type: 'insert',
            id: newId,
            value: char,
            timestamp: this.lamportTime,
            siteId: this.siteId,
            position: index
        };
    }

    /**
     * Delete a character at the specified index locally.
     * Creates a delete operation that can be sent to other clients.
     */
    localDelete(index) {
        if (index < 0 || index >= this.data.length) {
            return null;
        }

        const charToDelete = this.data[index];
        this.lamportTime++;

        // Mark character as deleted in tombstones
        const idString = charToDelete.id.join(',');
        this.tombstones.set(idString, true);
        
        // Remove character from data array
        this.data.splice(index, 1);

        // Return operation for broadcasting to other clients
        return {
            type: 'delete',
            id: charToDelete.id,
            timestamp: this.lamportTime,
            siteId: this.siteId
        };
    }

    /**
     * Get the current text content as a string.
     */
    getText() {
        return this.data.map(char => char.value).join('');
    }

    /**
     * Apply a remote operation received from another client.
     * Updates Lamport clock and applies the operation to local state.
     */
    applyRemoteOperation(operation) {
        // Update Lamport clock for causality
        this.lamportTime = Math.max(this.lamportTime, operation.timestamp) + 1;

        if (operation.type === 'insert') {
            this.applyRemoteInsert(operation);
        } else if (operation.type === 'delete') {
            this.applyRemoteDelete(operation);
        }
    }

    /**
     * Apply a remote insert operation.
     */
    applyRemoteInsert(operation) {
        const idString = operation.id.join(',');

        // Don't insert if character was already deleted
        if (!this.tombstones.has(idString)) {
            const existingIndex = this.data.findIndex(char =>
                char.id.join(',') === idString
            );

            // Only insert if we don't already have this character
            if (existingIndex === -1) {
                const newChar = {
                    id: operation.id,
                    value: operation.value,
                    timestamp: operation.timestamp,
                    siteId: operation.siteId,
                    position: operation.position || 0
                };

                // Insert at the intended position (simplified positioning)
                const insertPos = Math.min(operation.position || 0, this.data.length);
                this.data.splice(insertPos, 0, newChar);
            }
        }
    }

    /**
     * Apply a remote delete operation.
     */
    applyRemoteDelete(operation) {
        const idString = operation.id.join(',');
        
        // Mark character as deleted
        this.tombstones.set(idString, true);

        // Find and remove the character if it exists
        const indexToDelete = this.data.findIndex(char =>
            char.id.join(',') === idString
        );

        if (indexToDelete !== -1) {
            this.data.splice(indexToDelete, 1);
        }
    }

    /**
     * Get the current state for serialization or debugging.
     */
    getState() {
        return {
            data: this.data,
            tombstones: Array.from(this.tombstones.entries()),
            lamportTime: this.lamportTime
        };
    }

    /**
     * Apply a complete state (used for synchronization).
     */
    applyState(state) {
        this.data = state.data;
        this.tombstones = new Map(state.tombstones);
        this.lamportTime = Math.max(this.lamportTime, state.lamportTime);
    }
}