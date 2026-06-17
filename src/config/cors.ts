export const getAllowedOrigins = (raw: string | undefined): string[] => {
  const origins = raw?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [];
  return origins.length === 0 ? ['*'] : origins;
};

export const resolveCorsOrigin = (
  requestOrigin: string | undefined,
  allowedOrigins: string[]
): string => {
  if (allowedOrigins.includes('*')) {
    return '*';
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  if (!requestOrigin) {
    return allowedOrigins[0];
  }

  return 'null';
};
