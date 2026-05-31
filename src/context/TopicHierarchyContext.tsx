import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { TopicHierarchyMap } from '../types';
import { loadAllTopicHierarchies } from '../data/topicDbLoader';

interface TopicHierarchyContextValue {
  hierarchies: TopicHierarchyMap | null;
  loading: boolean;
}

const TopicHierarchyContext = createContext<TopicHierarchyContextValue>({
  hierarchies: null,
  loading: true,
});

export function TopicHierarchyProvider({ children }: { children: ReactNode }) {
  const [hierarchies, setHierarchies] = useState<TopicHierarchyMap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadAllTopicHierarchies()
      .then((map) => {
        if (!cancelled) {
          setHierarchies(map);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TopicHierarchyContext.Provider value={{ hierarchies, loading }}>
      {children}
    </TopicHierarchyContext.Provider>
  );
}

export function useTopicHierarchies(): TopicHierarchyContextValue {
  return useContext(TopicHierarchyContext);
}
