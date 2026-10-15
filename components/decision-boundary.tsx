"use client";
import { Component, type ReactNode } from "react";
import { useLocale } from "./locale-provider";

class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function DecisionBoundary({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  return (
    <Boundary
      fallback={
        <div className="decision-boundary" role="alert">
          {locale === "ja"
            ? "高度な分析を表示できませんでした。基本シミュレーターは引き続き使用できます。ページを再読み込みして再度お試しください。"
            : "Advanced analysis could not be displayed. The core simulator remains available. Reload the page to try again."}
        </div>
      }
    >
      {children}
    </Boundary>
  );
}
