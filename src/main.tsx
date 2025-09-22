import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./assets/shimmer.css";
import "./styles.css";
import "./i18n"; // Initialize i18n
import { getCurrentWindow } from '@tauri-apps/api/window';

// 防止窗口闪烁的React包装组件
const AppWrapper: React.FC = () => {
  React.useEffect(() => {
    // 在React应用完全挂载后显示窗口
    const showWindow = async () => {
      try {
        const window = getCurrentWindow();
        await window.show();
        await window.setFocus();
      } catch (error) {
        console.error('Failed to show window:', error);
      }
    };
    
    // 短暂延迟确保所有组件都已渲染
    const timer = setTimeout(showWindow, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
);
