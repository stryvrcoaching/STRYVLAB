type RestEndingSoonNotification = {
  title: string
  body: string
  url?: string
}

export async function showRestEndingSoonNotification(
  _notification: RestEndingSoonNotification,
): Promise<void> {
  // Rest ending soon notifications disabled per user setting
  return Promise.resolve()
}
