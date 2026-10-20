import React, { useState, useMemo, useRef, useEffect } from "react";
import dagre from "dagre";
import {
  NFA,
  DFA,
  labelOf,
  CompiledRule,
} from "@tripwire/engine";

export type AutomataStage = "REGEX" | "NFA" | "DFA" | "MIN-DFA";

interface TrackDiagramProps {
  compiledRule: CompiledRule;
  activeStateId: number | null;
  previousStateId: number | null;
  onOpenConstruction?: () => void;
  onOpenMerges?: () => void;
}

interface NodeLayout {
  id: number;
  x: number;
  y: number;
  isStart: boolean;
  isAccept: boolean;
  isDead: boolean;
  nfaStates?: readonly number[];
  label: string;
}

interface EdgeLayout {
  from: number;
  to: number;
  label: string;
  isEpsilon: boolean;
  isSelfLoop: boolean;
}

export const TrackDiagram: React.FC<TrackDiagramProps> = ({
  compiledRule,
  activeStateId,
  previousStateId,
  onOpenConstruction,
  onOpenMerges,
}) => {
  const [stage, setStage] = useState<AutomataStage>("MIN-DFA");
  const [showTrapState, setShowTrapState] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<NodeLayout | null>(null);

  // Pan and Zoom state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Determine current active automaton based on selected stage
  const { currentNodes, currentEdges, nfaCount, dfaCount, minCount } = useMemo(() => {
    const nfa = compiledRule.nfa;
    const dfa = compiledRule.dfa;
    const minDfa = compiledRule.minDfa;

    const nfaCount = nfa.states.length;
    const dfaCount = dfa.states.length;
    const minCount = minDfa.states.length;

    let targetAutomaton: {
      type: "nfa" | "dfa";
      startState: number;
      states: Array<{ id: number; isAccept: boolean; isDead?: boolean; nfaStates?: readonly number[]; label: string }>;
      transitions: Array<{ from: number; to: number; label: string; isEpsilon: boolean }>;
    };

    if (stage === "NFA") {
      targetAutomaton = {
        type: "nfa",
        startState: nfa.startState,
        states: nfa.states.map((s) => ({
          id: s.id,
          isAccept: s.id === nfa.acceptState,
          label: `q${s.id}`,
        })),
        transitions: nfa.transitions.map((t) => ({
          from: t.from,
          to: t.to,
          label: t.charSet === null ? "ε" : labelOf(t.charSet),
          isEpsilon: t.charSet === null,
        })),
      };
    } else if (stage === "DFA") {
      const visibleStates = showTrapState ? dfa.states : dfa.states.filter((s) => !s.isDead);
      const visibleIds = new Set(visibleStates.map((s) => s.id));
      targetAutomaton = {
        type: "dfa",
        startState: dfa.startState,
        states: visibleStates.map((s) => ({
          id: s.id,
          isAccept: s.isAccept,
          isDead: s.isDead,
          nfaStates: s.nfaStates,
          label: `q${s.id}`,
        })),
        transitions: dfa.transitions
          .filter((t) => visibleIds.has(t.from) && visibleIds.has(t.to))
          .map((t) => ({
            from: t.from,
            to: t.to,
            label: labelOf(t.charSet),
            isEpsilon: false,
          })),
      };
    } else {
      // MIN-DFA or REGEX
      const visibleStates = showTrapState ? minDfa.states : minDfa.states.filter((s) => !s.isDead);
      const visibleIds = new Set(visibleStates.map((s) => s.id));
      targetAutomaton = {
        type: "dfa",
        startState: minDfa.startState,
        states: visibleStates.map((s) => ({
          id: s.id,
          isAccept: s.isAccept,
          isDead: s.isDead,
          nfaStates: s.nfaStates,
          label: `q${s.id}`,
        })),
        transitions: minDfa.transitions
          .filter((t) => visibleIds.has(t.from) && visibleIds.has(t.to))
          .map((t) => ({
            from: t.from,
            to: t.to,
            label: labelOf(t.charSet),
            isEpsilon: false,
          })),
      };
    }

    // Merge parallel edges between same pair
    const edgeMap = new Map<string, { from: number; to: number; labels: Set<string>; isEpsilon: boolean }>();
    for (const t of targetAutomaton.transitions) {
      const key = `${t.from}->${t.to}`;
      let entry = edgeMap.get(key);
      if (!entry) {
        entry = { from: t.from, to: t.to, labels: new Set(), isEpsilon: t.isEpsilon };
        edgeMap.set(key, entry);
      }
      entry.labels.add(t.label);
    }

    const mergedEdges: EdgeLayout[] = Array.from(edgeMap.values()).map((e) => ({
      from: e.from,
      to: e.to,
      label: Array.from(e.labels).join(", "),
      isEpsilon: e.isEpsilon,
      isSelfLoop: e.from === e.to,
    }));

    // Dagre layout computation (coordinates only)
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 55, ranksep: 75 });
    g.setDefaultEdgeLabel(() => ({}));

    for (const s of targetAutomaton.states) {
      g.setNode(s.id.toString(), { width: 44, height: 44 });
    }

    for (const e of mergedEdges) {
      g.setEdge(e.from.toString(), e.to.toString());
    }

    dagre.layout(g);

    const laidNodes: NodeLayout[] = targetAutomaton.states.map((s) => {
      const n = g.node(s.id.toString());
      return {
        id: s.id,
        x: n ? n.x : 50,
        y: n ? n.y : 50,
        isStart: s.id === targetAutomaton.startState,
        isAccept: s.isAccept,
        isDead: !!s.isDead,
        nfaStates: s.nfaStates,
        label: s.label,
      };
    });

    return {
      currentNodes: laidNodes,
      currentEdges: mergedEdges,
      nfaCount,
      dfaCount,
      minCount,
    };
  }, [compiledRule, stage, showTrapState]);

  // Reset node selection on rule change
  useEffect(() => {
    setSelectedNode(null);
  }, [compiledRule.rule.id, stage]);

  // Mouse pan/zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(Math.max(z * delta, 0.4), 2.5));
  };

  const handleFit = () => {
    setZoom(1);
    setPan({ x: 60, y: 70 });
  };

  // Node position lookup
  const nodeMap = useMemo(() => {
    const map = new Map<number, NodeLayout>();
    for (const n of currentNodes) map.set(n.id, n);
    return map;
  }, [currentNodes]);

  return (
    <div className="h-full flex flex-col bg-board-raised border border-track panel-interlocking select-none relative overflow-hidden">
      {/* Center Top: Stage Switcher + Odometer Strip */}
      <div className="h-10 px-3 border-b border-track flex items-center justify-between bg-board">
        {/* Stage Tabs */}
        <div className="flex items-center space-x-1">
          {(["REGEX", "NFA", "DFA", "MIN-DFA"] as AutomataStage[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setStage(tab)}
              className={`px-2.5 py-1 text-xs font-mono tracking-wider transition-colors border ${
                stage === tab
                  ? "bg-track text-paper border-track-dim font-bold shadow-inner"
                  : "bg-transparent text-paper-dim border-transparent hover:text-paper hover:bg-board-raised"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* State Reduction Odometer Counter Strip */}
        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="text-paper-dim text-[11px]">MACHINE:</span>
          <div className="flex items-center space-x-1 bg-board-raised px-2 py-0.5 border border-track text-[11px]">
            <span className={stage === "NFA" ? "text-lamp-amber font-bold" : "text-paper-dim"}>
              NFA {nfaCount}
            </span>
            <span className="text-track">→</span>
            <span className={stage === "DFA" ? "text-lamp-amber font-bold" : "text-paper-dim"}>
              DFA {dfaCount}
            </span>
            <span className="text-track">→</span>
            <span className={stage === "MIN-DFA" ? "text-lamp-green font-bold" : "text-paper-dim"}>
              MIN {minCount}
            </span>
          </div>

          {/* Construction / Merges drawer openers */}
          {stage === "DFA" && onOpenConstruction && (
            <button
              onClick={onOpenConstruction}
              className="text-[10px] px-2 py-0.5 border border-track text-paper hover:bg-track"
              title="View subset construction steps"
            >
              Show construction
            </button>
          )}
          {stage === "MIN-DFA" && onOpenMerges && (
            <button
              onClick={onOpenMerges}
              className="text-[10px] px-2 py-0.5 border border-track text-paper hover:bg-track"
              title="View partition refinement history"
            >
              Show merges
            </button>
          )}
        </div>
      </div>

      {/* Regex Syntax View (when REGEX tab selected) */}
      {stage === "REGEX" ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="plaque-title text-lamp-amber text-sm">SOURCE REGULAR EXPRESSION</div>
          <div className="bg-board px-4 py-2 border border-track font-mono text-base text-paper select-all">
            /{compiledRule.rule.pattern}/
          </div>
          <div className="text-xs text-paper-dim max-w-md leading-relaxed">
            {compiledRule.rule.explain}
          </div>
          <div className="text-[11px] font-mono text-paper-dim border border-track-dim/50 p-2 bg-board/50">
            AST Type: {compiledRule.ast.type} | ID: {compiledRule.ast.id}
          </div>
        </div>
      ) : (
        /* SVG Track Diagram */
        <div
          className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Pan / Zoom Control Overlay */}
          <div className="absolute bottom-3 left-3 z-10 flex items-center space-x-1 bg-board/90 p-1 border border-track text-xs">
            <button
              onClick={() => setZoom((z) => Math.min(z * 1.2, 2.5))}
              className="w-6 h-6 border border-track flex items-center justify-center text-paper hover:bg-track"
              title="Zoom in"
            >
              +
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z / 1.2, 0.4))}
              className="w-6 h-6 border border-track flex items-center justify-center text-paper hover:bg-track"
              title="Zoom out"
            >
              -
            </button>
            <button
              onClick={handleFit}
              className="px-2 h-6 border border-track flex items-center justify-center text-[10px] text-paper hover:bg-track font-mono"
              title="Fit diagram"
            >
              FIT
            </button>
            <button
              onClick={() => setShowTrapState(!showTrapState)}
              className={`px-2 h-6 border border-track text-[10px] font-mono transition-colors ${
                showTrapState ? "bg-track text-paper font-bold" : "text-paper-dim hover:bg-track"
              }`}
              title="Toggle dead/trap state"
            >
              TRAP
            </button>
          </div>

          {/* Floating Tag for Selected DFA State */}
          {selectedNode && selectedNode.nfaStates && selectedNode.nfaStates.length > 0 && (
            <div
              className="absolute z-20 bg-board border border-lamp-amber px-2.5 py-1 text-xs font-mono shadow-lg text-paper"
              style={{
                left: Math.max(10, selectedNode.x * zoom + pan.x - 40),
                top: Math.max(10, selectedNode.y * zoom + pan.y - 45),
              }}
            >
              <span className="text-lamp-amber font-bold">q{selectedNode.id}</span> = &#123;{" "}
              {selectedNode.nfaStates.map((s) => `q${s}`).join(", ")} &#125;
            </div>
          )}

          {/* Accessible Text Alternative (Visually Hidden) */}
          <table className="sr-only">
            <caption>Automaton states and transitions for {compiledRule.rule.id}</caption>
            <thead>
              <tr>
                <th>State</th>
                <th>Type</th>
                <th>Transitions</th>
              </tr>
            </thead>
            <tbody>
              {currentNodes.map((n) => (
                <tr key={n.id}>
                  <td>q{n.id}</td>
                  <td>{n.isAccept ? "Accepting" : n.isStart ? "Start" : "Normal"}</td>
                  <td>
                    {currentEdges
                      .filter((e) => e.from === n.id)
                      .map((e) => `on ${e.label} -> q${e.to}`)
                      .join("; ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* SVG Canvas */}
          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ backgroundColor: "transparent" }}
          >
            <defs>
              {/* Arrow markers for rails */}
              <marker
                id="rail-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#2F4A41" />
              </marker>

              <marker
                id="rail-arrow-active"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#FFB000" />
              </marker>
            </defs>

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Rails (Transitions) */}
              {currentEdges.map((e, idx) => {
                const fromNode = nodeMap.get(e.from);
                const toNode = nodeMap.get(e.to);
                if (!fromNode || !toNode) return null;

                const isActiveTransition =
                  previousStateId === e.from && activeStateId === e.to;

                if (e.isSelfLoop) {
                  // Arc above lamp
                  const r = 22;
                  const loopPath = `M ${fromNode.x - 10} ${fromNode.y - r} C ${fromNode.x - 30} ${
                    fromNode.y - 65
                  }, ${fromNode.x + 30} ${fromNode.y - 65}, ${fromNode.x + 10} ${fromNode.y - r}`;

                  return (
                    <g key={`loop-${idx}`}>
                      <path
                        d={loopPath}
                        fill="none"
                        stroke={isActiveTransition ? "#FFB000" : "#2F4A41"}
                        strokeWidth={isActiveTransition ? "2.5" : "1.5"}
                        strokeDasharray={e.isEpsilon ? "3 3" : undefined}
                      />
                      {/* Midpoint plate */}
                      <rect
                        x={fromNode.x - 14}
                        y={fromNode.y - 68}
                        width="28"
                        height="14"
                        fill="#14231F"
                        stroke={isActiveTransition ? "#FFB000" : "#2F4A41"}
                        strokeWidth="1"
                        rx="1"
                      />
                      <text
                        x={fromNode.x}
                        y={fromNode.y - 58}
                        textAnchor="middle"
                        fill="#E9E4D2"
                        fontSize="9"
                        fontFamily="IBM Plex Mono"
                        pointerEvents="none"
                      >
                        {e.label}
                      </text>
                    </g>
                  );
                }

                // Regular straight or curved rail between two states
                const dx = toNode.x - fromNode.x;
                const dy = toNode.y - fromNode.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist === 0) return null;

                const nodeRadius = 22;
                const startX = fromNode.x + (dx * nodeRadius) / dist;
                const startY = fromNode.y + (dy * nodeRadius) / dist;
                const endX = toNode.x - (dx * (nodeRadius + 4)) / dist;
                const endY = toNode.y - (dy * (nodeRadius + 4)) / dist;

                // Midpoint for label plate
                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;
                const plateWidth = Math.max(22, e.label.length * 7 + 8);

                return (
                  <g key={`rail-${idx}`}>
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke={isActiveTransition ? "#FFB000" : "#2F4A41"}
                      strokeWidth={isActiveTransition ? "2.5" : "1.5"}
                      strokeDasharray={e.isEpsilon ? "4 3" : undefined}
                      markerEnd={isActiveTransition ? "url(#rail-arrow-active)" : "url(#rail-arrow)"}
                    />

                    {/* Rectangular Plate */}
                    <rect
                      x={midX - plateWidth / 2}
                      y={midY - 7}
                      width={plateWidth}
                      height="14"
                      fill="#14231F"
                      stroke={isActiveTransition ? "#FFB000" : "#2F4A41"}
                      strokeWidth="1"
                      rx="1"
                    />
                    <text
                      x={midX}
                      y={midY + 3}
                      textAnchor="middle"
                      fill="#E9E4D2"
                      fontSize="9"
                      fontFamily="IBM Plex Mono"
                      pointerEvents="none"
                    >
                      {e.label}
                    </text>
                  </g>
                );
              })}

              {/* States: Signal Lamps */}
              {currentNodes.map((node) => {
                const isActive = activeStateId === node.id;
                const isSelected = selectedNode?.id === node.id;

                // Lamp color determination:
                // If active and accept -> lamp-green
                // If active and normal -> lamp-amber
                // If inactive -> dark lens
                let lampFill = "#11201B";
                let lampGlow = "none";
                let lampBorder = "#2F4A41";

                if (isActive) {
                  if (node.isAccept) {
                    lampFill = "#7DF0B0";
                    lampGlow = "0 0 16px #7DF0B0";
                    lampBorder = "#7DF0B0";
                  } else {
                    lampFill = "#FFB000";
                    lampGlow = "0 0 12px #FFB000";
                    lampBorder = "#FFB000";
                  }
                } else if (node.isAccept) {
                  lampBorder = "#4B7C6C";
                }

                return (
                  <g
                    key={`node-${node.id}`}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => setSelectedNode(node)}
                    className="cursor-pointer"
                  >
                    {/* Inbound stub arrow for start state */}
                    {node.isStart && (
                      <g>
                        <line
                          x1="-40"
                          y1="0"
                          x2="-24"
                          y2="0"
                          stroke="#2F4A41"
                          strokeWidth="2"
                          markerEnd="url(#rail-arrow)"
                        />
                      </g>
                    )}

                    {/* Outer Ring */}
                    <circle
                      r="20"
                      fill="#14231F"
                      stroke={isSelected ? "#FFB000" : lampBorder}
                      strokeWidth={isSelected ? "2" : "1.5"}
                    />

                    {/* Double ring for accepting states */}
                    {node.isAccept && (
                      <circle
                        r="16"
                        fill="none"
                        stroke={lampBorder}
                        strokeWidth="1.2"
                      />
                    )}

                    {/* Inner Signal Lamp Lens */}
                    <circle
                      r={node.isAccept ? "11" : "12"}
                      fill={lampFill}
                      stroke={lampBorder}
                      strokeWidth="1"
                      style={{ filter: isActive ? `drop-shadow(${lampGlow})` : "none" }}
                    />

                    {/* State label text */}
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill={isActive ? "#0E1916" : "#E9E4D2"}
                      fontSize="10"
                      fontFamily="IBM Plex Mono"
                      fontWeight={isActive ? "bold" : "normal"}
                      pointerEvents="none"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}
    </div>
  );
};
