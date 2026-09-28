import { FileText, Folder, Image as ImageIcon, Video, type LucideIcon } from "lucide-react";
import type { ApprovalType } from "@/lib/queue";

/** Icon, tile colours and label per content type, matching the reference. */
export const TYPE_STYLE: Record<ApprovalType, { Icon: LucideIcon; tile: string; label: string }> = {
  folder: { Icon: Folder, tile: "bg-amber-100 text-amber-500", label: "Folder" },
  video: { Icon: Video, tile: "bg-rose-100 text-rose-500", label: "Video" },
  pdf: { Icon: FileText, tile: "bg-blue-100 text-blue-600", label: "Pdf" },
  image: { Icon: ImageIcon, tile: "bg-emerald-100 text-emerald-600", label: "Image" },
};

/** "My Site Patrol › My Site Patrol Card" -> ["My Site Patrol", "My Site Patrol Card"] */
export function folderParts(folderPath: string): string[] {
  return folderPath.split("›").map((p) => p.trim()).filter(Boolean);
}
