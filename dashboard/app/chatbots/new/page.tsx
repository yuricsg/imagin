"use client";

import { useRouter } from "next/navigation";
import { ChatbotForm } from "@/app/_components/chatbot-form";
import { useChatbotActions } from "@/app/_components/use-chatbot-actions";

export default function NewChatbotPage() {
  const router = useRouter();
  const { create } = useChatbotActions();

  return (
    <ChatbotForm
      onClose={() => router.push("/")}
      onCreate={(input) => {
        const bot = create(input);
        return bot;
      }}
    />
  );
}
