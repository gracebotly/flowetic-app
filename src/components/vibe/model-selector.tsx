
"use client";

import { useState } from "react";
import { Paperclip, Plus, X } from "lucide-react";

export type ModelId = "glm-4.7" | "gemini-3-pro-preview" | "claude-sonnet-4-5" | "gpt-5.2";

interface ModelOption {
  id: ModelId;
  name: string;
}

const MODELS: ModelOption[] = [
  { id: "glm-4.7", name: "GLM 4.7" },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro" },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
  { id: "gpt-5.2", name: "GPT 5.2" },
];

interface ModelSelectorProps {
  selectedModel: ModelId;
  onModelSelect: (modelId: ModelId) => void;
  onFileUpload: () => void;
}

export function ModelSelector({ selectedModel, onModelSelect, onFileUpload }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleModelClick = (modelId: ModelId) => {
    onModelSelect(modelId);
    setIsOpen(false);
  };

  const handleFileClick = () => {
    onFileUpload();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Plus Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Add files or select model"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
            {/* Add Files Option */}
            <button
              type="button"
              onClick={handleFileClick}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Paperclip className="h-4 w-4" />
              Add files
            </button>

            {/* Divider */}
            <div className="my-2 border-t border-gray-200" />

            {/* Model Options */}
            {MODELS.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => handleModelClick(model.id)}
                className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                  selectedModel === model.id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedModel === model.id
                      ? "border-blue-600"
                      : "border-gray-300"
                  }`}
                >
                  {selectedModel === model.id && (
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                </div>
                {model.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
