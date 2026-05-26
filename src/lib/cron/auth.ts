export function checkCronAuth(request: Request): boolean {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // dev: permite sem auth
    return process.env.NODE_ENV !== 'production';
  }
  return auth === `Bearer ${secret}`;
}
