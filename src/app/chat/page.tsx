import type { Metadata } from "next";
import { Chat } from "./chat";

export const metadata: Metadata = {
  title: "HR Chat | The Garden",
  description: "Ask the HR assistant about Garden policies.",
};

export default function ChatPage() {
  return (
    <main>
      <h1>HR Chat</h1>
      <p>
        Questions about pay, time off, safety, remote work, or hiring? Ask away. It&apos;s an AI
        assistant, so for anything official, talk to a human.
      </p>
      <Chat />
    </main>
  );
}
