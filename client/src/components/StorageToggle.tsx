import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Database, HardDrive } from "lucide-react";
import { useStorageContext } from "@/providers/StorageProvider";

export function StorageToggle() {
  const { isLocalMode, toggleMode } = useStorageContext();

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4" />
        <span className="text-sm">Database</span>
      </div>
      
      <Switch
        checked={isLocalMode}
        onCheckedChange={toggleMode}
        className="data-[state=checked]:bg-green-600"
      />
      
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4" />
        <span className="text-sm">Local Storage</span>
      </div>
      
      <Badge variant={isLocalMode ? "default" : "secondary"}>
        {isLocalMode ? "Offline Mode" : "Online Mode"}
      </Badge>
    </div>
  );
}