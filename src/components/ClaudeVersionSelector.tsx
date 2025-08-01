import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api, type ClaudeInstallation } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CheckCircle, Package, HardDrive, Settings } from "lucide-react";

interface ClaudeVersionSelectorProps {
  /**
   * Currently selected installation path
   */
  selectedPath?: string | null;
  /**
   * Callback when an installation is selected
   */
  onSelect: (installation: ClaudeInstallation) => void;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Whether to show the save button
   */
  showSaveButton?: boolean;
  /**
   * Callback when save is clicked
   */
  onSave?: () => void;
  /**
   * Whether save is in progress
   */
  isSaving?: boolean;
}

/**
 * ClaudeVersionSelector component for selecting Claude Code installations
 * Supports bundled sidecar, system installations, and user preferences
 * 
 * @example
 * <ClaudeVersionSelector
 *   selectedPath={currentPath}
 *   onSelect={(installation) => setSelectedInstallation(installation)}
 * />
 */
export const ClaudeVersionSelector: React.FC<ClaudeVersionSelectorProps> = ({
  selectedPath,
  onSelect,
  className,
  showSaveButton = false,
  onSave,
  isSaving = false,
}) => {
  const { t } = useTranslation();
  const [installations, setInstallations] = useState<ClaudeInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstallation, setSelectedInstallation] = useState<ClaudeInstallation | null>(null);

  useEffect(() => {
    loadInstallations();
  }, []);

  useEffect(() => {
    // Update selected installation when selectedPath changes
    if (selectedPath && installations.length > 0) {
      const found = installations.find(i => i.path === selectedPath);
      if (found) {
        setSelectedInstallation(found);
      }
    }
  }, [selectedPath, installations]);

  const loadInstallations = async () => {
    try {
      setLoading(true);
      setError(null);
      const foundInstallations = await api.listClaudeInstallations();
      setInstallations(foundInstallations);
      
      // If we have a selected path, find and select it
      if (selectedPath) {
        const found = foundInstallations.find(i => i.path === selectedPath);
        if (found) {
          setSelectedInstallation(found);
        }
      } else if (foundInstallations.length > 0) {
        // Auto-select the first (best) installation
        setSelectedInstallation(foundInstallations[0]);
        onSelect(foundInstallations[0]);
      }
    } catch (err) {
      console.error("Failed to load Claude installations:", err);
      setError(err instanceof Error ? err.message : t("claudeVersionSelector.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleInstallationChange = (installationPath: string) => {
    const installation = installations.find(i => i.path === installationPath);
    if (installation) {
      setSelectedInstallation(installation);
      onSelect(installation);
    }
  };

  const getInstallationIcon = (installation: ClaudeInstallation) => {
    switch (installation.installation_type) {
      case "Bundled":
        return <Package className="h-4 w-4" />;
      case "System":
        return <HardDrive className="h-4 w-4" />;
      case "Custom":
        return <Settings className="h-4 w-4" />;
      default:
        return <HardDrive className="h-4 w-4" />;
    }
  };

  const getInstallationTypeColor = (installation: ClaudeInstallation) => {
    switch (installation.installation_type) {
      case "Bundled":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "System":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Custom":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{t("claudeVersionSelector.title")}</CardTitle>
          <CardDescription>{t("claudeVersionSelector.loading")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{t("claudeVersionSelector.title")}</CardTitle>
          <CardDescription>{t("claudeVersionSelector.error")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive mb-4">{error}</div>
          <Button onClick={loadInstallations} variant="outline" size="sm">
            {t("claudeVersionSelector.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const bundledInstallations = installations.filter(i => i.installation_type === "Bundled");
  const systemInstallations = installations.filter(i => i.installation_type === "System");
  const customInstallations = installations.filter(i => i.installation_type === "Custom");

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          {t("claudeVersionSelector.title")}
        </CardTitle>
        <CardDescription>
          {t("claudeVersionSelector.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Available Installations */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t("claudeVersionSelector.availableInstallations")}</Label>
          <Select value={selectedInstallation?.path || ""} onValueChange={handleInstallationChange}>
            <SelectTrigger>
              <SelectValue placeholder={t("claudeVersionSelector.selectInstallation")}>
                {selectedInstallation && (
                  <div className="flex items-center gap-2">
                    {getInstallationIcon(selectedInstallation)}
                    <span className="truncate">{selectedInstallation.path}</span>
                    <Badge variant="secondary" className={cn("text-xs", getInstallationTypeColor(selectedInstallation))}>
                      {selectedInstallation.installation_type}
                    </Badge>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {bundledInstallations.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{t("claudeVersionSelector.bundled")}</div>
                  {bundledInstallations.map((installation) => (
                    <SelectItem key={installation.path} value={installation.path}>
                      <div className="flex items-center gap-2 w-full">
                        {getInstallationIcon(installation)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{t("claudeVersionSelector.bundledTitle")}</div>
                          <div className="text-xs text-muted-foreground">
                            {installation.version || t("claudeVersionSelector.versionUnknown")} • {installation.source}
                          </div>
                        </div>
                        <Badge variant="secondary" className={cn("text-xs", getInstallationTypeColor(installation))}>
                          {t("claudeVersionSelector.recommended")}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
              
              {systemInstallations.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{t("claudeVersionSelector.systemInstallations")}</div>
                  {systemInstallations.map((installation) => (
                    <SelectItem key={installation.path} value={installation.path}>
                      <div className="flex items-center gap-2 w-full">
                        {getInstallationIcon(installation)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{installation.path}</div>
                          <div className="text-xs text-muted-foreground">
                            {installation.version || t("claudeVersionSelector.versionUnknown")} • {installation.source}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {t("claudeVersionSelector.system")}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}

              {customInstallations.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{t("claudeVersionSelector.customInstallations")}</div>
                  {customInstallations.map((installation) => (
                    <SelectItem key={installation.path} value={installation.path}>
                      <div className="flex items-center gap-2 w-full">
                        {getInstallationIcon(installation)}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{installation.path}</div>
                          <div className="text-xs text-muted-foreground">
                            {installation.version || t("claudeVersionSelector.versionUnknown")} • {installation.source}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {t("claudeVersionSelector.custom")}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Installation Details */}
        {selectedInstallation && (
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("claudeVersionSelector.selectedInstallation")}</span>
              <Badge className={cn("text-xs", getInstallationTypeColor(selectedInstallation))}>
                {selectedInstallation.installation_type}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <div><strong>{t("claudeVersionSelector.path")}</strong> {selectedInstallation.path}</div>
              <div><strong>{t("claudeVersionSelector.source")}</strong> {selectedInstallation.source}</div>
              {selectedInstallation.version && (
                <div><strong>{t("claudeVersionSelector.version")}</strong> {selectedInstallation.version}</div>
              )}
            </div>
          </div>
        )}

        {/* Save Button */}
        {showSaveButton && (
          <Button 
            onClick={onSave} 
            disabled={isSaving || !selectedInstallation}
            className="w-full"
          >
            {isSaving ? t("claudeVersionSelector.saving") : t("claudeVersionSelector.saveSelection")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}; 
