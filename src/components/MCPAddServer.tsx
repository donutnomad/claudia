import React, { useState } from "react";
import { Plus, Terminal, Globe, Trash2, Info, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SelectComponent } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

interface MCPAddServerProps {
  /**
   * Callback when a server is successfully added
   */
  onServerAdded: () => void;
  /**
   * Callback for error messages
   */
  onError: (message: string) => void;
}

interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
}

/**
 * Component for adding new MCP servers
 * Supports both stdio and SSE transport types
 */
export const MCPAddServer: React.FC<MCPAddServerProps> = ({
  onServerAdded,
  onError,
}) => {
  const { t } = useTranslation();
  const [transport, setTransport] = useState<"stdio" | "sse">("stdio");
  const [saving, setSaving] = useState(false);
  
  // Stdio server state
  const [stdioName, setStdioName] = useState("");
  const [stdioCommand, setStdioCommand] = useState("");
  const [stdioArgs, setStdioArgs] = useState("");
  const [stdioScope, setStdioScope] = useState("local");
  const [stdioEnvVars, setStdioEnvVars] = useState<EnvironmentVariable[]>([]);
  
  // SSE server state
  const [sseName, setSseName] = useState("");
  const [sseUrl, setSseUrl] = useState("");
  const [sseScope, setSseScope] = useState("local");
  const [sseEnvVars, setSseEnvVars] = useState<EnvironmentVariable[]>([]);

  /**
   * Adds a new environment variable
   */
  const addEnvVar = (type: "stdio" | "sse") => {
    const newVar: EnvironmentVariable = {
      id: `env-${Date.now()}`,
      key: "",
      value: "",
    };
    
    if (type === "stdio") {
      setStdioEnvVars(prev => [...prev, newVar]);
    } else {
      setSseEnvVars(prev => [...prev, newVar]);
    }
  };

  /**
   * Updates an environment variable
   */
  const updateEnvVar = (type: "stdio" | "sse", id: string, field: "key" | "value", value: string) => {
    if (type === "stdio") {
      setStdioEnvVars(prev => prev.map(v => 
        v.id === id ? { ...v, [field]: value } : v
      ));
    } else {
      setSseEnvVars(prev => prev.map(v => 
        v.id === id ? { ...v, [field]: value } : v
      ));
    }
  };

  /**
   * Removes an environment variable
   */
  const removeEnvVar = (type: "stdio" | "sse", id: string) => {
    if (type === "stdio") {
      setStdioEnvVars(prev => prev.filter(v => v.id !== id));
    } else {
      setSseEnvVars(prev => prev.filter(v => v.id !== id));
    }
  };

  /**
   * Validates and adds a stdio server
   */
  const handleAddStdioServer = async () => {
    if (!stdioName.trim()) {
      onError(t('mcpAddServer.errors.nameRequired'));
      return;
    }
    
    if (!stdioCommand.trim()) {
      onError(t('mcpAddServer.errors.commandRequired'));
      return;
    }
    
    try {
      setSaving(true);
      
      // Parse arguments
      const args = stdioArgs.trim() ? stdioArgs.split(/\s+/) : [];
      
      // Convert env vars to object
      const env = stdioEnvVars.reduce((acc, { key, value }) => {
        if (key.trim() && value.trim()) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>);
      
      const result = await api.mcpAdd(
        stdioName,
        "stdio",
        stdioCommand,
        args,
        env,
        undefined,
        stdioScope
      );
      
      if (result.success) {
        // Reset form
        setStdioName("");
        setStdioCommand("");
        setStdioArgs("");
        setStdioEnvVars([]);
        setStdioScope("local");
        onServerAdded();
      } else {
        onError(result.message);
      }
    } catch (error) {
      onError(t('mcpAddServer.errors.failedToAdd'));
      console.error("Failed to add stdio server:", error);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Validates and adds an SSE server
   */
  const handleAddSseServer = async () => {
    if (!sseName.trim()) {
      onError(t('mcpAddServer.errors.nameRequired'));
      return;
    }
    
    if (!sseUrl.trim()) {
      onError(t('mcpAddServer.errors.urlRequired'));
      return;
    }
    
    try {
      setSaving(true);
      
      // Convert env vars to object
      const env = sseEnvVars.reduce((acc, { key, value }) => {
        if (key.trim() && value.trim()) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>);
      
      const result = await api.mcpAdd(
        sseName,
        "sse",
        undefined,
        [],
        env,
        sseUrl,
        sseScope
      );
      
      if (result.success) {
        // Reset form
        setSseName("");
        setSseUrl("");
        setSseEnvVars([]);
        setSseScope("local");
        onServerAdded();
      } else {
        onError(result.message);
      }
    } catch (error) {
      onError(t('mcpAddServer.errors.failedToAdd'));
      console.error("Failed to add SSE server:", error);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Renders environment variable inputs
   */
  const renderEnvVars = (type: "stdio" | "sse", envVars: EnvironmentVariable[]) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{t('mcpAddServer.envVars.title')}</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addEnvVar(type)}
            className="gap-2"
          >
            <Plus className="h-3 w-3" />
            {t('mcpAddServer.envVars.addVariable')}
          </Button>
        </div>
        
        {envVars.length > 0 && (
          <div className="space-y-2">
            {envVars.map((envVar) => (
              <div key={envVar.id} className="flex items-center gap-2">
                <Input
                  placeholder={t('mcpAddServer.envVars.keyPlaceholder')}
                  value={envVar.key}
                  onChange={(e) => updateEnvVar(type, envVar.id, "key", e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
                <span className="text-muted-foreground">=</span>
                <Input
                  placeholder={t('mcpAddServer.envVars.valuePlaceholder')}
                  value={envVar.value}
                  onChange={(e) => updateEnvVar(type, envVar.id, "value", e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEnvVar(type, envVar.id)}
                  className="h-8 w-8 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-base font-semibold">{t('mcpAddServer.title')}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t('mcpAddServer.description')}
        </p>
      </div>

      <Tabs value={transport} onValueChange={(v) => setTransport(v as "stdio" | "sse")}>
        <TabsList className="grid w-full grid-cols-2 max-w-sm mb-6">
          <TabsTrigger value="stdio" className="gap-2">
            <Terminal className="h-4 w-4 text-amber-500" />
            Stdio
          </TabsTrigger>
          <TabsTrigger value="sse" className="gap-2">
            <Globe className="h-4 w-4 text-emerald-500" />
            SSE
          </TabsTrigger>
        </TabsList>

        {/* Stdio Server */}
        <TabsContent value="stdio" className="space-y-6">
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stdio-name">{t('mcpAddServer.stdio.name')}</Label>
                <Input
                  id="stdio-name"
                  placeholder={t('mcpAddServer.stdio.namePlaceholder')}
                  value={stdioName}
                  onChange={(e) => setStdioName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('mcpAddServer.stdio.nameDescription')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stdio-command">{t('mcpAddServer.stdio.command')}</Label>
                <Input
                  id="stdio-command"
                  placeholder={t('mcpAddServer.stdio.commandPlaceholder')}
                  value={stdioCommand}
                  onChange={(e) => setStdioCommand(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {t('mcpAddServer.stdio.commandDescription')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stdio-args">{t('mcpAddServer.stdio.arguments')}</Label>
                <Input
                  id="stdio-args"
                  placeholder={t('mcpAddServer.stdio.argumentsPlaceholder')}
                  value={stdioArgs}
                  onChange={(e) => setStdioArgs(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {t('mcpAddServer.stdio.argumentsDescription')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stdio-scope">{t('mcpAddServer.stdio.scope')}</Label>
                <SelectComponent
                  value={stdioScope}
                  onValueChange={(value: string) => setStdioScope(value)}
                  options={[
                    { value: "local", label: t('mcpAddServer.stdio.scopeOptions.local') },
                    { value: "project", label: t('mcpAddServer.stdio.scopeOptions.project') },
                    { value: "user", label: t('mcpAddServer.stdio.scopeOptions.user') },
                  ]}
                />
              </div>

              {renderEnvVars("stdio", stdioEnvVars)}
            </div>

            <div className="pt-2">
              <Button
                onClick={handleAddStdioServer}
                disabled={saving}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('mcpAddServer.stdio.addingServer')}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {t('mcpAddServer.stdio.addServer')}
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* SSE Server */}
        <TabsContent value="sse" className="space-y-6">
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sse-name">{t('mcpAddServer.sse.name')}</Label>
                <Input
                  id="sse-name"
                  placeholder={t('mcpAddServer.sse.namePlaceholder')}
                  value={sseName}
                  onChange={(e) => setSseName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('mcpAddServer.sse.nameDescription')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sse-url">{t('mcpAddServer.sse.url')}</Label>
                <Input
                  id="sse-url"
                  placeholder={t('mcpAddServer.sse.urlPlaceholder')}
                  value={sseUrl}
                  onChange={(e) => setSseUrl(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {t('mcpAddServer.sse.urlDescription')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sse-scope">{t('mcpAddServer.sse.scope')}</Label>
                <SelectComponent
                  value={sseScope}
                  onValueChange={(value: string) => setSseScope(value)}
                  options={[
                    { value: "local", label: t('mcpAddServer.sse.scopeOptions.local') },
                    { value: "project", label: t('mcpAddServer.sse.scopeOptions.project') },
                    { value: "user", label: t('mcpAddServer.sse.scopeOptions.user') },
                  ]}
                />
              </div>

              {renderEnvVars("sse", sseEnvVars)}
            </div>

            <div className="pt-2">
              <Button
                onClick={handleAddSseServer}
                disabled={saving}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('mcpAddServer.sse.addingServer')}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {t('mcpAddServer.sse.addServer')}
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Example */}
      <Card className="p-4 bg-muted/30">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4 text-primary" />
            <span>{t('mcpAddServer.example.title')}</span>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="font-mono bg-background p-2 rounded">
              <p>• {t('mcpAddServer.example.postgres')}</p>
              <p>• {t('mcpAddServer.example.weather')}</p>
              <p>• {t('mcpAddServer.example.sse')}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}; 