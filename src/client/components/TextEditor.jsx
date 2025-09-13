import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { CRDTTextEditor } from '../utils/CRDTTextEditor';
import { OfflineQueue } from '../utils/OfflineQueue';

export const TextEditor = forwardRef(({ onOperation, initialContent = '', offlineQueue = null }, ref) => {
    const [content, setContent] = useState(initialContent);
    const editorRef = useRef(null);
    const crdtRef = useRef(null);
    const isApplyingRemote = useRef(false);
    const offlineQueueRef = useRef(offlineQueue);

    useEffect(() => {
        // Initialize or get offline queue
        if (!offlineQueueRef.current) {
            offlineQueueRef.current = new OfflineQueue('document-1');
        }

        // Initialize CRDT with unique site ID and offline queue
        const siteId = Math.random().toString(36).substr(2, 9);
        crdtRef.current = new CRDTTextEditor(siteId, offlineQueueRef.current);

        // Load existing content from persisted state first
        const persistedContent = crdtRef.current.getText();
        if (persistedContent) {
            setContent(persistedContent);
        } else if (initialContent) {
            // Only load initial content if no persisted content exists
            for (let i = 0; i < initialContent.length; i++) {
                const operation = crdtRef.current.localInsert(i, initialContent[i]);
                if (operation && onOperation) {
                    onOperation(operation);
                }
            }
            setContent(crdtRef.current.getText());
        }

        // Clean up old operations on mount
        offlineQueueRef.current.cleanupStale();
    }, [initialContent, onOperation]);

    const updateContentAndCursor = (newCursorPos) => {
        const newContent = crdtRef.current.getText();
        setContent(newContent);
        
        // Restore cursor position after state update
        setTimeout(() => {
            const textarea = editorRef.current;
            if (textarea) {
                textarea.selectionStart = newCursorPos;
                textarea.selectionEnd = newCursorPos;
            }
        }, 0);
    };

    const handleKeyDown = (e) => {
        if (isApplyingRemote.current) return;

        const textarea = editorRef.current;
        const cursorPos = textarea.selectionStart;
        
        if (e.key === 'Backspace') {
            e.preventDefault();
            if (cursorPos > 0) {
                const operation = crdtRef.current.localDelete(cursorPos - 1);
                if (operation && onOperation) {
                    onOperation(operation);
                }
                updateContentAndCursor(cursorPos - 1);
            }
        } else if (e.key === 'Delete') {
            e.preventDefault();
            if (cursorPos < content.length) {
                const operation = crdtRef.current.localDelete(cursorPos);
                if (operation && onOperation) {
                    onOperation(operation);
                }
                updateContentAndCursor(cursorPos);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const operation = crdtRef.current.localInsert(cursorPos, '\n');
            if (operation && onOperation) {
                onOperation(operation);
            }
            updateContentAndCursor(cursorPos + 1);
        } else if (e.key.length === 1) { // Regular character input
            e.preventDefault();
            const operation = crdtRef.current.localInsert(cursorPos, e.key);
            if (operation && onOperation) {
                onOperation(operation);
            }
            updateContentAndCursor(cursorPos + 1);
        }
    };

    const applyRemoteOperation = (operation) => {
        const textarea = editorRef.current;
        const cursorPos = textarea ? textarea.selectionStart : 0;
        
        // Prevent local key handling during remote operation application
        isApplyingRemote.current = true;
        
        // Apply the remote operation to CRDT and update content
        crdtRef.current.applyRemoteOperation(operation);
        const newContent = crdtRef.current.getText();
        setContent(newContent);
        
        // Preserve cursor position and re-enable local operations
        setTimeout(() => {
            if (textarea) {
                textarea.selectionStart = cursorPos;
                textarea.selectionEnd = cursorPos;
            }
            isApplyingRemote.current = false;
        }, 0);
    };

    // Expose methods for parent component
    useImperativeHandle(ref, () => ({
        applyRemoteOperation,
        getOfflineQueue: () => offlineQueueRef.current,
        getCRDT: () => crdtRef.current
    }));

    return (
        <div className="text-editor">
            <textarea
                ref={editorRef}
                value={content}
                onKeyDown={handleKeyDown}
                onChange={() => {}} // Controlled by onKeyDown
                placeholder="Start typing to collaborate..."
                style={{
                    width: '100%',
                    minHeight: '200px',
                    border: '1px solid #ccc',
                    padding: '10px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box'
                }}
            />
        </div>
    );
});
