'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle,
  Archive,
  Sparkles,
  UserCheck,
  X,
  Layers,
} from 'lucide-react';
import { LinkedinIcon as Linkedin } from '@/components/common/LinkedinIcon';
import { Sequence, Lead } from '@/types/crm';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';

interface WorkflowNode {
  id: string;
  type: 'start' | 'action' | 'wait' | 'decision' | 'condition' | 'stage' | 'outcome' | 'terminal';
  label: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  icon?: any;
  status?: 'normal' | 'waiting' | 'branch' | 'success' | 'terminal';
  leadsCount?: number;
  details?: {
    description: string;
    rules: string[];
    sampleMessage?: string;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: 'solid' | 'dashed' | 'branch_success' | 'branch_failure';
}

interface WorkflowCanvasProps {
  sequence: Sequence;
  enrolledLeads?: Lead[];
}

export function WorkflowCanvas({ sequence, enrolledLeads = [] }: WorkflowCanvasProps) {
  const { advanceLeadStep } = useCRM();
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas zoom & pan state — initialized to fit all 8 stages and terminal branches
  const [zoom, setZoom] = useState(0.72);
  const [pan, setPan] = useState({ x: 60, y: 20 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Selected node for details panel
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);

  // Build the node graph based on LinkedIn Decision Sequence
  const { nodes, edges } = useMemo(() => {
    const NODE_WIDTH = 260;
    const NODE_HEIGHT = 72;
    const CENTER_X = 380;

    const graphNodes: WorkflowNode[] = [
      {
        id: 'node_start',
        type: 'start',
        label: 'Lead Enrolled in Sequence',
        subtitle: 'Decision 3 Approved · SDR outreach queued',
        x: CENTER_X,
        y: 40,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        icon: UserCheck,
        status: 'normal',
        leadsCount: enrolledLeads.filter((l) => l.currentStepNumber === 0).length,
        details: {
          description: 'Triggered when SDR captures lead or enrolls an existing prospect into this approved sequence.',
          rules: ['Verifies valid LinkedIn profile URL', 'Checks daily LinkedIn safe limits (25 connect / day)'],
        },
      },
      {
        id: 'node_conn_request',
        type: 'action',
        label: 'Connection Request',
        subtitle: 'Step 1: Send personalized connection invitation',
        x: CENTER_X,
        y: 150,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        icon: Linkedin,
        status: 'normal',
        leadsCount: enrolledLeads.filter((l) => l.currentStepNumber === 1).length,
        details: {
          description: 'Dispatches personalized LinkedIn connection request with intro note.',
          rules: [
            'Includes dynamic variables {{firstName}} and {{company}}',
            'Recorded in lead timeline as Connection Request Sent',
          ],
          sampleMessage: 'Hi {{firstName}}, noticed your work at {{company}}. Would love to connect and follow your journey.',
        },
      },
      // Branch 1: Declined / Unanswered Timeout (Branch to right)
      {
        id: 'node_declined_branch',
        type: 'terminal',
        label: 'Declined / Timeout',
        subtitle: 'Connection rejected or unanswered (7d)',
        x: CENTER_X + 320,
        y: 150,
        width: 240,
        height: NODE_HEIGHT,
        icon: AlertTriangle,
        status: 'terminal',
        leadsCount: enrolledLeads.filter((l) => l.connectionStatus === 'declined').length,
        details: {
          description: 'Prospect declined or connection timed out. Halts sequence execution per decision tree.',
          rules: ['Stops sequence execution', 'Flags lead for SDR review or archive'],
        },
      },
      {
        id: 'node_wait_acceptance',
        type: 'wait',
        label: 'Wait for Acceptance',
        subtitle: 'Decision 2 Gate: Listen for acceptance event',
        x: CENTER_X,
        y: 260,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        icon: Clock,
        status: 'waiting',
        leadsCount: enrolledLeads.filter((l) => l.currentStepNumber === 2 && l.connectionStatus === 'pending').length,
        details: {
          description: 'Pauses sequence until prospect accepts connection.',
          rules: ['Explicit acceptance required before messaging', 'Prevents messaging non-connections'],
        },
      },
      {
        id: 'node_conn_accepted',
        type: 'condition',
        label: 'Connection Accepted',
        subtitle: 'Step 2: Network connection confirmed',
        x: CENTER_X,
        y: 370,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        icon: CheckCircle2,
        status: 'success',
        leadsCount: enrolledLeads.filter((l) => l.connectionStatus === 'connected' && l.currentStepNumber === 2).length,
        details: {
          description: 'Confirmed LinkedIn connection status. Unlocks direct messaging capabilities.',
          rules: ['Updates lead state to Connected', 'Records Connection Accepted event in timeline'],
        },
      },
      {
        id: 'node_send_message',
        type: 'action',
        label: 'Manual LinkedIn Message',
        subtitle: 'Step 3: Initial value proposition message',
        x: CENTER_X,
        y: 480,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        icon: Linkedin,
        status: 'normal',
        leadsCount: enrolledLeads.filter((l) => l.currentStepNumber === 3).length,
        details: {
          description: 'SDR opens LinkedIn profile, copies personalized message, sends, and records sent.',
          rules: ['Waits 1 day after acceptance', 'Monitors for replies to prevent automated follow-up clash'],
          sampleMessage: 'Thanks for connecting, {{firstName}}! How is {{company}} approaching outbound sales this quarter?',
        },
      },
      // Branch 2: Reply Received (Branch to left)
      {
        id: 'node_reply_branch',
        type: 'terminal',
        label: 'Reply Received / Meeting',
        subtitle: 'Halts sequence; alerts SDR for conversation',
        x: CENTER_X - 320,
        y: 530,
        width: 240,
        height: NODE_HEIGHT,
        icon: CheckCircle2,
        status: 'success',
        leadsCount: enrolledLeads.filter((l) => l.outreachStatus === 'replied' || l.outcome === 'Meeting Booked').length,
        details: {
          description: 'Prospect responded to message or booked meeting. Automatically cancels all pending follow-ups.',
          rules: ['Creates priority response task for assigned SDR', 'Transitions lead into active opportunity tracking'],
        },
      },
      {
        id: 'node_followup',
        type: 'action',
        label: 'Follow-up Message Nudge',
        subtitle: 'Step 4: Case study & value proposition nudge',
        x: CENTER_X,
        y: 590,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        icon: Send,
        status: 'normal',
        leadsCount: enrolledLeads.filter((l) => l.currentStepNumber === 4).length,
        details: {
          description: 'Dispatches subsequent nudge if no reply is detected after configured delay.',
          rules: ['Waits 3 business days', 'Terminates if reply is recorded'],
          sampleMessage: 'Hey {{firstName}}, just following up on my previous note. Open to a brief 5-min demo next week?',
        },
      },
      // PARENT STAGE: Complete Details
      {
        id: 'node_complete_details',
        type: 'stage',
        label: 'Complete Details',
        subtitle: 'Step 5: Parent Stage — Outreach Finished',
        x: CENTER_X,
        y: 710,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        icon: Layers,
        status: 'normal',
        leadsCount: enrolledLeads.filter((l) => l.disposition === 'complete_details').length,
        details: {
          description: 'Parent stage representing completion of outreach sequence and transition to disposition review.',
          rules: [
            'All scheduled outreach steps are finished',
            'Must branch directly beneath into either Enrich or Archived',
          ],
        },
      },
      // CHILD OUTCOME 1: Enrich
      {
        id: 'node_enrich',
        type: 'outcome',
        label: 'Enrich',
        subtitle: 'Child Outcome: Verify intelligence & tech profile',
        x: CENTER_X - 150,
        y: 840,
        width: 240,
        height: NODE_HEIGHT,
        icon: Sparkles,
        status: 'success',
        leadsCount: enrolledLeads.filter((l) => l.disposition === 'enriched').length,
        details: {
          description: 'Child outcome directly beneath Complete Details. Enriches phone verification, revenue, and tech stack.',
          rules: ['Updates phone verification', 'Appends tech stack and ARR profile'],
        },
      },
      // CHILD OUTCOME 2: Archived
      {
        id: 'node_archived',
        type: 'outcome',
        label: 'Archived',
        subtitle: 'Child Outcome: Move to archive without data loss',
        x: CENTER_X + 150,
        y: 840,
        width: 240,
        height: NODE_HEIGHT,
        icon: Archive,
        status: 'terminal',
        leadsCount: enrolledLeads.filter((l) => l.disposition === 'archived').length,
        details: {
          description: 'Child outcome directly beneath Complete Details. Preserves activity history in archive filter.',
          rules: ['Excluded from active pipeline view', 'Activity timeline completely preserved'],
        },
      },
    ];

    const graphEdges: WorkflowEdge[] = [
      { id: 'e1', source: 'node_start', target: 'node_conn_request', type: 'solid' },
      { id: 'e2', source: 'node_conn_request', target: 'node_declined_branch', label: 'Declined / Timeout', type: 'dashed' },
      { id: 'e3', source: 'node_conn_request', target: 'node_wait_acceptance', label: 'Sent', type: 'solid' },
      { id: 'e4', source: 'node_wait_acceptance', target: 'node_conn_accepted', label: 'Accepted', type: 'solid' },
      { id: 'e5', source: 'node_conn_accepted', target: 'node_send_message', label: 'Network Member', type: 'solid' },
      { id: 'e6', source: 'node_send_message', target: 'node_reply_branch', label: 'Reply Received', type: 'branch_success' },
      { id: 'e7', source: 'node_send_message', target: 'node_followup', label: 'No Reply (3d)', type: 'solid' },
      { id: 'e8', source: 'node_followup', target: 'node_reply_branch', label: 'Reply Received', type: 'branch_success' },
      { id: 'e9', source: 'node_followup', target: 'node_complete_details', label: 'Sequence Complete', type: 'solid' },
      // Strict parent-to-child edges directly beneath Complete Details:
      { id: 'e10', source: 'node_complete_details', target: 'node_enrich', label: 'Option: Enrich', type: 'branch_success' },
      { id: 'e11', source: 'node_complete_details', target: 'node_archived', label: 'Option: Archive', type: 'dashed' },
    ];

    return { nodes: graphNodes, edges: graphEdges };
  }, [enrolledLeads]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.workflow-node') || (e.target as HTMLElement).closest('.canvas-control')) {
      return;
    }
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Wheel handler: allows vertical & horizontal mouse wheel/trackpad scrolling and Ctrl+wheel zooming
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Zoom with Ctrl / Command + Wheel
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? -0.06 : 0.06;
      setZoom((z) => Math.min(Math.max(Number((z + zoomDelta).toFixed(2)), 0.35), 1.6));
    } else {
      // Pan vertically & horizontally
      e.preventDefault();
      setPan((p) => ({
        x: p.x - e.deltaX * 0.9,
        y: p.y - e.deltaY * 0.9,
      }));
    }
  };

