import { UserButton } from "@clerk/nextjs";
import InstrumentSidebar from "@/components/InstrumentSidebar";
import Stack from "@/components/Stack";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { StackProvider } from "@/contexts/StackContext";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <div className="flex h-16 items-center px-4 sm:px-6">
          <h1 className="text-xl font-bold">BeatsAI</h1>
          <div className="ml-auto flex items-center space-x-4">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>
      <StackProvider>
        <div className="flex flex-1">
          <InstrumentSidebar />
          <main className="flex-1 p-8 overflow-auto">
            <Stack />
          </main>
        </div>
      </StackProvider>
    </div>
  );
}
