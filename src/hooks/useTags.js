import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export const useTags = () => {
  const { data, ...rest } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      return await base44.entities.Tag.list();
    },
    staleTime: 5 * 60 * 1000,
  });

  const tagMap = useMemo(() => {
    if (!data) return {};
    return data.reduce((acc, tag) => {
      acc[tag.name.toLowerCase()] = tag;
      return acc;
    }, {});
  }, [data]);

  return { tags: data || [], tagMap, ...rest };
};