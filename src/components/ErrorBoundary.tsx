import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Center, Code, Group, Stack, Text, Title } from "@mantine/core";
import { navigateHome } from "../router";

interface Props {
  children: ReactNode;
  /** 变化时清除错误态（如路由切换），让用户无需刷新即可重试 */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
  /** 上次渲染时的 resetKey，用于在渲染期比较、无需 componentDidUpdate 即可复位 */
  prevResetKey: unknown;
}

/**
 * 全局错误边界：捕获子树渲染期异常与 lazy chunk 加载失败，避免静态托管下整页白屏。
 * React 19 仍无 hook 版错误边界，只能用类组件（getDerivedStateFromError / componentDidCatch）。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, prevResetKey: undefined };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  // 渲染期比较 resetKey：路由/视图变化即清除错误态，深链跳转无需手动刷新。
  // 走 getDerivedStateFromProps 而非 componentDidUpdate + setState，避免二次渲染告警
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.prevResetKey) {
      return { error: null, prevResetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 静态托管无上报后端，仅打印供开发排查
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // 部署后旧 chunk 失效是静态托管最常见的可恢复错误，单独给文案
    const isChunkFail = /chunk|import|dynamically|Failed to fetch/i.test(error.message);
    return (
      <Center mih="100vh" p="md">
        <Stack gap="md" maw={520}>
          <Title order={3}>{isChunkFail ? "资源加载失败" : "页面渲染出错"}</Title>
          <Text size="sm" c="dimmed">
            {isChunkFail
              ? "站点可能刚更新，旧资源已失效。重新加载即可获取最新版本。"
              : "可视化渲染时发生异常。可尝试重新加载，或返回首页选择其他算法。"}
          </Text>
          <Code block>{error.message}</Code>
          <Group>
            <Button variant="filled" color="violet" onClick={() => window.location.reload()}>
              重新加载
            </Button>
            <Button
              variant="default"
              onClick={() => {
                navigateHome();
                this.setState({ error: null });
              }}
            >
              返回首页
            </Button>
          </Group>
        </Stack>
      </Center>
    );
  }
}
