import { defineConfig, loadEnv } from 'vite';

const DEFAULT_LLM_PROXY_ORIGIN = 'http://127.0.0.1:8787';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredUrl = env.VITE_LLM_PROXY_URL?.trim();

  let target = DEFAULT_LLM_PROXY_ORIGIN;
  if (configuredUrl) {
    try {
      const parsed = new URL(configuredUrl);
      target = `${parsed.protocol}//${parsed.host}`;
    } catch {
      target = DEFAULT_LLM_PROXY_ORIGIN;
    }
  }

  const agentTarget = env.VITE_AGENT_SERVER_URL?.trim() || 'http://127.0.0.1:8788';

  return {
    server: {
      proxy: {
        '/api/llm': {
          target,
          changeOrigin: true,
        },
        '/api/agents': {
          target: agentTarget,
          changeOrigin: true,
          // Faction agents think; don't let the proxy cut them off
          timeout: 120000,
          proxyTimeout: 120000,
        },
        '/api/gm': {
          target: agentTarget,
          changeOrigin: true,
          // GM calls have a 20s server-side timeout; give the proxy a margin
          timeout: 25000,
          proxyTimeout: 25000,
        },
      },
    },
  };
});
