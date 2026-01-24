declare module '@tremor/react' {
  import { ComponentType, ReactNode } from 'react';
  
  // Chart components
  export const AreaChart: ComponentType<{
    data: any[];
    index: string;
    categories: string[];
    colors?: string[];
    className?: string;
    [key: string]: any;
  }>;
  
  export const BarChart: ComponentType<{
    data: any[];
    index: string;
    categories: string[];
    colors?: string[];
    className?: string;
    [key: string]: any;
  }>;
  
  // Card component
  export const Card: ComponentType<{
    children?: ReactNode;
    className?: string;
    [key: string]: any;
  }>;
  
  // Add other exports as needed
  export * from '@tremor/react/dist/index';
}