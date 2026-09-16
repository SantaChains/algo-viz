import { Suspense, lazy, useEffect, useState } from 'react';
import { Center, Loader, MantineProvider } from '@mantine/core';
import { theme } from './theme';
import { Home } from './components/Home';
import { ErrorBoundary } from './components/ErrorBoundary';
import { parseHash, navigateHome, navigateLab, type View } from './router';

// 实验室按需加载：着陆页不打包 AppShell/播放器/渲染器等重依赖
const Shell = lazy(() => import('./components/Shell').then((m) => ({ default: m.Shell })));

// 首次进入实验室拉 chunk 时的轻量占位，避免 fallback={null} 的一瞬白屏
function ShellFallback() {
  return (
    <Center mih="100vh">
      <Loader color="violet" size="sm" />
    </Center>
  );
}

export default function App() {
  const [view, setView] = useState<View>(parseHash);

  // hash 是路由唯一事实源：点击导航与浏览器前进/后退统一走 hashchange
  useEffect(() => {
    const onHash = () => setView(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <ErrorBoundary resetKey={view}>
        {view.page === 'home' ? (
          <Home onEnter={navigateLab} />
        ) : (
          <Suspense fallback={<ShellFallback />}>
            <Shell route={view.route} onHome={navigateHome} />
          </Suspense>
        )}
      </ErrorBoundary>
    </MantineProvider>
  );
}
