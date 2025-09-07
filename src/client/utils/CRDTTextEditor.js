export class CRDTTextEditor {
    constructor(siteId) {
        this.siteId = siteId;
        this.lamportTime = 0;
        this.data = [];
        this.tombstones = new Map();
    }

    generateIdBetween(prevId, nextId, depth = 0) {
        const prevPos = prevId ? prevId[depth] || 0 : 0;
        const nextPos = nextId ? nextId[depth] || 0 : 0;

        if (prevPos < nextPos - 1) {
            const newPos = Math.floor((prevPos + nextPos) / 2);
            return [(prevId || []).slice(0, depth), newPos].flat();
        } else if (prevPos === undefined && nextPos) {
            return [nextPos - 1];
        } else if (prevPos && nextPos === undefined) {
            return [prevPos + 1];
        } else if (prevPos === nextPos - 1) {
            return this.generateIdBetween(prevId, nextId, depth + 1);
        } else {
            return [1];
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

    localInsert(index, char) {
        this.lamportTime++;

        let prevId = null;
        let nextId = null;

        if (index > 0) prevId = this.data[index - 1]?.id;
        if (index < this.data.length) nextId = this.data[index]?.id;

        const newId = this.generateIdBetween(prevId, nextId);
        const newChar = {
            id: newId,
            value: char,
            timestamp: this.lamportTime,
            siteId: this.siteId
        };

        const insertIndex = this.findIndexForId(newId);
        this.data.splice(insertIndex, 0, newChar);

        return {
            type: 'insert',
            id: newId,
            value: char,
            timestamp: this.lamportTime,
            siteId: this.siteId
        };
    }

    localDelete(index) {
        if (index < 0 || index >= this.data.length) return null;

        const charToDelete = this.data[index];
        this.lamportTime++;

        const idString = charToDelete.id.join(',');
        this.tombstones.set(idString, true);
        this.data.splice(index, 1);

        return {
            type: 'delete',
            id: charToDelete.id,
            timestamp: this.lamportTime,
            siteId: this.siteId
        };
    }

    getText() {
        return this.data.map(char => char.value).join('');
    }

    applyRemoteOperation(operation) {
        this.lamportTime = Math.max(this.lamportTime, operation.timestamp) + 1;

        if (operation.type === 'insert') {
            const idString = operation.id.join(',');

            if (!this.tombstones.has(idString)) {
                const existingIndex = this.data.findIndex(char =>
                    char.id.join(',') === idString
                );

                if (existingIndex === -1) {
                    const newChar = {
                        id: operation.id,
                        value: operation.value,
                        timestamp: operation.timestamp,
                        siteId: operation.siteId
                    };

                    const insertIndex = this.findIndexForId(operation.id);
                    this.data.splice(insertIndex, 0, newChar);
                }
            }
        } else if (operation.type === 'delete') {
            const idString = operation.id.join(',');
            this.tombstones.set(idString, true);

            const indexToDelete = this.data.findIndex(char =>
                char.id.join(',') === idString
            );

            if (indexToDelete !== -1) {
                this.data.splice(indexToDelete, 1);
            }
        }
    }

    getState() {
        return {
            data: this.data,
            tombstones: Array.from(this.tombstones.entries()),
            lamportTime: this.lamportTime
        };
    }

    applyState(state) {
        this.data = state.data;
        this.tombstones = new Map(state.tombstones);
        this.lamportTime = Math.max(this.lamportTime, state.lamportTime);
    }
}