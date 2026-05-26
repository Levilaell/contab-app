import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || 'Contabilliza';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{brandName}</h1>
          <p className="text-sm text-muted-foreground">
            Entre pra acessar o painel
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
