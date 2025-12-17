import { BrainCog } from "lucide-react";
import Image from "next/image";

interface ModelConfigurationProps {
  provider: string;
  setProvider: (provider: string) => void;
  model: string;
  setModel: (model: string) => void;
  approveAllTools?: boolean;
  setApproveAllTools?: (approveAllTools: boolean) => void;
}

export const ModelConfiguration = ({
  provider,
  setProvider,
  model,
  setModel,
}: ModelConfigurationProps) => {
  return (
    <div className="space-y-4">
      {/* Provider Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
          Provider
        </label>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
            <Image
              src={`/${provider.toLowerCase()}.svg`}
              alt={provider}
              width={24}
              height={24}
              className="object-contain p-0.5"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <BrainCog className="h-4 w-4" />
          </span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="flex-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="google">Google</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Model</label>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Enter model name"
          className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        />
      </div>
    </div>
  );
};
