import Image from "next/image";
import { Heartbeat } from "@/components/Heartbeat";

export function BrandHeader() {
  return (
    <header data-brand-header className="flex flex-col items-center gap-4 pt-8 pb-6">
      <Image
        src="/brand/docipl-logo-placeholder.png"
        alt="Doc IPL – Doctors Indian Pickleball League"
        width={172}
        height={182}
        priority
        className="size-24 rounded-full object-cover"
      />
      <Heartbeat className="text-white" />
    </header>
  );
}