  // Touch handlers for mobile and trackpad gestures
  const [startTouch, setStartTouch] = useState({ x: 0, y: 0 });
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setStartTouch({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setPan({
        x: e.touches[0].clientX - startTouch.x,
        y: e.touches[0].clientY - startTouch.y,
      });
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(Number((z + 0.1).toFixed(2)), 1.6));
  const handleZoomOut = () => setZoom((z) => Math.max(Number((z - 0.1).toFixed(2)), 0.35));
  const handleReset = () => {
    setZoom(0.72);
    setPan({ x: 60, y: 20 });
  };
  const handleFitToScreen = () => {
    setZoom(0.72);
    setPan({ x: 60, y: 20 });
  };

  // Node helper lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, WorkflowNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // SVG connector renderer
  const renderEdge = (edge: WorkflowEdge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) return null;

    let sx = sourceNode.x + sourceNode.width / 2;
    let sy = sourceNode.y + sourceNode.height;
    let tx = targetNode.x + targetNode.width / 2;
    let ty = targetNode.y;

    const isHorizontalBranch = Math.abs(targetNode.y - sourceNode.y) < 120 && targetNode.x !== sourceNode.x;
    if (isHorizontalBranch) {
      if (targetNode.x > sourceNode.x) {
        sx = sourceNode.x + sourceNode.width;
        sy = sourceNode.y + sourceNode.height / 2;
        tx = targetNode.x;
        ty = targetNode.y + targetNode.height / 2;
      } else {
        sx = sourceNode.x;
        sy = sourceNode.y + sourceNode.height / 2;
        tx = targetNode.x + targetNode.width;
        ty = targetNode.y + targetNode.height / 2;
      }
    }

    let pathD = '';
    if (isHorizontalBranch) {
      const midX = (sx + tx) / 2;
      pathD = `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;
    } else {
      const midY = (sy + ty) / 2;
      pathD = `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
    }

    let strokeColor = '#cbd6e2';
    let strokeDash = undefined;
    if (edge.type === 'dashed') {
      strokeColor = '#cbd6e2';
      strokeDash = '5,5';
    } else if (edge.type === 'branch_success') {
      strokeColor = '#10b981';
    }

    return (
      <g key={edge.id} className="pointer-events-none">
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeDasharray={strokeDash}
          markerEnd={edge.type === 'branch_success' ? 'url(#arrow-emerald)' : 'url(#arrow-slate)'}
        />
        {edge.label && (
          <text
            x={(sx + tx) / 2}
            y={(sy + ty) / 2 - 4}
            textAnchor="middle"
            className="text-[10px] font-semibold fill-slate-500 bg-white"
          >
            {edge.label}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="relative w-full h-[calc(100vh-220px)] min-h-[660px] rounded-lg border border-[#dfe3eb] bg-white overflow-hidden shadow-xs flex flex-col select-none">
      {/* Top Banner Toolbar */}
      <div className="h-11 px-4 border-b border-[#dfe3eb] bg-[#f5f8fa] flex items-center justify-between z-10 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#33475b] uppercase tracking-wider text-[11px]">
            LinkedIn Sequence Architecture
          </span>
          <span className="text-[#cbd6e2]">·</span>
          <span className="text-slate-600 font-medium">
            {sequence.name}
          </span>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1.5 bg-[#f5f8fa] p-1 rounded-lg border border-[#cbd6e2] canvas-control">
          <button
            type="button"
            onClick={handleZoomOut}
            className="h-7 w-7 flex items-center justify-center rounded bg-white text-[#33475b] border border-[#cbd6e2] hover:bg-[#ebf1f7] hover:border-[#99acc2] hover:text-[#2d3e50] shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5 text-[#33475b]" />
          </button>
          <span className="px-2 font-mono text-xs font-bold text-[#2d3e50] min-w-[42px] text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="h-7 w-7 flex items-center justify-center rounded bg-white text-[#33475b] border border-[#cbd6e2] hover:bg-[#ebf1f7] hover:border-[#99acc2] hover:text-[#2d3e50] shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5 text-[#33475b]" />
          </button>
          <button
            type="button"
            onClick={handleFitToScreen}
            className="h-7 px-2.5 flex items-center gap-1.5 rounded bg-white text-[#33475b] border border-[#cbd6e2] hover:bg-[#ebf1f7] hover:border-[#99acc2] hover:text-[#2d3e50] font-semibold text-xs shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="Fit to Screen"
            aria-label="Fit to Screen"
          >
            <Maximize2 className="h-3 w-3 text-[#33475b]" />
            <span>Fit All</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="h-7 w-7 flex items-center justify-center rounded bg-white text-[#33475b] border border-[#cbd6e2] hover:bg-[#ebf1f7] hover:border-[#99acc2] hover:text-[#2d3e50] shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="Reset View"
            aria-label="Reset View"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#33475b]" />
          </button>
        </div>
      </div>

      {/* Interactive Drag & Zoom Canvas Surface */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className={`flex-1 relative overflow-hidden bg-[#f5f8fa]/50 ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          backgroundImage: 'radial-gradient(#cbd5e1 0.75px, transparent 0.75px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Floating Navigation Hint */}
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md border border-[#dfe3eb] shadow-2xs text-[11px] text-[#516f90] select-none pointer-events-none">
          <span>Use mouse wheel or drag to scroll entire workflow</span>
        </div>
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: '1800px',
            height: '1100px',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {/* SVG Connector Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <marker
                id="arrow-slate"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
              </marker>
              <marker
                id="arrow-emerald"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
              </marker>
            </defs>
            {edges.map(renderEdge)}
          </svg>

          {/* Workflow Nodes */}
          {nodes.map((node) => {
            const Icon = node.icon || CheckCircle2;
            const isSelected = selectedNode?.id === node.id;

            let borderStyle = 'border-[#dfe3eb] bg-white';
            let iconBadgeStyle = 'bg-[#f5f8fa] text-[#33475b]';

            if (node.type === 'stage') {
              borderStyle = 'border-[#0091ae] bg-[#f0f9fb]';
              iconBadgeStyle = 'bg-[#0091ae] text-white';
            } else if (node.type === 'outcome' && node.status === 'success') {
              borderStyle = 'border-emerald-300 bg-emerald-50/50';
              iconBadgeStyle = 'bg-emerald-600 text-white';
            } else if (node.type === 'terminal' || (node.type === 'outcome' && node.status === 'terminal')) {
              borderStyle = 'border-slate-300 bg-slate-100/70 text-slate-700';
              iconBadgeStyle = 'bg-slate-400 text-white';
            } else if (node.type === 'action') {
              borderStyle = 'border-[#dfe3eb] bg-white hover:border-[#ff7a59]';
              iconBadgeStyle = 'bg-[#2d3e50] text-white';
            } else if (node.type === 'wait') {
              borderStyle = 'border-amber-200 bg-amber-50/40';
              iconBadgeStyle = 'bg-amber-100 text-amber-700';
            }

            return (
              <div
                key={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode(node);
                }}
                className={`workflow-node absolute rounded-lg border p-3 shadow-xs transition-all cursor-pointer ${borderStyle} ${
                  isSelected ? 'ring-2 ring-[#ff7a59] shadow-md scale-[1.02]' : 'hover:shadow-sm'
                }`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.width}px`,
                  height: `${node.height}px`,
                }}
              >
                <div className="flex items-start gap-2.5 h-full">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconBadgeStyle}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col justify-between h-full">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#33475b] truncate">
                        {node.label}
                      </span>
                      {node.leadsCount !== undefined && node.leadsCount > 0 && (
                        <span className="rounded bg-[#e8f3f8] text-[#0077b5] px-1.5 py-0.2 text-[10px] font-bold tabular-nums border border-[#b2d5e5]">
                          {node.leadsCount} lead{node.leadsCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate leading-tight">
                      {node.subtitle}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Node Inspector Panel */}
        {selectedNode && (
          <div className="canvas-control absolute top-3 right-3 bottom-3 w-80 rounded-lg border border-[#dfe3eb] bg-white p-4 shadow-2xl z-30 flex flex-col text-xs animate-in slide-in-from-right duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-[#dfe3eb]">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-[#0091ae]">
                  Sequence Inspector
                </span>
                <h4 className="font-bold text-sm text-[#33475b] truncate">
                  {selectedNode.label}
                </h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedNode(null)}
                className="h-6 w-6 p-0 text-slate-400"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Overview</p>
                <p className="text-slate-600 mt-0.5 leading-relaxed">
                  {selectedNode.details?.description || selectedNode.subtitle}
                </p>
              </div>

              {selectedNode.details?.rules && selectedNode.details.rules.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">State Rules &amp; Execution</p>
                  <ul className="space-y-1 text-slate-600">
                    {selectedNode.details.rules.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-[#0091ae] font-bold">·</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedNode.details?.sampleMessage && (
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Message Template</p>
                  <div className="rounded bg-[#f5f8fa] p-2.5 text-[#33475b] font-mono text-[10px] border border-[#dfe3eb] whitespace-pre-wrap">
                    {selectedNode.details.sampleMessage}
                  </div>
                </div>
              )}

              {/* Currently Enrolled Leads at this Node */}
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Enrolled Leads at this Step ({selectedNode.leadsCount || 0})
                </p>
                {selectedNode.leadsCount && selectedNode.leadsCount > 0 ? (
                  <div className="space-y-1.5">
                    {enrolledLeads
                      .slice(0, 3)
                      .map((lead) => (
                        <div
                          key={lead.id}
                          className="p-2 rounded border border-[#dfe3eb] bg-[#f5f8fa] flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-[#33475b] truncate">
                              {lead.firstName} {lead.lastName}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">{lead.company}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => advanceLeadStep(lead.id)}
                            className="h-6 text-[10px] px-2 text-[#0091ae] border-[#b2d5e5] bg-white font-semibold"
                          >
                            Advance
                          </Button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">No leads currently at this node.</p>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-[#dfe3eb] flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setSelectedNode(null)} className="text-xs border-[#cbd6e2] text-[#33475b]">
                Close Panel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
