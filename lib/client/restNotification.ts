type RestEndingSoonNotification = {
  title: string
  body: string
  url?: string
}

export async function showRestEndingSoonNotification({
  title,
  body,
  url = '/client',
}: RestEndingSoonNotification): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return

  const options: NotificationOptions = {
    body,
    tag: 'stryvr-rest-ending-soon',
    renotify: true,
    icon: '/images/logo-stryvr-silver.png',
    badge: '/images/logo-stryvr-silver.png',
    data: { url },
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      const registration = registrations.find((candidate) => candidate.scope.includes('/client')) ?? registrations[0]
      if (registration) {
        await registration.showNotification(title, options)
        return
      }
    }

    new Notification(title, options)
  } catch {
  }
}
