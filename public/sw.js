self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icon-192x192.png',
            vibrate: [200, 100, 200, 100, 200, 100, 200],
            tag: 'vibration-sample',
            requireInteraction: true,
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '1'
            }
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    console.log('[Service Worker] Notification click Received.');
    event.notification.close();
    event.waitUntil(
        clients.openWindow('https://oref.org.il') // or open the app window
    );
});
