import Image from "next/image";
import { Heartbeat } from "@/components/Heartbeat";

export function BrandHeader() {
  return (
    <header data-brand-header className="flex flex-col items-center gap-4 pt-8 pb-6">
      <Image
        src="/brand/docipl-logo.webp"
        alt="Doc IPL – Doctors Indian Pickleball League"
        width={512}
        height={512}
        sizes="128px"
        priority
        className="size-32 rounded-3xl object-cover ring-1 ring-white/15"
      />
      <Heartbeat className="text-white" />
    </header>
  );
}
