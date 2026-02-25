"use client";

import React, { Component, type ReactNode } from "react";
import { Card, Text } from "@tremor/react";
import { AlertTriangle, RefreshCw, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class PreviewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[PreviewErrorBoundary]", error, info.componentStack);
  }

  handleCopy = async () => {
    const msg = this.state.error?.message || "Unknown error";
    const stack = this.state.error?.stack || "";
    await navigator.clipboard.writeText(`${msg}\n\n${stack}`);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] }}
          className="flex items-center justify-center h-64 p-6"
        >
          <Card className="max-w-md w-full border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20">
            <div className="flex flex-col items-center text-center space-y-4 p-6">
              {/* Icon with subtle pulse */}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <AlertTriangle className="h-10 w-10 text-red-500 dark:text-red-400" />
              </motion.div>

              {/* Title */}
              <div>
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-200">
                  Preview rendering error
                </h3>
                <Text className="text-sm text-red-700/70 dark:text-red-300/70 mt-1 max-w-sm">
                  {this.state.error?.message || "An unexpected error occurred while rendering the dashboard."}
                </Text>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => this.setState({ hasError: false, error: null })}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={this.handleCopy}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  {this.state.copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Error
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </Card>
        </motion.div>
      );
    }

    return this.props.children;
  }
}
