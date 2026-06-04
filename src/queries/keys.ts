export const profileKeys = {
  all: ['profile'] as const,
  byUser: (userId: string) => [...profileKeys.all, userId] as const,
};

export const statsKeys = {
  all: ['stats'] as const,
  byUser: (userId: string) => [...statsKeys.all, userId] as const,
};
