export function safeAuthReturnPath(value: string | null) {
  if (!value || value.startsWith('//')) return '/app';
  const applicationPath =
    value === '/app' || value.startsWith('/app/') || value.startsWith('/app?');
  return value === '/invite/accept' || applicationPath ? value : '/app';
}
