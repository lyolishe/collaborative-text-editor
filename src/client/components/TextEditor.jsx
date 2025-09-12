import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { CRDTTextEditor } from '../utils/CRDTTextEditor';

export const TextEditor = forwardRef(({ onOperation, initialContent = '' }, ref) => {
    const [content, setContent] = useState(initialContent);
    const [cursorPosition, setCursorPosition] = useState(0);
    const editorRef = useRef(null);
    const crdtRef = useRef(null);

    useEffect(() => {
        // Инициализируем CRDT с уникальным ID
        const siteId = Math.random().toString(36).substr(2, 9);
        crdtRef.current = new CRDTTextEditor(siteId);

        // Загружаем начальный контент
        if (initialContent) {
            for (let i = 0; i < initialContent.length; i++) {
                const op = crdtRef.current.localInsert(i, initialContent[i]);
                if (op && onOperation) onOperation(op);
            }
            setContent(crdtRef.current.getText());
        }
    }, [initialContent, onOperation]);

    const handleInput = (e) => {
        const input = e.nativeEvent;

        if (input.data) {
            // Вставка символа
            const op = crdtRef.current.localInsert(cursorPosition, input.data);
            if (op && onOperation) onOperation(op);
        } else if (input.inputType === 'deleteContentBackward') {
            // Удаление символа
            if (cursorPosition > 0) {
                const op = crdtRef.current.localDelete(cursorPosition - 1);
                if (op && onOperation) onOperation(op);
            }
        }

        setContent(crdtRef.current.getText());
    };

    const handleSelectionChange = () => {
        if (editorRef.current) {
            // Note: selectionStart is not standard for contentEditable; this is a placeholder.
            setCursorPosition(editorRef.current.selectionStart || 0);
        }
    };

    const applyRemoteOperation = (operation) => {
        crdtRef.current.applyRemoteOperation(operation);
        setContent(crdtRef.current.getText());
    };

    // Экспортируем метод для внешнего использования
    useImperativeHandle(ref, () => ({
        applyRemoteOperation
    }));

    return (
        <div className="text-editor">
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onSelect={handleSelectionChange}
                dangerouslySetInnerHTML={{ __html: content }}
                style={{
                    minHeight: '100px',
                    border: '1px solid #ccc',
                    padding: '10px',
                    borderRadius: '4px',
                    whiteSpace: 'pre-wrap'
                }}
            />
        </div>
    );
});
