"use client";
import React from "react";
import type { RendererProps } from "../componentRegistry";
import { DataTableRenderer } from "./DataTable";

export default function CRUDTableRenderer(props: RendererProps) {
  return <DataTableRenderer {...props} component={{ ...props.component, props: { ...props.component.props, showActions: true } }} />;
}
