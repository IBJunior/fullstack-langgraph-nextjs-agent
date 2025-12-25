import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { ArrowUp, Loader2, Eye, EyeOff, Paperclip, X } from "lucide-react";
import { MessageOptions, FileAttachment } from "@/types/message";
import { SettingsPanel } from "./SettingsPanel";
import { useUISettings } from "@/contexts/UISettingsContext";
import { MAX_ATTACHMENTS } from "@/lib/storage/validation";

interface MessageInputProps {
  onSendMessage: (message: string, opts?: MessageOptions) => Promise<void>;
  isLoading?: boolean;
  maxLength?: number;
}

export const MessageInput = ({
  onSendMessage,
  isLoading = false,
  maxLength = 2000,
}: MessageInputProps) => {
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [provider, setProvider] = useState<string>("google");
  const [model, setModel] = useState<string>("gemini-3-flash-preview");
  const [approveAllTools, setApproveAllTools] = useState<boolean>(false);
  const [settingsExpanded, setSettingsExpanded] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // UI settings for toggling tool messages
  const { hideToolMessages, toggleToolMessages } = useUISettings();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
  }, [message]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    if (remainingSlots <= 0) {
      alert(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);

    try {
      const selectedFiles = Array.from(files).slice(0, remainingSlots);
      if (selectedFiles.length < files.length) {
        alert(
          `Only the first ${remainingSlots} file(s) were selected (max ${MAX_ATTACHMENTS} attachments).`,
        );
      }

      const uploadPromises = selectedFiles.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/agent/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        const data = await response.json();
        return {
          url: data.url,
          key: data.key,
          name: data.name,
          type: data.type,
          size: data.size,
        } as FileAttachment;
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      setAttachments((prev) => [...prev, ...uploadedFiles]);
    } catch (error) {
      console.error("File upload error:", error);
      alert(error instanceof Error ? error.message : "Failed to upload files");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeAttachment = (key: string) => {
    setAttachments((prev) => prev.filter((att) => att.key !== key));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && attachments.length === 0) || isLoading) return;

    await onSendMessage(message, {
      model,
      tools: [],
      approveAllTools: approveAllTools,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    setMessage("");
    setAttachments([]);
  };
  // Calculate remaining characters
  const remainingChars = maxLength - message.length;
  const isNearLimit = remainingChars < maxLength * 0.1; // Less than 10% remaining
  return (
    <form onSubmit={handleSubmit} className="relative">
      <div
        className={`relative mx-auto flex max-w-[80%] flex-col rounded-lg border transition-all duration-200 ${
          isFocused ? "border-blue-500 shadow-sm" : "border-gray-200"
        }`}
      >
        {/* Settings Panel */}
        <SettingsPanel
          isExpanded={settingsExpanded}
          onToggle={() => setSettingsExpanded(!settingsExpanded)}
          provider={provider}
          setProvider={setProvider}
          model={model}
          setModel={setModel}
        />

        {/* Input Section */}
        <div className="px-4 pt-4 pb-2">
          {/* File Attachments Display */}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.key}
                  className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1.5 text-sm dark:bg-gray-800"
                >
                  <span className="max-w-[200px] truncate">{attachment.name}</span>
                  <span className="text-xs text-gray-500">
                    ({attachment.size < 1024 ? "<1KB" : `${(attachment.size / 1024).toFixed(0)}KB`})
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.key)}
                    className="ml-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            value={message}
            ref={textareaRef}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={"Type your message..."}
            className="max-h-[200px] min-h-[60px] w-full flex-1 resize-none overflow-auto pr-12 focus:outline-none"
            rows={1}
            aria-label="Message input"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,application/pdf,text/markdown,text/plain,.md,.markdown,.txt"
            onChange={handleFileSelect}
            className="hidden"
            aria-label="File upload"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Character counter */}
              <div className={`text-xs ${isNearLimit ? "text-amber-500" : "text-gray-400"}`}>
                {remainingChars}/{maxLength}
              </div>

              {/* Auto-approve tools setting - always visible */}
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={approveAllTools}
                  onChange={(e) => setApproveAllTools(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-600 dark:text-gray-300">Auto-approve tools</span>
              </label>

              {/* Tool messages toggle */}
              <button
                type="button"
                onClick={toggleToolMessages}
                className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label={hideToolMessages ? "Show tool messages" : "Hide tool messages"}
              >
                {hideToolMessages ? (
                  <EyeOff className="h-3.5 w-3.5 text-gray-500" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-gray-500" />
                )}
                <span className="text-gray-600 dark:text-gray-300">
                  {hideToolMessages ? "Show tools" : "Hide tools"}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* File upload button */}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploading || attachments.length >= MAX_ATTACHMENTS}
                className="h-8 w-8 rounded-full p-0"
                aria-label="Attach file"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={(!message.trim() && attachments.length === 0) || isLoading}
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full p-0 ${
                  (message.trim() || attachments.length > 0) && !isLoading
                    ? "bg-primary hover:bg-primary/90 text-white"
                    : ""
                }`}
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
