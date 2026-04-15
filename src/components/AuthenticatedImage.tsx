import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import type { StyleProp, ImageStyle } from 'react-native';
import { TokenStore } from '@/auth/tokenStore';

interface Props {
  uri: string;
  style?: StyleProp<ImageStyle>;
}

/**
 * Renders a remote image that requires Bearer auth.
 * Reads the current access token from TokenStore and injects it as a
 * request header — React Native's Image component supports this natively.
 */
export default function AuthenticatedImage({ uri, style }: Props) {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    TokenStore.instance
      .getTokens()
      .then((tokens) => {
        if (tokens?.accessToken) {
          setAccessToken(tokens.accessToken);
        }
      })
      .catch(() => {});
  }, []);

  if (!accessToken) {
    return null;
  }

  return (
    <Image source={{ uri, headers: { Authorization: `Bearer ${accessToken}` } }} style={style} />
  );
}
