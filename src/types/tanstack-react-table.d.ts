
declare module '@tanstack/react-table' {
  import { ReactNode } from 'react';
  
  export interface ColumnDef<TData, TValue = unknown> {
    accessorKey?: string;
    header?: string | ((props: any) => ReactNode);
    cell?: (props: any) => ReactNode;
    [key: string]: any;
  }
  
  export interface TableOptions<TData> {
    data: TData[];
    columns: ColumnDef<TData, any>[];
    getCoreRowModel?: () => any;
    [key: string]: any;
  }
  
  export function useReactTable<TData>(options: TableOptions<TData>): any;
  export function getCoreRowModel<TData>(): any;
  export function flexRender(component: any, props: any): ReactNode;
  
  // Re-export everything else
  export * from '@tanstack/table-core';
}
