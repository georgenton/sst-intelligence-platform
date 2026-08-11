'use client';

import { ApiClientError } from '@sst/api-client';
import { Button, Card } from '@sst/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from './auth-provider';

type Fields = { email: string; password: string; displayName: string };

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>();
  const isRegister = mode === 'register';

  const submit = handleSubmit(async (fields) => {
    setServerError('');
    try {
      if (isRegister) await auth.register(fields);
      else await auth.login(fields);
      const sessionId = search.get('sessionId');
      router.push(sessionId ? `/app/organizations?sessionId=${sessionId}` : '/app');
    } catch (error) {
      setServerError(
        error instanceof ApiClientError ? error.message : 'No pudimos completar la solicitud.',
      );
    }
  });

  return (
    <Card className="auth-card stack">
      <div>
        <p className="eyebrow">{isRegister ? 'Nueva cuenta' : 'Bienvenido de nuevo'}</p>
        <h2>{isRegister ? 'Crea tu acceso' : 'Inicia sesión'}</h2>
        <p className="muted">Tus organizaciones y roles se validan de forma independiente.</p>
      </div>
      <form className="stack" onSubmit={submit} noValidate>
        {isRegister && (
          <div className="field">
            <label htmlFor="displayName">Nombre</label>
            <input
              id="displayName"
              autoComplete="name"
              {...register('displayName', { required: 'Ingresa tu nombre.', minLength: 2 })}
            />
            {errors.displayName && (
              <span className="field-error">{errors.displayName.message}</span>
            )}
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email', { required: 'Ingresa tu correo.' })}
          />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            {...register('password', {
              required: 'Ingresa tu contraseña.',
              minLength: isRegister
                ? { value: 12, message: 'Usa al menos 12 caracteres.' }
                : undefined,
            })}
          />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </div>
        {serverError && (
          <p className="field-error" role="alert">
            {serverError}
          </p>
        )}
        <Button disabled={isSubmitting}>
          {isSubmitting ? 'Procesando…' : isRegister ? 'Crear cuenta' : 'Entrar'}
        </Button>
      </form>
      <p className="muted">
        {isRegister ? '¿Ya tienes cuenta? ' : '¿Primera vez? '}
        <Link href={isRegister ? '/auth/login' : '/auth/register'}>
          {isRegister ? 'Inicia sesión' : 'Regístrate'}
        </Link>
      </p>
    </Card>
  );
}
