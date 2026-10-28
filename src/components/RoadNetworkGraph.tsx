import React from 'react';
import {
  ALL_NODES,
  DijkstraResult,
  DistressRequest,
  RoadEdge,
  ZoneId,
} from '../dsa/algorithms';
import { AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';

export type GraphViewMode = 'compact' | 'full';

interface RoadNetworkGraphProps {
  roads: RoadEdge[];
  reachableNodes: ZoneId[];
  activeRoute: DijkstraResult;
  selectedZone: Exclude<ZoneId, 'Depot'>;
  pendingRequests: DistressRequest[];
  viewMode: GraphViewMode;
  hopLevels?: Record<string, number>;
  onViewModeChange: (mode: GraphViewMode) => void;
  onSelectZone: (zone: Exclude<ZoneId, 'Depot'>) => void;
  onToggleRoad: (edgeId: string) => void;
}

const COMPACT_COORDINATES: Record<ZoneId, { x: number; y: number; label: string }> = {
  Depot: { x: 95, y: 210, label: 'Relief Depot' },
  A: { x: 255, y: 105, label: 'Zone A' },
  B: { x: 255, y: 315, label: 'Zone B' },
  C: { x: 435, y: 155, label: 'Zone C' },
  D: { x: 455, y: 315, label: 'Zone D' },
  E: { x: 625, y: 215, label: 'Zone E' },
  F: { x: 755, y: 115, label: 'Zone F' },
  G: { x: 755, y: 315, label: 'Zone G' },
};

const FULL_COORDINATES: Record<ZoneId, { x: number; y: number; label: string }> = {
  Depot: { x: 115, y: 260, label: 'Relief Depot' },
  A: { x: 330, y: 120, label: 'Zone A' },
  B: { x: 330, y: 400, label: 'Zone B' },
  C: { x: 575, y: 185, label: 'Zone C' },
  D: { x: 600, y: 400, label: 'Zone D' },
  E: { x: 825, y: 265, label: 'Zone E' },
  F: { x: 985, y: 135, label: 'Zone F' },
  G: { x: 985, y: 395, label: 'Zone G' },
};

export const RoadNetworkGraph: React.FC<RoadNetworkGraphProps> = ({
  roads,
  reachableNodes,
  activeRoute,
  selectedZone,
  pendingRequests,
  viewMode,
  hopLevels = {},
  onViewModeChange,
  onSelectZone,
  onToggleRoad,
}) => {
  const isFull = viewMode === 'full';
  const coords = isFull ? FULL_COORDINATES : COMPACT_COORDINATES;
  const viewBoxWidth = isFull ? 1100 : 850;
  const viewBoxHeight = isFull ? 520 : 420;

  // Determine if an edge is part of the active Dijkstra shortest path
  const isEdgeInActivePath = (edge: RoadEdge): boolean => {
    if (!activeRoute.reachable || activeRoute.path.length < 2) return false;
    for (let i = 0; i < activeRoute.path.length - 1; i++) {
      const u = activeRoute.path[i];
      const v = activeRoute.path[i + 1];
      if (
        (edge.from === u && edge.to === v) ||
        (edge.from === v && edge.to === u)
      ) {
        return true;
      }
    }
    return false;
  };

  // Find highest severity pending request per zone
  const getZoneSeverity = (zone: ZoneId): number | null => {
    if (zone === 'Depot') return null;
    const reqs = pendingRequests.filter(
      (r) => r.zone === zone && r.status === 'Pending'
    );
    if (reqs.length === 0) return null;
    return Math.max(...reqs.map((r) => r.severity));
  };

  // Position relief vehicle along the last segment of active path or at Depot
  const getVehiclePosition = () => {
    if (!activeRoute.reachable || activeRoute.path.length < 2) {
      return { x: coords.Depot.x, y: coords.Depot.y - (isFull ? 44 : 38) };
    }
    const targetCoord = coords[activeRoute.target];
    return { x: targetCoord.x, y: targetCoord.y - (isFull ? 46 : 40) };
  };

  const vehiclePos = getVehiclePosition();

  return (
    <div className="flex flex-col h-full">
      <div className="relative w-full bg-[#0F172A] rounded-xl border border-slate-800 overflow-hidden">
        {/* Top instruction & View Mode bar inside map */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-300">
          <span>
            Click any <strong>Zone Node (A–G)</strong> to compute Dijkstra route · Click any{' '}
            <strong>Road Segment</strong> to block or unblock
          </span>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-teal-400">
                V = {ALL_NODES.length} vertices
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-orange-400">
                E = {roads.filter((r) => !r.blocked).length}/{roads.length} active edges
              </span>
            </div>

            {/* Segmented Toggle for Compact vs Full View */}
            <div
              className="flex items-center gap-1 p-0.5 bg-slate-800 rounded-lg border border-slate-700"
              role="group"
              aria-label="SVG Network Graph View Mode"
            >
              <button
                type="button"
                onClick={() => onViewModeChange('compact')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  !isFull
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Minimize2 className="w-3 h-3" />
                Compact
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('full')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  isFull
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Maximize2 className="w-3 h-3" />
                Full
              </button>
            </div>
          </div>
        </div>

        {/* Interactive SVG Canvas */}
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className={`w-full select-none transition-all duration-150 ${
            isFull ? 'h-[460px] sm:h-[520px]' : 'h-[350px] sm:h-[390px]'
          }`}
          role="img"
          aria-label="Disaster Relief Road Network Graph"
        >
          <defs>
            <pattern
              id="map-grid"
              width="30"
              height="30"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 30 0 L 0 0 0 30"
                fill="none"
                stroke="#1E293B"
                strokeWidth="0.75"
              />
            </pattern>
          </defs>

          {/* Subtle blueprint coordinate grid */}
          <rect width={viewBoxWidth} height={viewBoxHeight} fill="url(#map-grid)" />

          {/* Disconnected Component Boundary Box for F-G */}
          <rect
            x={isFull ? 910 : 695}
            y={isFull ? 55 : 50}
            width={isFull ? 150 : 125}
            height={isFull ? 415 : 325}
            rx="10"
            fill="#1E293B"
            fillOpacity="0.35"
            stroke="#475569"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
          <text
            x={isFull ? 985 : 757}
            y={isFull ? 80 : 72}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] font-mono tracking-wider"
          >
            ISOLATED SECTOR
          </text>

          {/* Render Road Edges */}
          {roads.map((edge) => {
            const p1 = coords[edge.from];
            const p2 = coords[edge.to];
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const inPath = isEdgeInActivePath(edge);

            // Slight label offset for B-C and C-D so labels never overlap
            let offsetX = 0;
            let offsetY = 0;
            if (edge.id === 'B-C') {
              offsetX = -18;
              offsetY = 12;
            } else if (edge.id === 'C-D') {
              offsetX = 20;
              offsetY = 0;
            }

            return (
              <g
                key={edge.id}
                onClick={() => onToggleRoad(edge.id)}
                className="cursor-pointer group"
              >
                {/* Invisible wider hit target for easy clicking */}
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="transparent"
                  strokeWidth="22"
                />

                {/* Outer glow if on active shortest path */}
                {inPath && !edge.blocked && (
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="#F97316"
                    strokeWidth="9"
                    strokeOpacity="0.25"
                    strokeLinecap="round"
                  />
                )}

                {/* Visible road line */}
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={
                    edge.blocked
                      ? '#EF4444'
                      : inPath
                      ? '#F97316'
                      : '#64748B'
                  }
                  strokeWidth={inPath ? '4.5' : edge.blocked ? '3' : '2.5'}
                  strokeDasharray={edge.blocked ? '7 6' : undefined}
                  className="transition-colors duration-150 group-hover:stroke-teal-400"
                />

                {/* Distance & Block badge on edge midpoint */}
                <g transform={`translate(${midX + offsetX}, ${midY + offsetY})`}>
                  <rect
                    x={isFull ? '-34' : '-28'}
                    y="-12"
                    width={isFull ? '68' : '56'}
                    height="24"
                    rx="5"
                    fill={
                      edge.blocked
                        ? '#450A0A'
                        : inPath
                        ? '#9A3412'
                        : '#0F172A'
                    }
                    stroke={
                      edge.blocked
                        ? '#EF4444'
                        : inPath
                        ? '#F97316'
                        : '#334155'
                    }
                    strokeWidth="1.5"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    className={`text-[11px] font-mono font-semibold ${
                      edge.blocked
                        ? 'fill-red-300'
                        : inPath
                        ? 'fill-orange-100'
                        : 'fill-slate-200'
                    }`}
                  >
                    {edge.blocked
                      ? 'BLOCKED'
                      : isFull
                      ? `${edge.id}: ${edge.distance}km`
                      : `${edge.distance} km`}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Render Graph Nodes (Depot + Zones A..G) */}
          {ALL_NODES.map((nodeId) => {
            const coord = coords[nodeId];
            const isDepot = nodeId === 'Depot';
            const isReachable = reachableNodes.includes(nodeId);
            const isSelected = nodeId === selectedZone;
            const isInPath = activeRoute.path.includes(nodeId);
            const maxSeverity = getZoneSeverity(nodeId);
            const distFromDepot = activeRoute.distancesFromDepot[nodeId];
            const bfsHop = hopLevels[nodeId];

            // Node fill & border colors based on semantic state
            let fill = '#1E293B';
            let stroke = '#14B8A6'; // Teal for reachable

            if (isDepot) {
              fill = '#0D9488';
              stroke = '#5EEAD4';
            } else if (!isReachable) {
              fill = '#334155';
              stroke = '#EF4444'; // Unreachable
            } else if (isSelected) {
              fill = '#EA580C';
              stroke = '#FDBA74';
            } else if (isInPath) {
              fill = '#0F766E';
              stroke = '#F97316';
            }

            const radius = isDepot ? (isFull ? 32 : 28) : isFull ? 28 : 24;

            return (
              <g
                key={nodeId}
                transform={`translate(${coord.x}, ${coord.y})`}
                onClick={() => {
                  if (nodeId !== 'Depot') {
                    onSelectZone(nodeId);
                  }
                }}
                className={nodeId === 'Depot' ? 'cursor-default' : 'cursor-pointer'}
              >
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    r={radius + 9}
                    fill="none"
                    stroke="#F97316"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                )}

                {/* Main node circle */}
                <circle
                  r={radius}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth="3"
                />

                {/* Node ID inside circle */}
                <text
                  x="0"
                  y="5"
                  textAnchor="middle"
                  className="fill-white font-mono text-sm font-bold"
                >
                  {isDepot ? 'DEPOT' : nodeId}
                </text>

                {/* Zone label below circle */}
                <text
                  x="0"
                  y={radius + 16}
                  textAnchor="middle"
                  className="fill-slate-300 text-[11px] font-medium"
                >
                  {isDepot
                    ? 'Base Hub (0 km)'
                    : isReachable
                    ? `Zone ${nodeId}`
                    : `Zone ${nodeId} (Isolated)`}
                </text>

                {/* Extra telemetry in Full View: Dijkstra distance & BFS hop level */}
                {isFull && (
                  <text
                    x="0"
                    y={radius + 31}
                    textAnchor="middle"
                    className="fill-teal-400 font-mono text-[10px]"
                  >
                    {isDepot
                      ? 'BFS Hop: 0'
                      : isReachable && distFromDepot !== undefined && distFromDepot < Infinity
                      ? `d=${distFromDepot}km · Hop=${bfsHop ?? '—'}`
                      : 'd=∞ (Unreachable)'}
                  </text>
                )}

                {/* Pending distress severity indicator */}
                {maxSeverity !== null && (
                  <g transform={`translate(${radius - 4}, ${-radius + 2})`}>
                    <rect
                      x="-18"
                      y="-10"
                      width="38"
                      height="18"
                      rx="4"
                      fill={maxSeverity >= 8 ? '#DC2626' : '#D97706'}
                      stroke="#0F172A"
                      strokeWidth="1.5"
                    />
                    <text
                      x="1"
                      y="3"
                      textAnchor="middle"
                      className="fill-white font-mono text-[10px] font-bold"
                    >
                      S:{maxSeverity}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Relief Vehicle Marker */}
          <g transform={`translate(${vehiclePos.x}, ${vehiclePos.y})`}>
            <rect
              x="-44"
              y="-14"
              width="88"
              height="22"
              rx="4"
              fill="#F97316"
              stroke="#FFF7ED"
              strokeWidth="1.5"
            />
            <text
              x="0"
              y="1"
              textAnchor="middle"
              className="fill-white font-mono text-[10px] font-bold"
            >
              {activeRoute.reachable
                ? `UNIT → ${activeRoute.target}`
                : 'UNIT @ DEPOT'}
            </text>
          </g>
        </svg>

        {/* Bottom Legend & Active Route Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-teal-600 border border-teal-300" />
              Depot / Reachable
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-orange-600 border border-orange-300" />
              Active Route ({selectedZone})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-slate-700 border border-red-500" />
              Unreachable (F, G)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-red-500 border-b border-dashed border-red-400" />
              Blocked Road
            </span>
          </div>

          <div className="font-mono text-xs">
            {activeRoute.reachable ? (
              <span className="text-teal-300 font-semibold">
                Shortest Route: {activeRoute.path.join(' → ')} ({activeRoute.distance} km)
              </span>
            ) : (
              <span className="text-red-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Zone {selectedZone} unreachable from Depot
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
