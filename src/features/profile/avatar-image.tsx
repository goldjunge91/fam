import { useQuery } from '@tanstack/react-query';
import { Image, type ImageProps } from 'expo-image';
import { useEffect, useState } from 'react';
import { useSession } from '@/features/auth/session-provider';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { env } from '@/lib/config/env';
import { debugError, debugLogEvent } from '@/lib/observability/debug-log';

const TTL_SECONDS = 300;

/** Existing public URLs are locators only, never an unauthenticated fallback. */
export function avatarStoragePath(reference: string, baseUrl: string): string | null {
  try {
    const url = new URL(reference);
    if (url.origin !== new URL(baseUrl).origin) return null;
    const match =
      /^\/storage\/v1\/object\/(?:public|authenticated)\/avatars\/([^/]+\/avatar\.jpg)$/u.exec(
        url.pathname,
      );
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Native integration boundary shared by every avatar surface. */
export function AvatarImage({
  reference,
  ...props
}: Omit<ImageProps, 'source' | 'cachePolicy'> & { reference: string }) {
  const { session } = useSession();
  const userId = session?.user.id;
  const path = avatarStoragePath(reference, env.supabaseUrl);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    debugLogEvent('profile.avatar-image.resolve', {
      hasSession: Boolean(userId),
      acceptedReference: Boolean(path),
    });
  }, [path, userId]);
  const query = useQuery({
    queryKey: ['avatar-image', userId, reference],
    enabled: !!userId && !!path,
    queryFn: async () => {
      if (!path) return null;
      debugLogEvent('profile.avatar-image.sign-start');
      try {
        const issuedAt = Date.now();
        const { data, error } = await getSupabase()
          .storage.from('avatars')
          .createSignedUrl(path, TTL_SECONDS);
        if (error) throw error;
        debugLogEvent('profile.avatar-image.sign-complete', {
          hasSignedUrl: Boolean(data.signedUrl),
        });
        return { url: data.signedUrl, expiresAt: issuedAt + TTL_SECONDS * 1000 };
      } catch (error: unknown) {
        debugError('[AvatarImage] Signierte URL konnte nicht erstellt werden', error);
        throw error;
      }
    },
    staleTime: 240_000,
    gcTime: 0,
    refetchInterval: 240_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  useEffect(() => {
    if (!query.data) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, query.data.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [query.data]);
  const uri =
    userId &&
    path &&
    !query.isError &&
    query.data &&
    query.data.expiresAt > Math.max(now, Date.now())
      ? query.data.url
      : undefined;
  return (
    <Image
      {...props}
      source={uri ? { uri } : null}
      cachePolicy="none"
      recyclingKey={`${userId}:${reference}`}
    />
  );
}
