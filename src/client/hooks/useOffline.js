import { useState, useEffect } from 'react';

/**
 * Custom hook for detecting browser online/offline state.
 * Combines navigator.onLine with online/offline events for accurate detection.
 */
export const useOffline = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Mark that we were offline and are now back online
            if (!navigator.onLine || wasOffline) {
                setWasOffline(false);
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
            setWasOffline(true);
        };

        // Add event listeners
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Also check for visibility change (user might have switched tabs/apps)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Re-check online status when tab becomes visible
                setIsOnline(navigator.onLine);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [wasOffline]);

    return {
        isOnline,
        isOffline: !isOnline,
        wasOffline, // Useful for triggering sync when coming back online
    };
};
