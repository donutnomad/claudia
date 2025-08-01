import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  GitBranch, 
  Save, 
  RotateCcw, 
  GitFork,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Hash,
  FileCode,
  Diff
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Checkpoint, type TimelineNode, type SessionTimeline, type CheckpointDiff } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface TimelineNavigatorProps {
  sessionId: string;
  projectId: string;
  projectPath: string;
  currentMessageIndex: number;
  onCheckpointSelect: (checkpoint: Checkpoint) => void;
  onFork: (checkpointId: string) => void;
  /**
   * Incrementing value provided by parent to force timeline reload when checkpoints
   * are created elsewhere (e.g., auto-checkpoint after tool execution).
   */
  refreshVersion?: number;
  className?: string;
}

/**
 * Visual timeline navigator for checkpoint management
 */
export const TimelineNavigator: React.FC<TimelineNavigatorProps> = ({
  sessionId,
  projectId,
  projectPath,
  currentMessageIndex,
  onCheckpointSelect,
  onFork,
  refreshVersion = 0,
  className
}) => {
  const { t } = useTranslation();
  const [timeline, setTimeline] = useState<SessionTimeline | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [checkpointDescription, setCheckpointDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<CheckpointDiff | null>(null);
  const [compareCheckpoint, setCompareCheckpoint] = useState<Checkpoint | null>(null);

  // Load timeline on mount and whenever refreshVersion bumps
  useEffect(() => {
    loadTimeline();
  }, [sessionId, projectId, projectPath, refreshVersion]);

  const loadTimeline = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const timelineData = await api.getSessionTimeline(sessionId, projectId, projectPath);
      setTimeline(timelineData);
      
      // Auto-expand nodes with current checkpoint
      if (timelineData.currentCheckpointId && timelineData.rootNode) {
        const pathToNode = findPathToCheckpoint(timelineData.rootNode, timelineData.currentCheckpointId);
        setExpandedNodes(new Set(pathToNode));
      }
    } catch (err) {
      console.error("Failed to load timeline:", err);
      setError(t("timelineNavigator.failedToLoadTimeline"));
    } finally {
      setIsLoading(false);
    }
  };

  const findPathToCheckpoint = (node: TimelineNode, checkpointId: string, path: string[] = []): string[] => {
    if (node.checkpoint.id === checkpointId) {
      return path;
    }
    
    for (const child of node.children) {
      const childPath = findPathToCheckpoint(child, checkpointId, [...path, node.checkpoint.id]);
      if (childPath.length > path.length) {
        return childPath;
      }
    }
    
    return path;
  };

  const handleCreateCheckpoint = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await api.createCheckpoint(
        sessionId,
        projectId,
        projectPath,
        currentMessageIndex,
        checkpointDescription || undefined
      );
      
      setCheckpointDescription("");
      setShowCreateDialog(false);
      await loadTimeline();
    } catch (err) {
      console.error("Failed to create checkpoint:", err);
      setError(t("timelineNavigator.failedToCreateCheckpoint"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreCheckpoint = async (checkpoint: Checkpoint) => {
    if (!confirm(t("timelineNavigator.restoreConfirm", { description: checkpoint.description || checkpoint.id.slice(0, 8) }))) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // First create a checkpoint of current state
      await api.createCheckpoint(
        sessionId,
        projectId,
        projectPath,
        currentMessageIndex,
        t("timelineNavigator.autoSaveBeforeRestore")
      );
      
      // Then restore
      await api.restoreCheckpoint(checkpoint.id, sessionId, projectId, projectPath);
      
      await loadTimeline();
      onCheckpointSelect(checkpoint);
    } catch (err) {
      console.error("Failed to restore checkpoint:", err);
      setError(t("timelineNavigator.failedToRestoreCheckpoint"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFork = async (checkpoint: Checkpoint) => {
    onFork(checkpoint.id);
  };

  const handleCompare = async (checkpoint: Checkpoint) => {
    if (!selectedCheckpoint) {
      setSelectedCheckpoint(checkpoint);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const diffData = await api.getCheckpointDiff(
        selectedCheckpoint.id,
        checkpoint.id,
        sessionId,
        projectId
      );
      
      setDiff(diffData);
      setCompareCheckpoint(checkpoint);
      setShowDiffDialog(true);
    } catch (err) {
      console.error("Failed to get diff:", err);
      setError(t("timelineNavigator.failedToCompareCheckpoints"));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderTimelineNode = (node: TimelineNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.checkpoint.id);
    const hasChildren = node.children.length > 0;
    const isCurrent = timeline?.currentCheckpointId === node.checkpoint.id;
    const isSelected = selectedCheckpoint?.id === node.checkpoint.id;

    return (
      <div key={node.checkpoint.id} className="relative">
        {/* Connection line */}
        {depth > 0 && (
          <div 
            className="absolute left-0 top-0 w-6 h-6 border-l-2 border-b-2 border-muted-foreground/30"
            style={{ 
              left: `${(depth - 1) * 24}px`,
              borderBottomLeftRadius: '8px'
            }}
          />
        )}
        
        {/* Node content */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: depth * 0.05 }}
          className={cn(
            "flex items-start gap-2 py-2",
            depth > 0 && "ml-6"
          )}
          style={{ paddingLeft: `${depth * 24}px` }}
        >
          {/* Expand/collapse button */}
          {hasChildren && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -ml-1"
              onClick={() => toggleNodeExpansion(node.checkpoint.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          )}
          
          {/* Checkpoint card */}
          <Card 
            className={cn(
              "flex-1 cursor-pointer transition-all hover:shadow-md",
              isCurrent && "border-primary ring-2 ring-primary/20",
              isSelected && "border-blue-500 bg-blue-500/5",
              !hasChildren && "ml-5"
            )}
            onClick={() => setSelectedCheckpoint(node.checkpoint)}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {isCurrent && (
                      <Badge variant="default" className="text-xs">Current</Badge>
                    )}
                    <span className="text-xs font-mono text-muted-foreground">
                      {node.checkpoint.id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(node.checkpoint.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  
                  {node.checkpoint.description && (
                    <p className="text-sm font-medium mb-1">{node.checkpoint.description}</p>
                  )}
                  
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {node.checkpoint.metadata.userPrompt || t("timelineNavigator.noPrompt")}
                  </p>
                  
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {node.checkpoint.metadata.totalTokens.toLocaleString()} tokens
                    </span>
                    <span className="flex items-center gap-1">
                      <FileCode className="h-3 w-3" />
                      {node.checkpoint.metadata.fileChanges} files
                    </span>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestoreCheckpoint(node.checkpoint);
                          }}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("timelineNavigator.restoreToCheckpoint")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFork(node.checkpoint);
                          }}
                        >
                          <GitFork className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("timelineNavigator.forkFromCheckpoint")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompare(node.checkpoint);
                          }}
                        >
                          <Diff className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("timelineNavigator.compareWithCheckpoint")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="relative">
            {/* Vertical line for children */}
            {node.children.length > 1 && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/30"
                style={{ left: `${(depth + 1) * 24 - 1}px` }}
              />
            )}
            
            {node.children.map((child) => 
              renderTimelineNode(child, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Experimental Feature Warning */}
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-yellow-600">{t("timelineNavigator.experimentalFeature")}</p>
            <p className="text-yellow-600/80">
              {t("timelineNavigator.experimentalWarning")}
            </p>
          </div>
        </div>
      </div>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-medium">{t("timelineNavigator.timeline")}</h3>
          {timeline && (
            <Badge variant="outline" className="text-xs">
              {t("timelineNavigator.checkpointsCount", { count: timeline.totalCheckpoints })}
            </Badge>
          )}
        </div>
        
        <Button
          size="sm"
          variant="default"
          onClick={() => setShowCreateDialog(true)}
          disabled={isLoading}
        >
          <Save className="h-3 w-3 mr-1" />
          {t("timelineNavigator.checkpoint")}
        </Button>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}
      
      {/* Timeline tree */}
      {timeline?.rootNode ? (
        <div className="relative overflow-x-auto">
          {renderTimelineNode(timeline.rootNode)}
        </div>
      ) : (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {isLoading ? t("timelineNavigator.loadingTimeline") : t("timelineNavigator.noCheckpointsYet")}
        </div>
      )}
      
      {/* Create checkpoint dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("timelineNavigator.createCheckpoint")}</DialogTitle>
            <DialogDescription>
              {t("timelineNavigator.createCheckpointDescription")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">{t("timelineNavigator.descriptionOptional")}</Label>
              <Input
                id="description"
                placeholder={t("timelineNavigator.descriptionPlaceholder")}
                value={checkpointDescription}
                onChange={(e) => setCheckpointDescription(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !isLoading) {
                    handleCreateCheckpoint();
                  }
                }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isLoading}
            >
              {t("timelineNavigator.cancel")}
            </Button>
            <Button
              onClick={handleCreateCheckpoint}
              disabled={isLoading}
            >
              {t("timelineNavigator.createCheckpoint")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diff dialog */}
      <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("timelineNavigator.checkpointComparison")}</DialogTitle>
            <DialogDescription>
              {t("timelineNavigator.changesBetween", { 
                from: selectedCheckpoint?.description || selectedCheckpoint?.id.slice(0, 8),
                to: compareCheckpoint?.description || compareCheckpoint?.id.slice(0, 8)
              })}
            </DialogDescription>
          </DialogHeader>
          
          {diff && (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">{t("timelineNavigator.modifiedFiles")}</div>
                    <div className="text-2xl font-bold">{diff.modifiedFiles.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">{t("timelineNavigator.addedFiles")}</div>
                    <div className="text-2xl font-bold text-green-600">{diff.addedFiles.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">{t("timelineNavigator.deletedFiles")}</div>
                    <div className="text-2xl font-bold text-red-600">{diff.deletedFiles.length}</div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Token delta */}
              <div className="flex items-center justify-center">
                <Badge variant={diff.tokenDelta > 0 ? "default" : "secondary"}>
                  {diff.tokenDelta > 0 ? "+" : ""}{diff.tokenDelta.toLocaleString()} {t("timelineNavigator.tokens")}
                </Badge>
              </div>
              
              {/* File lists */}
              {diff.modifiedFiles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">{t("timelineNavigator.modifiedFiles")}</h4>
                  <div className="space-y-1">
                    {diff.modifiedFiles.map((file) => (
                      <div key={file.path} className="flex items-center justify-between text-xs">
                        <span className="font-mono">{file.path}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-600">+{file.additions}</span>
                          <span className="text-red-600">-{file.deletions}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {diff.addedFiles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">{t("timelineNavigator.addedFiles")}</h4>
                  <div className="space-y-1">
                    {diff.addedFiles.map((file) => (
                      <div key={file} className="text-xs font-mono text-green-600">
                        + {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {diff.deletedFiles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">{t("timelineNavigator.deletedFiles")}</h4>
                  <div className="space-y-1">
                    {diff.deletedFiles.map((file) => (
                      <div key={file} className="text-xs font-mono text-red-600">
                        - {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDiffDialog(false);
                setDiff(null);
                setCompareCheckpoint(null);
              }}
            >
              {t("timelineNavigator.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}; 
