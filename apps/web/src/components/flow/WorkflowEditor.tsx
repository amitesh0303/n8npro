'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node as RFNode,
  type Edge as RFEdge,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { v4 as uuid } from 'uuid';
import { WorkflowNodeComponent } from './WorkflowNode';
import { AddNodePanel } from './AddNodePanel';
import { NodeConfigPanel } from './NodeConfigPanel';
import type { Workflow, WorkflowNode } from '../../types';
import type { NodeKind } from '../../types/shared';

const nodeTypes = { workflowNode: WorkflowNodeComponent };

interface WorkflowEditorProps {
  workflow: Workflow;
  onSave: (nodes: RFNode[], edges: RFEdge[]) => Promise<void>;
  onRun: () => Promise<void>;
  isSaving?: boolean;
  isRunning?: boolean;
}

function workflowNodeToRF(wn: WorkflowNode): RFNode {
  return {
    id: wn.id,
    type: 'workflowNode',
    position: wn.position,
    data: { label: wn.label, kind: wn.kind, config: wn.config },
  };
}

export function WorkflowEditor({
  workflow,
  onSave,
  onRun,
  isSaving,
  isRunning,
}: WorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    workflow.nodes.map(workflowNodeToRF)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    workflow.edges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      style: { stroke: '#94a3b8' },
    }))
  );

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Update nodes/edges when workflow prop changes
  useEffect(() => {
    setNodes(workflow.nodes.map(workflowNodeToRF));
    setEdges(
      workflow.edges.map((e) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        style: { stroke: '#94a3b8' },
      }))
    );
  }, [workflow.id, setNodes, setEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) =>
        addEdge({ ...connection, id: uuid(), style: { stroke: '#94a3b8' } }, eds)
      ),
    [setEdges]
  );

  const handleAddNode = (kind: NodeKind, label: string) => {
    const newNode: RFNode = {
      id: uuid(),
      type: 'workflowNode',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 200 + 100 },
      data: { label, kind, config: {} },
    };
    setNodes((nds) => [...nds, newNode]);
    setShowAddPanel(false);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const handleUpdateNodeConfig = (config: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId ? { ...n, data: { ...n.data, config } } : n
      )
    );
  };

  return (
    <div className="flex h-full">
      {/* Canvas */}
      <div className="flex-1 relative">
        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={() => setShowAddPanel((v) => !v)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-2 rounded-lg shadow transition-colors"
          >
            + Add Node
          </button>
          <button
            onClick={() => onSave(nodes, edges)}
            disabled={isSaving}
            className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium px-3 py-2 rounded-lg shadow transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onRun}
            disabled={isRunning}
            className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-2 rounded-lg shadow transition-colors disabled:opacity-50"
          >
            {isRunning ? 'Running…' : '▶ Run'}
          </button>
        </div>

        {/* Add Node Panel */}
        {showAddPanel && (
          <div className="absolute top-16 left-4 z-20">
            <AddNodePanel onAdd={handleAddNode} />
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={(_e, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
          className="bg-slate-900"
        >
          <Background variant={BackgroundVariant.Dots} color="#334155" />
          <Controls className="!bg-slate-800 !border-slate-700" />
          <MiniMap
            className="!bg-slate-800 !border-slate-700"
            nodeColor="#3b82f6"
            maskColor="rgba(15,23,42,0.8)"
          />
        </ReactFlow>
      </div>

      {/* Node Config Panel */}
      {selectedNodeId && selectedNode && (
        <NodeConfigPanel
          node={{
            id: selectedNode.id,
            workflowId: workflow.id,
            kind: selectedNode.data.kind as NodeKind,
            label: selectedNode.data.label as string,
            position: selectedNode.position,
            config: (selectedNode.data.config as Record<string, unknown>) ?? {},
            createdAt: '',
            updatedAt: '',
          }}
          onUpdate={handleUpdateNodeConfig}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}
