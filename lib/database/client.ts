// Mock database client for Ralph Loop
export const database = {
  ralphStrategies: {
    findMany: async () => [
      { name: 'yield', belief_score: 0.8, enabled: true },
      { name: 'signal', belief_score: 0.6, enabled: true },
      { name: 'liquidity', belief_score: 0.4, enabled: true },
      { name: 'zk', belief_score: 0.7, enabled: true },
      { name: 'belief', belief_score: 1.0, enabled: true }
    ],
    findUnique: async ({ where }: any) => ({ name: where.name, enabled: true }),
    update: async ({ where, data }: any) => {
      console.log(`[DB MOCK] Updating strategy ${where.name} with data:`, data);
      return { name: where.name, ...data };
    }
  },
  ralphExecutions: {
    create: async ({ data }: any) => {
      console.log(`[DB MOCK] Creating execution log for ${data.strategy}`);
      return { id: Math.random().toString(36).substr(2, 9), ...data };
    }
  }
};
