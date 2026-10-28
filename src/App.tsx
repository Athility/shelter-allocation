/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ALL_NODES,
  ALL_ZONES,
  DistressMaxHeap,
  DistressRequest,
  INITIAL_DISTRESS_CALLS,
  INITIAL_ROADS,
  INITIAL_SUPPLIES,
  INITIAL_VEHICLE_CAPACITY,
  RoadEdge,
  SupplyItem,
  ZoneId,
  buildAdjacencyList,
  runBFSReachability,
  runDijkstra,
  runKnapsack01DP,
  runKnapsackGreedy,
} from './dsa/algorithms';
import { RoadNetworkGraph, GraphViewMode } from './components/RoadNetworkGraph';
import {
  Play,
  RotateCcw,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Route,
  Network,
  Package,
  Scale,
  BookOpen,
  Terminal,
  ArrowRight,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  tag: 'HEAP' | 'KNAPSACK' | 'DIJKSTRA' | 'BFS' | 'SYSTEM';
  message: string;
}

export default function App() {
  // ==========================================================================
  // APPLICATION STATE (Initialized with documented SAKEC Group 4 project data)
  // ==========================================================================
  const [roads, setRoads] = useState<RoadEdge[]>(() =>
    INITIAL_ROADS.map((r) => ({ ...r }))
  );
  const [distressCalls, setDistressCalls] = useState<DistressRequest[]>(() =>
    INITIAL_DISTRESS_CALLS.map((d) => ({ ...d }))
  );
  const [supplies, setSupplies] = useState<SupplyItem[]>(() =>
    INITIAL_SUPPLIES.map((s) => ({ ...s }))
  );
  const [vehicleCapacity, setVehicleCapacity] = useState<number>(
    INITIAL_VEHICLE_CAPACITY
  );
  const [selectedZone, setSelectedZone] =
    useState<Exclude<ZoneId, 'Depot'>>('E');
  const [insertionCounter, setInsertionCounter] = useState<number>(
    INITIAL_DISTRESS_CALLS.length + 1
  );

  // Form states for adding a new Distress Call
  const [newCallZone, setNewCallZone] = useState<Exclude<ZoneId, 'Depot'>>('D');
  const [newCallSeverity, setNewCallSeverity] = useState<number>(9);
  const [newCallNeed, setNewCallNeed] = useState<string>('Medical');
  const [callFormError, setCallFormError] = useState<string>('');

  // Form states for adding a new Supply Item
  const [newSupplyName, setNewSupplyName] = useState<string>('');
  const [newSupplyWeight, setNewSupplyWeight] = useState<string>('15');
  const [newSupplyUtility, setNewSupplyUtility] = useState<string>('70');
  const [supplyFormError, setSupplyFormError] = useState<string>('');

  // View toggle for DP Table, Adjacency List, and Network Graph View Mode ('compact' | 'full')
  const [showDPMatrix, setShowDPMatrix] = useState<boolean>(false);
  const [showAdjList, setShowAdjList] = useState<boolean>(false);
  const [graphViewMode, setGraphViewMode] = useState<GraphViewMode>('compact');

  // Initial computation log generated from the documented dataset
  const [eventLog, setEventLog] = useState<LogEntry[]>(() => [
    {
      id: 'init-1',
      timestamp: '00:00.1',
      tag: 'SYSTEM',
      message:
        'SAKEC AI & DS Group 4 simulation initialized (V=8, E=10, n=4, W=50).',
    },
    {
      id: 'init-2',
      timestamp: '00:00.2',
      tag: 'HEAP',
      message: 'Priority queue: Zone E selected, severity 10.',
    },
    {
      id: 'init-3',
      timestamp: '00:00.3',
      tag: 'KNAPSACK',
      message: 'Knapsack: optimal utility 220, weight 50.',
    },
    {
      id: 'init-4',
      timestamp: '00:00.4',
      tag: 'DIJKSTRA',
      message: 'Dijkstra: shortest route to E is 13 km.',
    },
    {
      id: 'init-5',
      timestamp: '00:00.5',
      tag: 'BFS',
      message: 'BFS: zones A, B, C, D and E are reachable.',
    },
  ]);

  const appendLog = (
    tag: LogEntry['tag'],
    message: string
  ) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setEventLog((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: timeStr,
        tag,
        message,
      },
      ...prev.slice(0, 29),
    ]);
  };

  // ==========================================================================
  // LIVE DSA COMPUTATIONS (Reactive on every state change)
  // ==========================================================================

  // 1. Max Heap / Priority Queue for Pending Requests
  const { pendingHeap, orderedPendingCalls, rawHeapNodes } = useMemo(() => {
    const pending = distressCalls.filter((c) => c.status === 'Pending');
    const heap = new DistressMaxHeap(pending);
    return {
      pendingHeap: heap,
      orderedPendingCalls: heap.getPriorityOrderedList(),
      rawHeapNodes: heap.getRawHeapArray(),
    };
  }, [distressCalls]);

  // Highest-priority pending request (or most recently dispatched if queue empty)
  const topPriorityRequest = useMemo(() => {
    if (orderedPendingCalls.length > 0) {
      return orderedPendingCalls[0];
    }
    return distressCalls[0] || null;
  }, [orderedPendingCalls, distressCalls]);

  // 2. Adjacency List Representation
  const adjacencyList = useMemo(() => buildAdjacencyList(roads), [roads]);

  // 3. BFS Reachability from Depot
  const bfsResult = useMemo(() => runBFSReachability(roads, 'Depot'), [roads]);

  // 4. Dijkstra Shortest Path from Depot to Selected Zone
  const activeRoute = useMemo(
    () => runDijkstra(roads, 'Depot', selectedZone),
    [roads, selectedZone]
  );

  // Also precompute Dijkstra distances to all zones for table display
  const allZoneRoutes = useMemo(() => {
    const map: Record<string, ReturnType<typeof runDijkstra>> = {};
    for (const z of ALL_ZONES) {
      map[z] = runDijkstra(roads, 'Depot', z);
    }
    return map;
  }, [roads]);

  // 5. 0/1 Knapsack DP & Greedy Comparison
  const dpResult = useMemo(
    () => runKnapsack01DP(supplies, vehicleCapacity),
    [supplies, vehicleCapacity]
  );

  const greedyResult = useMemo(
    () => runKnapsackGreedy(supplies, vehicleCapacity),
    [supplies, vehicleCapacity]
  );

  // Dashboard summary metrics
  const pendingCount = orderedPendingCalls.length;
  const criticalCount = orderedPendingCalls.filter(
    (c) => c.severity >= 8
  ).length;
  const blockedRoadCount = roads.filter((r) => r.blocked).length;

  // ==========================================================================
  // INTERACTIVE ACTION HANDLERS
  // ==========================================================================

  // Block or Unblock a Road Edge
  const handleToggleRoad = (edgeId: string) => {
    const targetEdge = roads.find((r) => r.id === edgeId);
    if (!targetEdge) return;

    const nextBlocked = !targetEdge.blocked;
    const updatedRoads = roads.map((r) =>
      r.id === edgeId ? { ...r, blocked: nextBlocked } : r
    );
    setRoads(updatedRoads);

    // Compute updated BFS and Dijkstra immediately for accurate log messages
    const nextBfs = runBFSReachability(updatedRoads, 'Depot');
    const nextDijkstra = runDijkstra(updatedRoads, 'Depot', selectedZone);

    appendLog(
      'SYSTEM',
      `Road ${edgeId} (${targetEdge.distance} km) ${
        nextBlocked ? 'BLOCKED' : 'RESTORED'
      }.`
    );
    appendLog(
      'BFS',
      nextBfs.reachableZones.length > 0
        ? `BFS: zones ${nextBfs.reachableZones.join(', ')} are reachable (${
            nextBfs.unreachableZones.length > 0
              ? `unreachable: ${nextBfs.unreachableZones.join(', ')}`
              : 'all reachable'
          }).`
        : 'BFS: no zones reachable from Depot!'
    );
    appendLog(
      'DIJKSTRA',
      nextDijkstra.reachable
        ? `Dijkstra: shortest route to ${selectedZone} is ${
            nextDijkstra.distance
          } km (${nextDijkstra.path.join(' → ')}).`
        : `Dijkstra: Zone ${selectedZone} unreachable from Depot.`
    );
  };

  // Select a Zone to Calculate Route
  const handleSelectZone = (zone: Exclude<ZoneId, 'Depot'>) => {
    setSelectedZone(zone);
    const route = runDijkstra(roads, 'Depot', zone);
    if (route.reachable) {
      appendLog(
        'DIJKSTRA',
        `Dijkstra: shortest route to ${zone} is ${
          route.distance
        } km (${route.path.join(' → ')}).`
      );
    } else {
      appendLog('DIJKSTRA', `Dijkstra: Zone ${zone} unreachable.`);
    }
  };

  // Add a New Distress Call to the Max Heap
  const handleAddDistressCall = (e: React.FormEvent) => {
    e.preventDefault();
    setCallFormError('');

    if (
      Number.isNaN(newCallSeverity) ||
      newCallSeverity < 1 ||
      newCallSeverity > 10
    ) {
      setCallFormError('Severity must be an integer between 1 and 10.');
      return;
    }

    const newCall: DistressRequest = {
      id: `REQ-${100 + insertionCounter}`,
      zone: newCallZone,
      severity: Math.round(newCallSeverity),
      need: newCallNeed.trim() || 'Medical',
      insertionOrder: insertionCounter,
      status: 'Pending',
    };

    const nextCalls = [...distressCalls, newCall];
    setDistressCalls(nextCalls);
    setInsertionCounter((prev) => prev + 1);
    setSelectedZone(newCall.zone);

    const updatedPending = nextCalls.filter((c) => c.status === 'Pending');
    const heap = new DistressMaxHeap(updatedPending);
    const top = heap.peek();

    appendLog(
      'HEAP',
      `Inserted ${newCall.id} (Zone ${newCall.zone}, severity ${
        newCall.severity
      }, need ${newCall.need}). Heap root is now Zone ${top?.zone} (severity ${
        top?.severity
      }).`
    );
  };

  // Run Dispatch Pipeline (Extracts Max from Heap, packs supplies via DP, routes via Dijkstra)
  const handleDispatchNext = () => {
    if (orderedPendingCalls.length === 0) {
      appendLog('HEAP', 'Priority queue is empty — no pending distress calls to dispatch.');
      return;
    }

    const nextRequest = orderedPendingCalls[0];
    setSelectedZone(nextRequest.zone);

    const routeResult = runDijkstra(roads, 'Depot', nextRequest.zone);
    const knapsack = runKnapsack01DP(supplies, vehicleCapacity);

    appendLog(
      'HEAP',
      `Priority queue: Zone ${nextRequest.zone} selected, severity ${nextRequest.severity}.`
    );
    appendLog(
      'KNAPSACK',
      `Knapsack: optimal utility ${knapsack.totalUtility}, weight ${
        knapsack.totalWeight
      } (${knapsack.selectedItems.map((i) => i.name).join(' + ') || 'None'}).`
    );

    if (routeResult.reachable) {
      appendLog(
        'DIJKSTRA',
        `Dijkstra: shortest route to ${nextRequest.zone} is ${routeResult.distance} km (${routeResult.path.join(' → ')}).`
      );
      setDistressCalls((prev) =>
        prev.map((c) =>
          c.id === nextRequest.id
            ? {
                ...c,
                status: 'Dispatched',
                dispatchedRoute: routeResult.path,
                dispatchedDistance: routeResult.distance,
                dispatchedSupplies: knapsack.selectedItems.map((i) => i.name),
                dispatchedUtility: knapsack.totalUtility,
              }
            : c
        )
      );
    } else {
      appendLog(
        'DIJKSTRA',
        `Dijkstra: Zone ${nextRequest.zone} unreachable — dispatch halted.`
      );
      setDistressCalls((prev) =>
        prev.map((c) =>
          c.id === nextRequest.id
            ? {
                ...c,
                status: 'Unreachable',
                dispatchedRoute: [],
                dispatchedDistance: null,
              }
            : c
        )
      );
    }
  };

  // Add a Supply Item
  const handleAddSupply = (e: React.FormEvent) => {
    e.preventDefault();
    setSupplyFormError('');

    const trimmedName = newSupplyName.trim();
    const weightNum = Number(newSupplyWeight);
    const utilityNum = Number(newSupplyUtility);

    if (!trimmedName) {
      setSupplyFormError('Please enter a supply item name.');
      return;
    }
    if (Number.isNaN(weightNum) || weightNum <= 0 || weightNum > 200) {
      setSupplyFormError('Weight must be between 1 and 200 kg.');
      return;
    }
    if (Number.isNaN(utilityNum) || utilityNum <= 0 || utilityNum > 1000) {
      setSupplyFormError('Utility must be between 1 and 1000.');
      return;
    }

    const newItem: SupplyItem = {
      id: `SUP-${Date.now().toString().slice(-4)}`,
      name: trimmedName,
      weight: Math.round(weightNum),
      utility: Math.round(utilityNum),
    };

    const nextSupplies = [...supplies, newItem];
    setSupplies(nextSupplies);
    setNewSupplyName('');

    const nextDp = runKnapsack01DP(nextSupplies, vehicleCapacity);
    appendLog(
      'KNAPSACK',
      `Added supply "${newItem.name}" (w:${newItem.weight}, u:${newItem.utility}). Knapsack: optimal utility ${nextDp.totalUtility}, weight ${nextDp.totalWeight}.`
    );
  };

  // Remove a Supply Item
  const handleRemoveSupply = (id: string) => {
    const target = supplies.find((s) => s.id === id);
    const nextSupplies = supplies.filter((s) => s.id !== id);
    setSupplies(nextSupplies);

    const nextDp = runKnapsack01DP(nextSupplies, vehicleCapacity);
    appendLog(
      'KNAPSACK',
      `Removed "${target?.name || id}". Knapsack: optimal utility ${
        nextDp.totalUtility
      }, weight ${nextDp.totalWeight}.`
    );
  };

  // Change Vehicle Capacity
  const handleCapacityChange = (newCap: number) => {
    const clamped = Math.max(5, Math.min(150, Math.round(newCap || 0)));
    setVehicleCapacity(clamped);
    const nextDp = runKnapsack01DP(supplies, clamped);
    appendLog(
      'KNAPSACK',
      `Vehicle capacity set to ${clamped} kg. Knapsack: optimal utility ${nextDp.totalUtility}, weight ${nextDp.totalWeight}.`
    );
  };

  // Run Explicit BFS Check
  const handleRunBFS = () => {
    const bfs = runBFSReachability(roads, 'Depot');
    const rList = bfs.reachableZones;
    const formattedZones =
      rList.length > 1
        ? `${rList.slice(0, -1).join(', ')} and ${rList[rList.length - 1]}`
        : rList.join(', ');
    appendLog(
      'BFS',
      `BFS: zones ${formattedZones || 'none'} are reachable. Unreachable: ${
        bfs.unreachableZones.join(', ') || 'none'
      }.`
    );
  };

  // Compare DP vs Greedy Explicitly in Event Log
  const handleCompareDPAndGreedy = () => {
    const dp = runKnapsack01DP(supplies, vehicleCapacity);
    const greedy = runKnapsackGreedy(supplies, vehicleCapacity);
    const diff = dp.totalUtility - greedy.totalUtility;
    appendLog(
      'KNAPSACK',
      `DP vs Greedy (W=${vehicleCapacity}): DP selects [${dp.selectedItems
        .map((i) => i.name)
        .join(' + ')}] (utility ${dp.totalUtility}, weight ${
        dp.totalWeight
      }) vs Greedy [${greedy.selectedItems
        .map((i) => i.name)
        .join(' + ')}] (utility ${greedy.totalUtility}, weight ${
        greedy.totalWeight
      }) → DP gains +${diff} utility.`
    );
  };

  // Reset Simulation to Initial State
  const handleResetSimulation = () => {
    const freshRoads = INITIAL_ROADS.map((r) => ({ ...r }));
    const freshCalls = INITIAL_DISTRESS_CALLS.map((d) => ({ ...d }));
    const freshSupplies = INITIAL_SUPPLIES.map((s) => ({ ...s }));
    setRoads(freshRoads);
    setDistressCalls(freshCalls);
    setSupplies(freshSupplies);
    setVehicleCapacity(INITIAL_VEHICLE_CAPACITY);
    setSelectedZone('E');
    setInsertionCounter(INITIAL_DISTRESS_CALLS.length + 1);
    setCallFormError('');
    setSupplyFormError('');

    appendLog(
      'SYSTEM',
      'Simulation reset to documented SAKEC Group 4 baseline dataset.'
    );
  };

  // Prominent "Run Full Simulation" Button Handler
  const handleRunFullSimulation = () => {
    // 1. Load & reset documented project scenario
    const freshRoads = INITIAL_ROADS.map((r) => ({ ...r }));
    const freshCalls = INITIAL_DISTRESS_CALLS.map((d) => ({ ...d }));
    const freshSupplies = INITIAL_SUPPLIES.map((s) => ({ ...s }));
    const cap = INITIAL_VEHICLE_CAPACITY;

    // 2. Execute Max-Heap Priority Ordering
    const heap = new DistressMaxHeap(freshCalls);
    const topCall = heap.peek()!;

    // 3. Calculate optimal supply payload via 0/1 Knapsack DP & Greedy
    const dp = runKnapsack01DP(freshSupplies, cap);

    // 4. Compute shortest route to highest-severity zone (Zone E) using Dijkstra
    const dijkstraE = runDijkstra(freshRoads, 'Depot', topCall.zone);

    // 5. Run BFS for reachable zones from Depot
    const bfs = runBFSReachability(freshRoads, 'Depot');
    const rList = bfs.reachableZones;
    const formattedZones =
      rList.length > 1
        ? `${rList.slice(0, -1).join(', ')} and ${rList[rList.length - 1]}`
        : rList.join(', ');

    // Update state with full simulation results
    setRoads(freshRoads);
    setSupplies(freshSupplies);
    setVehicleCapacity(cap);
    setSelectedZone(topCall.zone);
    setInsertionCounter(INITIAL_DISTRESS_CALLS.length + 1);
    setDistressCalls(freshCalls);

    const now = new Date().toTimeString().split(' ')[0];
    setEventLog([
      {
        id: `sim-bfs-${Date.now()}`,
        timestamp: now,
        tag: 'BFS',
        message: `BFS: zones ${formattedZones} are reachable.`,
      },
      {
        id: `sim-dijkstra-${Date.now()}`,
        timestamp: now,
        tag: 'DIJKSTRA',
        message: `Dijkstra: shortest route to ${topCall.zone} is ${dijkstraE.distance} km.`,
      },
      {
        id: `sim-knapsack-${Date.now()}`,
        timestamp: now,
        tag: 'KNAPSACK',
        message: `Knapsack: optimal utility ${dp.totalUtility}, weight ${dp.totalWeight}.`,
      },
      {
        id: `sim-heap-${Date.now()}`,
        timestamp: now,
        tag: 'HEAP',
        message: `Priority queue: Zone ${topCall.zone} selected, severity ${topCall.severity}.`,
      },
      {
        id: `sim-start-${Date.now()}`,
        timestamp: now,
        tag: 'SYSTEM',
        message:
          'Full Simulation executed on SAKEC Group 4 benchmark scenario.',
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-[#0B132B] text-slate-900 flex flex-col">
      {/* ====================================================================
          TOP NAVIGATION BAR (Strict 3-Zone Contract)
         ==================================================================== */}
      <header className="sticky top-0 z-30 bg-[#0B132B]/95 backdrop-blur border-b border-slate-800 px-6 py-3.5">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Brand Title (One Line) */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Disaster Relief Distribution &amp; Shelter Allocator
          </a>

          {/* Zone 2: 4 Concise Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a
              href="#network"
              className="hover:text-orange-400 transition-colors whitespace-nowrap shrink-0"
            >
              Road Network
            </a>
            <a
              href="#distress"
              className="hover:text-orange-400 transition-colors whitespace-nowrap shrink-0"
            >
              Priority Queue
            </a>
            <a
              href="#knapsack"
              className="hover:text-orange-400 transition-colors whitespace-nowrap shrink-0"
            >
              Supply Knapsack
            </a>
            <a
              href="#algorithms"
              className="hover:text-orange-400 transition-colors whitespace-nowrap shrink-0"
            >
              DSA Complexity
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action Button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleRunFullSimulation}
              className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Full Simulation
            </button>
          </div>
        </div>
      </header>

      {/* ====================================================================
          MAIN DASHBOARD CONTAINER
         ==================================================================== */}
      <main
        id="top"
        className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6"
      >
        {/* ==================================================================
            ACADEMIC SUBMISSION HEADER & SIMULATION MODE TOOLBAR
           ================================================================== */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-teal-400">
                <span className="font-bold text-orange-400">
                  SIMULATION MODE
                </span>
                <span aria-hidden="true">·</span>
                <span>DSA Microproject Prototype</span>
                <span aria-hidden="true">·</span>
                <span>Academic Year 2026–27</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Shah &amp; Anchor Kutchhi Engineering College (SAKEC)
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-300">
                <span>Department of Artificial Intelligence &amp; Data Science</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-white">Group 4</span>
                <span aria-hidden="true">·</span>
                <span>
                  Members: <strong className="text-teal-300">Atharva Shinde (02)</strong>,{' '}
                  <strong className="text-teal-300">Riya Navale (34)</strong>,{' '}
                  <strong className="text-teal-300">Jainam Gala (14)</strong>
                </span>
              </div>
            </div>

            {/* Interactive Simulation Controls */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleRunFullSimulation}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                Run Full Simulation
              </button>
              <button
                type="button"
                onClick={handleDispatchNext}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Truck className="w-4 h-4" />
                Dispatch Top Request
              </button>
              <button
                type="button"
                onClick={handleRunBFS}
                className="px-3.5 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Run BFS Check
              </button>
              <button
                type="button"
                onClick={handleResetSimulation}
                className="px-3.5 py-2.5 text-xs font-semibold text-slate-300 bg-slate-800/70 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Scenario
              </button>
            </div>
          </div>
        </section>

        {/* ==================================================================
            4-CARD KPI METRICS STRIP (White Cards on Dark Navy Canvas)
           ================================================================== */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Pending Requests */}
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500">
              Pending Distress Requests
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
                {pendingCount}
              </span>
              <span className="text-xs font-mono text-teal-700 font-medium">
                {topPriorityRequest
                  ? `Next: Zone ${topPriorityRequest.zone} (S:${topPriorityRequest.severity})`
                  : 'Queue Empty'}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Max-Heap root extracted in O(log n)
            </div>
          </div>

          {/* Metric 2: Critical Requests */}
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500">
              Critical Requests (Severity ≥ 8)
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold font-mono tabular-nums text-orange-600">
                {criticalCount}
              </span>
              <span className="text-xs font-mono text-slate-600">
                {orderedPendingCalls
                  .filter((c) => c.severity >= 8)
                  .map((c) => `Zone ${c.zone}`)
                  .join(', ') || 'None pending'}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Prioritized ahead of moderate requests
            </div>
          </div>

          {/* Metric 3: Reachable Zones (BFS) */}
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500">
              Reachable Zones (BFS from Depot)
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold font-mono tabular-nums text-teal-600">
                {bfsResult.reachableZones.length} / {ALL_ZONES.length}
              </span>
              <span className="text-xs font-mono text-slate-600">
                {bfsResult.reachableZones.join(', ') || 'None'}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Unreachable: {bfsResult.unreachableZones.join(', ') || 'None'} · Blocked roads: {blockedRoadCount}
            </div>
          </div>

          {/* Metric 4: Vehicle Capacity */}
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500">
              Relief Vehicle Capacity (W)
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
                {vehicleCapacity} kg
              </span>
              <span className="text-xs font-mono text-orange-600 font-semibold">
                Optimal Utility: {dpResult.totalUtility}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              DP Load: {dpResult.totalWeight}/{vehicleCapacity} kg ({dpResult.selectedItems.length} items)
            </div>
          </div>
        </section>

        {/* ==================================================================
            ROW 1: ROAD NETWORK VISUALIZATION + DISPATCH PLAN & EVENT LOG
           ================================================================== */}
        <section
          id="network"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
        >
          {/* Road Network Visualization & Graph Controls (7 cols in Compact, 12 cols in Full) */}
          <div
            className={`${
              graphViewMode === 'full' ? 'lg:col-span-12' : 'lg:col-span-7'
            } bg-white rounded-xl p-5 border border-slate-200 flex flex-col justify-between space-y-5 transition-all duration-150`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  01. Weighted Road Network &amp; Shortest-Path Router
                </h2>
                <p className="text-xs text-slate-500">
                  Adjacency List Graph (V = 8, E = 10) · Dijkstra Shortest Path &amp; BFS Reachability
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Segmented View Toggle: Compact vs Full */}
                <div
                  className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200"
                  role="group"
                  aria-label="Network Graph View Size"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setGraphViewMode('compact');
                      appendLog(
                        'SYSTEM',
                        'Network graph switched to Compact view.'
                      );
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      graphViewMode === 'compact'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    Compact
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGraphViewMode('full');
                      appendLog(
                        'SYSTEM',
                        'Network graph expanded to Full view (wide canvas + BFS hop/distance telemetry).'
                      );
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      graphViewMode === 'full'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Full
                  </button>
                </div>

                {/* Zone Selector Buttons for instant Dijkstra calculation */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <span className="text-xs font-medium text-slate-500 px-2">
                    Target:
                  </span>
                  {ALL_ZONES.map((z) => {
                    const isReachable = bfsResult.reachableZones.includes(z);
                    return (
                      <button
                        key={z}
                        type="button"
                        onClick={() => handleSelectZone(z)}
                        className={`px-2.5 py-1 text-xs font-mono font-semibold rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          selectedZone === z
                            ? 'bg-orange-600 text-white'
                            : isReachable
                            ? 'text-slate-700 hover:bg-white'
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                      >
                        {z}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Interactive SVG Network Map */}
            <RoadNetworkGraph
              roads={roads}
              reachableNodes={bfsResult.reachableNodes}
              activeRoute={activeRoute}
              selectedZone={selectedZone}
              pendingRequests={distressCalls}
              viewMode={graphViewMode}
              hopLevels={bfsResult.hopLevels}
              onViewModeChange={(mode) => {
                setGraphViewMode(mode);
                appendLog(
                  'SYSTEM',
                  `Network graph switched to ${
                    mode === 'full' ? 'Full' : 'Compact'
                  } view.`
                );
              }}
              onSelectZone={handleSelectZone}
              onToggleRoad={handleToggleRoad}
            />

            {/* Road Block / Unblock Control Matrix */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  Road Segment Controls (Click to Block / Unblock Edge in Adjacency List):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleRoad('C-D')}
                    className="px-2.5 py-1 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {roads.find((r) => r.id === 'C-D')?.blocked
                      ? 'Restore C–D (14 km → 13 km to E)'
                      : 'Block C–D (Test 13 km → 14 km Alt Route to E)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdjList((prev) => !prev)}
                    className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {showAdjList ? 'Hide Adjacency List' : 'View Adjacency List'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {roads.map((edge) => (
                  <button
                    key={edge.id}
                    type="button"
                    onClick={() => handleToggleRoad(edge.id)}
                    className={`px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between ${
                      edge.blocked
                        ? 'bg-red-50 border-red-300 text-red-900 hover:bg-red-100'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-teal-50 hover:border-teal-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-mono font-bold">
                        {edge.id.replace('-', '–')}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {edge.distance} km
                      </div>
                    </div>
                    {edge.blocked ? (
                      <Lock className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {/* Optional Collapsible Adjacency List Representation for Viva */}
              {showAdjList && (
                <div className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-xs overflow-x-auto">
                  <div className="text-teal-400 font-semibold mb-1.5">
                    Graph Adjacency List Representation (Active Edges Only):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    {ALL_NODES.map((node) => {
                      const activeNeighbors = adjacencyList[node].filter(
                        (n) => !n.blocked
                      );
                      return (
                        <div key={node}>
                          <span className="text-orange-400 font-bold">
                            {node.padEnd(5, ' ')}
                          </span>{' '}
                          → [
                          {activeNeighbors
                            .map((n) => `${n.neighbor}(${n.weight}km)`)
                            .join(', ') || '∅ Isolated'}
                          ]
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Dispatch Plan & Live Computation Event Log (5 cols in Compact, 12 cols side-by-side in Full) */}
          <div
            className={`${
              graphViewMode === 'full'
                ? 'lg:col-span-12 grid grid-cols-1 lg:grid-cols-2'
                : 'lg:col-span-5 flex flex-col'
            } gap-6`}
          >
            {/* Dispatch Plan Panel */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    02. Active Dispatch Plan
                  </h2>
                  <p className="text-xs text-slate-500">
                    Synthesized output from Max Heap + 0/1 Knapsack DP + Dijkstra
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-teal-700">
                  Target: Zone {selectedZone}
                </span>
              </div>

              {/* Semantic Status Banner (Success, Detour Warning, or Unreachable Error) */}
              {!activeRoute.reachable ? (
                <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-900 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-sm text-red-800">
                      Zone unreachable — Dispatch Halted
                    </div>
                    <p>
                      BFS &amp; Dijkstra confirm no unblocked path exists between{' '}
                      <strong>Depot</strong> and <strong>Zone {selectedZone}</strong>.
                      {selectedZone === 'F' || selectedZone === 'G'
                        ? ' Sector F–G (1 km) is a disconnected graph component.'
                        : ' Unblock road segments to restore connectivity.'}
                    </p>
                  </div>
                </div>
              ) : blockedRoadCount > 0 ? (
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-sm text-amber-900">
                      Detour Route Active ({blockedRoadCount} road{blockedRoadCount > 1 ? 's' : ''} blocked)
                    </div>
                    <p>
                      Dijkstra rerouted around blocked segments. Shortest available
                      path to <strong>Zone {selectedZone}</strong> is{' '}
                      <strong className="font-mono">{activeRoute.distance} km</strong> via{' '}
                      <span className="font-mono">{activeRoute.path.join(' → ')}</span>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-sm text-teal-900">
                      Optimal Dispatch Corridor Verified
                    </div>
                    <p>
                      Zone {selectedZone} is reachable via primary shortest path (
                      <strong className="font-mono">{activeRoute.distance} km</strong>).
                      Relief unit loaded with optimal DP payload.
                    </p>
                  </div>
                </div>
              )}

              {/* Dispatch Plan Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-medium">
                    1. Priority Queue Selection
                  </div>
                  <div className="mt-1 font-bold text-sm text-slate-900">
                    {topPriorityRequest
                      ? `Zone ${topPriorityRequest.zone} (Severity ${topPriorityRequest.severity}/10)`
                      : `Zone ${selectedZone} (Manual Target)`}
                  </div>
                  <div className="mt-0.5 text-slate-600">
                    Primary Need:{' '}
                    <strong>{topPriorityRequest?.need || 'Emergency Aid'}</strong>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 font-medium">
                    2. Optimal 0/1 Knapsack Load
                  </div>
                  <div className="mt-1 font-bold text-sm text-slate-900 font-mono">
                    Utility {dpResult.totalUtility} · Weight {dpResult.totalWeight}/
                    {vehicleCapacity} kg
                  </div>
                  <div className="mt-0.5 text-teal-700 font-medium truncate">
                    {dpResult.selectedItems.map((i) => i.name).join(' + ') ||
                      'No items fit'}
                  </div>
                </div>

                <div className="sm:col-span-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 font-medium">
                    <span>3. Dijkstra Shortest Route (Target: Zone {selectedZone})</span>
                    <span className="font-mono font-bold text-orange-600">
                      {activeRoute.reachable
                        ? `Total Distance: ${activeRoute.distance} km`
                        : 'Zone unreachable'}
                    </span>
                  </div>
                  <div className="mt-1.5 font-mono text-sm font-bold text-slate-900">
                    {activeRoute.reachable
                      ? activeRoute.path.join(' → ')
                      : `No path available from Depot to Zone ${selectedZone}`}
                  </div>
                </div>

                <div className="sm:col-span-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-slate-500 font-medium">
                    <span>4. BFS Reachability Status</span>
                    <span className="font-mono text-teal-700 font-semibold">
                      {bfsResult.reachableZones.length} Reachable ·{' '}
                      {bfsResult.unreachableZones.length} Unreachable
                    </span>
                  </div>
                  <div className="mt-1 text-slate-700 font-mono text-xs">
                    Reachable: <strong>{bfsResult.reachableZones.join(', ') || 'None'}</strong>{' '}
                    · Isolated: <strong className="text-red-600">{bfsResult.unreachableZones.join(', ') || 'None'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Computation Event Log */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 flex-1 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-orange-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Live Algorithm Execution Log
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleRunFullSimulation}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
                >
                  Re-run Full Demo
                </button>
              </div>

              <div className="bg-slate-900 rounded-lg p-3.5 font-mono text-xs text-slate-200 space-y-2 max-h-[240px] overflow-y-auto border border-slate-800">
                {eventLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 leading-relaxed border-b border-slate-800/80 pb-1.5 last:border-0 last:pb-0"
                  >
                    <span className="text-slate-500 shrink-0">
                      [{entry.timestamp}]
                    </span>
                    <span
                      className={`font-bold shrink-0 ${
                        entry.tag === 'HEAP'
                          ? 'text-orange-400'
                          : entry.tag === 'KNAPSACK'
                          ? 'text-teal-400'
                          : entry.tag === 'DIJKSTRA'
                          ? 'text-amber-300'
                          : entry.tag === 'BFS'
                          ? 'text-sky-400'
                          : 'text-slate-400'
                      }`}
                    >
                      [{entry.tag}]
                    </span>
                    <span className="text-slate-100">{entry.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            ROW 2: DISTRESS CALLS & MAX-HEAP PRIORITY QUEUE
           ================================================================== */}
        <section
          id="distress"
          className="bg-white rounded-xl p-6 border border-slate-200 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                03. Distress Call Queue (Binary Max-Heap Priority Queue)
              </h2>
              <p className="text-xs text-slate-500">
                Extracts highest-severity call first in O(log n) · Preserves FIFO arrival order on equal severity
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDispatchNext}
                disabled={orderedPendingCalls.length === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:bg-slate-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Truck className="w-3.5 h-3.5" />
                Extract Max &amp; Dispatch Next ({orderedPendingCalls.length} Pending)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Distress Calls Table (8 columns) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">Priority Order</th>
                      <th className="py-2.5 px-3">Call ID</th>
                      <th className="py-2.5 px-3">Zone</th>
                      <th className="py-2.5 px-3 text-right">Severity</th>
                      <th className="py-2.5 px-3">Required Aid</th>
                      <th className="py-2.5 px-3 text-right">Dijkstra Route</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {/* Render Pending Calls in Max-Heap Priority Order first, then Dispatched/Unreachable */}
                    {[
                      ...orderedPendingCalls,
                      ...distressCalls.filter((c) => c.status !== 'Pending'),
                    ].map((call, idx) => {
                      const zRoute = allZoneRoutes[call.zone];
                      const isTop =
                        call.status === 'Pending' &&
                        orderedPendingCalls[0]?.id === call.id;

                      return (
                        <tr
                          key={call.id}
                          className={`${
                            isTop
                              ? 'bg-orange-50/70'
                              : 'hover:bg-slate-50'
                          } transition-colors`}
                        >
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {call.status === 'Pending'
                              ? `#${idx + 1} ${isTop ? '(MAX ROOT)' : ''}`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {call.id} (seq:{call.insertionOrder})
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            Zone {call.zone}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                            <span
                              className={
                                call.severity >= 8
                                  ? 'text-red-600'
                                  : call.severity >= 5
                                  ? 'text-orange-600'
                                  : 'text-teal-700'
                              }
                            >
                              {call.severity} / 10
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans font-medium text-slate-800">
                            {call.need}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {zRoute.reachable ? (
                              <span className="text-slate-800">
                                {zRoute.path.join('→')} ({zRoute.distance} km)
                              </span>
                            ) : (
                              <span className="text-red-600 font-semibold">
                                Zone unreachable
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-sans font-semibold">
                            {call.status === 'Dispatched' ? (
                              <span className="text-teal-700">
                                ✓ Dispatched ({call.dispatchedDistance} km)
                              </span>
                            ) : call.status === 'Unreachable' ? (
                              <span className="text-red-600">
                                ✕ Unreachable
                              </span>
                            ) : (
                              <span className="text-orange-600">
                                ● Pending in Heap
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-sans">
                            <button
                              type="button"
                              onClick={() => handleSelectZone(call.zone)}
                              className="px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded border border-teal-200 cursor-pointer whitespace-nowrap"
                            >
                              Show Route
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Binary Heap Internal Array Representation */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono">
                <span className="font-semibold text-slate-700">
                  Internal Binary Max-Heap Array (Level-Order Representation):{' '}
                </span>
                <span className="text-slate-900">
                  [
                  {rawHeapNodes
                    .map(
                      (n, i) =>
                        `${i}: Zone ${n.zone} (sev:${n.severity}, seq:${n.insertionOrder})`
                    )
                    .join(' | ') || 'Empty Heap'}
                  ]
                </span>
              </div>
            </div>

            {/* Add New Distress Call Form (4 columns) */}
            <form
              onSubmit={handleAddDistressCall}
              className="lg:col-span-4 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3.5"
            >
              <div className="text-sm font-bold text-slate-900">
                Add Distress Call to Max Heap
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Zone
                  </label>
                  <select
                    value={newCallZone}
                    onChange={(e) =>
                      setNewCallZone(
                        e.target.value as Exclude<ZoneId, 'Depot'>
                      )
                    }
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                  >
                    {ALL_ZONES.map((z) => (
                      <option key={z} value={z}>
                        Zone {z} {z === 'F' || z === 'G' ? '(Isolated)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Severity (1–10)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newCallSeverity}
                    onChange={(e) => setNewCallSeverity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Required Relief Aid
                </label>
                <select
                  value={newCallNeed}
                  onChange={(e) => setNewCallNeed(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="Medical">Medical</option>
                  <option value="Food">Food</option>
                  <option value="Water">Water</option>
                  <option value="Shelter & Blankets">Shelter &amp; Blankets</option>
                </select>
              </div>

              {callFormError && (
                <div className="text-xs text-red-600 font-medium">
                  {callFormError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Insert Request into Max-Heap O(log n)
              </button>
            </form>
          </div>
        </section>

        {/* ==================================================================
            ROW 3: SUPPLY INVENTORY & 0/1 KNAPSACK DP vs GREEDY COMPARISON
           ================================================================== */}
        <section
          id="knapsack"
          className="bg-white rounded-xl p-6 border border-slate-200 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                04. Supply Inventory &amp; 0/1 Knapsack Optimizer (DP vs. Greedy)
              </h2>
              <p className="text-xs text-slate-500">
                Maximizes relief utility within vehicle capacity W using Dynamic Programming O(nW)
              </p>
            </div>

            {/* Vehicle Capacity Controls */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200">
              <label
                htmlFor="capacity-slider"
                className="text-xs font-semibold text-slate-700"
              >
                Vehicle Capacity (W):
              </label>
              <input
                id="capacity-slider"
                type="range"
                min={5}
                max={120}
                step={5}
                value={vehicleCapacity}
                onChange={(e) => handleCapacityChange(Number(e.target.value))}
                className="w-28 accent-orange-600 cursor-pointer"
              />
              <input
                type="number"
                min={5}
                max={150}
                value={vehicleCapacity}
                onChange={(e) => handleCapacityChange(Number(e.target.value))}
                className="w-16 px-2 py-1 text-xs font-mono font-bold text-center bg-white border border-slate-300 rounded"
              />
              <span className="text-xs font-mono text-slate-600">kg</span>
              <button
                type="button"
                onClick={() => handleCapacityChange(50)}
                className="px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded border border-teal-200 cursor-pointer"
              >
                Set 50 kg
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Supply Inventory Table + Add Supply Form (7 columns) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">Supply Item</th>
                      <th className="py-2.5 px-3 text-right">Weight (wᵢ)</th>
                      <th className="py-2.5 px-3 text-right">Utility (uᵢ)</th>
                      <th className="py-2.5 px-3 text-right">Ratio (uᵢ/wᵢ)</th>
                      <th className="py-2.5 px-3">DP Selection</th>
                      <th className="py-2.5 px-3 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {supplies.map((item) => {
                      const isSelectedDP = dpResult.selectedItems.some(
                        (s) => s.id === item.id
                      );
                      const isSelectedGreedy = greedyResult.selectedItems.some(
                        (s) => s.id === item.id
                      );
                      const ratio = (item.utility / item.weight).toFixed(2);

                      return (
                        <tr
                          key={item.id}
                          className={
                            isSelectedDP ? 'bg-teal-50/60' : 'hover:bg-slate-50'
                          }
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {item.name}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {item.weight} kg
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {item.utility}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                            {ratio}
                          </td>
                          <td className="py-2.5 px-3 text-xs font-medium">
                            {isSelectedDP ? (
                              <span className="text-teal-700 font-semibold">
                                ✓ Selected by DP
                              </span>
                            ) : isSelectedGreedy ? (
                              <span className="text-amber-700">
                                Greedy only
                              </span>
                            ) : (
                              <span className="text-slate-400">Excluded</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveSupply(item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                              title={`Remove ${item.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add Supply Item Inline Form */}
              <form
                onSubmit={handleAddSupply}
                className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-end gap-3"
              >
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Supply Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Solar Generator"
                    value={newSupplyName}
                    onChange={(e) => setNewSupplyName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={newSupplyWeight}
                    onChange={(e) => setNewSupplyWeight(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Utility
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={newSupplyUtility}
                    onChange={(e) => setNewSupplyUtility(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Supply
                </button>
                {supplyFormError && (
                  <div className="w-full text-xs text-red-600">
                    {supplyFormError}
                  </div>
                )}
              </form>
            </div>

            {/* Side-by-Side DP vs Greedy Comparison (5 columns) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 0/1 Knapsack DP Card */}
                <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 space-y-2">
                  <div className="text-xs font-bold text-teal-900">
                    0/1 Knapsack DP (Optimal)
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-teal-800">
                    Utility: {dpResult.totalUtility}
                  </div>
                  <div className="text-xs font-mono text-teal-700">
                    Total Weight: {dpResult.totalWeight} / {vehicleCapacity} kg
                  </div>
                  <div className="pt-2 border-t border-teal-200/80 text-xs text-slate-800 space-y-1">
                    <div className="font-semibold text-slate-600">
                      Selected Payload:
                    </div>
                    {dpResult.selectedItems.length > 0 ? (
                      dpResult.selectedItems.map((item) => (
                        <div
                          key={item.id}
                          className="font-mono flex justify-between"
                        >
                          <span>• {item.name}</span>
                          <span>
                            ({item.weight}kg, u:{item.utility})
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400">None</div>
                    )}
                  </div>
                </div>

                {/* Greedy Heuristic Comparison Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-700">
                    Greedy Ratio (uᵢ/wᵢ) Approach
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-800">
                    Utility: {greedyResult.totalUtility}
                  </div>
                  <div className="text-xs font-mono text-slate-600">
                    Total Weight: {greedyResult.totalWeight} / {vehicleCapacity}{' '}
                    kg
                  </div>
                  <div className="pt-2 border-t border-slate-200 text-xs text-slate-700 space-y-1">
                    <div className="font-semibold text-slate-500">
                      Selected Payload:
                    </div>
                    {greedyResult.selectedItems.length > 0 ? (
                      greedyResult.selectedItems.map((item) => (
                        <div
                          key={item.id}
                          className="font-mono flex justify-between"
                        >
                          <span>• {item.name}</span>
                          <span>
                            ({item.weight}kg, u:{item.utility})
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400">None</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Analytical Explanation Box for Viva */}
              <div className="p-3.5 rounded-lg bg-orange-50/70 border border-orange-200 text-xs text-slate-800 space-y-1.5">
                <div className="font-bold text-orange-900 flex items-center justify-between">
                  <span>Why DP Beats Greedy in 0/1 Knapsack:</span>
                  <span className="font-mono text-orange-700">
                    +{dpResult.totalUtility - greedyResult.totalUtility} Utility Advantage
                  </span>
                </div>
                <p className="leading-relaxed">
                  Greedy sorts by utility/weight ratio (Medical kit: 6.0, Food
                  pack: 5.0, Water crate: 4.0) and selects{' '}
                  <strong>
                    {greedyResult.selectedItems.map((i) => i.name).join(' + ') ||
                      'nothing'}
                  </strong>{' '}
                  (weight {greedyResult.totalWeight} kg, utility{' '}
                  {greedyResult.totalUtility}), leaving{' '}
                  {vehicleCapacity - greedyResult.totalWeight} kg unused. Dynamic
                  Programming evaluates global subproblems to select{' '}
                  <strong>
                    {dpResult.selectedItems.map((i) => i.name).join(' + ') ||
                      'nothing'}
                  </strong>{' '}
                  (weight {dpResult.totalWeight} kg, utility{' '}
                  {dpResult.totalUtility}).
                </p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleCompareDPAndGreedy}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  Log DP vs. Greedy Comparison
                </button>
                <button
                  type="button"
                  onClick={() => setShowDPMatrix((prev) => !prev)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  {showDPMatrix ? 'Hide DP Table' : 'Inspect DP Table dp[i][w]'}
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible 0/1 Knapsack DP Matrix Inspector */}
          {showDPMatrix && dpResult.dpTableSample && dpResult.sampleWeights && (
            <div className="p-4 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto space-y-2">
              <div className="text-xs font-mono text-teal-400 font-semibold">
                Dynamic Programming Matrix dp[i][w] (Sampled Capacities w = 0 to {vehicleCapacity} kg):
              </div>
              <table className="w-full text-right font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="py-1.5 px-2 text-left">Item Subset (i)</th>
                    {dpResult.sampleWeights.map((w) => (
                      <th key={w} className="py-1.5 px-2">
                        w={w}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {dpResult.dpTableSample.map((row, i) => (
                    <tr key={i}>
                      <td className="py-1.5 px-2 text-left text-orange-300 font-semibold">
                        {i === 0
                          ? 'i=0 (∅)'
                          : `i=${i} (${supplies[i - 1]?.name})`}
                      </td>
                      {row.map((val, colIdx) => (
                        <td
                          key={colIdx}
                          className={`py-1.5 px-2 tabular-nums ${
                            i === supplies.length &&
                            colIdx === row.length - 1
                              ? 'text-teal-400 font-bold bg-teal-950/60'
                              : 'text-slate-300'
                          }`}
                        >
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ==================================================================
            ROW 4: DSA EXPLANATION & COMPLEXITY PANEL (FOR VIVA)
           ================================================================== */}
        <section
          id="algorithms"
          className="bg-white rounded-xl p-6 border border-slate-200 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                05. Data Structures &amp; Algorithms Reference (Viva Guide)
              </h2>
              <p className="text-xs text-slate-500">
                Core algorithms, asymptotic time/space complexities, and role in the emergency dispatch pipeline
              </p>
            </div>
            <div className="text-xs font-mono text-slate-600">
              V = {ALL_NODES.length} vertices · E = {roads.length} edges · n ={' '}
              {supplies.length} items · W = {vehicleCapacity} capacity
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Algorithm 1: Max Heap */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-xs font-mono font-bold text-orange-600">
                1. Max Heap / Priority Queue
              </div>
              <div className="text-sm font-bold text-slate-900">
                Distress Call Triage
              </div>
              <div className="text-xs font-mono text-teal-800 bg-teal-50 px-2.5 py-1 rounded border border-teal-200 inline-block">
                Insert / Extract: O(log n)
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Maintains pending distress requests in a complete binary tree
                where parent severity ≥ child severity. Extracts the most
                critical zone first while using monotonic sequence numbers to
                preserve FIFO arrival order for equal severities.
              </p>
            </div>

            {/* Algorithm 2: Dijkstra + Graph */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-xs font-mono font-bold text-orange-600">
                2. Dijkstra + Adjacency List
              </div>
              <div className="text-sm font-bold text-slate-900">
                Shortest Available Route
              </div>
              <div className="text-xs font-mono text-teal-800 bg-teal-50 px-2.5 py-1 rounded border border-teal-200 inline-block">
                Time: O((V + E) log V)
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Represents Depot and zones as graph vertices (V) and road
                distances as weighted edges (E) in an adjacency list. Uses a
                binary min-heap to compute the shortest unblocked path from the
                Depot, dynamically rerouting when roads are blocked.
              </p>
            </div>

            {/* Algorithm 3: 0/1 Knapsack DP */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-xs font-mono font-bold text-orange-600">
                3. 0/1 Knapsack (DP)
              </div>
              <div className="text-sm font-bold text-slate-900">
                Relief Payload Optimization
              </div>
              <div className="text-xs font-mono text-teal-800 bg-teal-50 px-2.5 py-1 rounded border border-teal-200 inline-block">
                Time: O(nW) · Space: O(nW)
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Constructs an (n+1)×(W+1) Dynamic Programming table where n is
                the number of supply items and W is vehicle capacity. Guarantees
                the globally optimal utility payload (220 vs. Greedy&apos;s 160 on
                the baseline dataset).
              </p>
            </div>

            {/* Algorithm 4: BFS */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-xs font-mono font-bold text-orange-600">
                4. Breadth-First Search (BFS)
              </div>
              <div className="text-sm font-bold text-slate-900">
                Zone Reachability Analysis
              </div>
              <div className="text-xs font-mono text-teal-800 bg-teal-50 px-2.5 py-1 rounded border border-teal-200 inline-block">
                Time: O(V + E) · Space: O(V)
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Traverses active edges level-by-level from the Depot using a
                FIFO queue to identify all reachable zones (A, B, C, D, E) and
                detect disconnected components (F–G) or zones isolated by road
                blockages.
              </p>
            </div>
          </div>

          {/* Variable Notation Legend */}
          <div className="p-3.5 rounded-lg bg-slate-900 text-slate-200 text-xs font-mono flex flex-wrap items-center justify-between gap-3">
            <span>
              <strong className="text-orange-400">Complexity Variables:</strong>{' '}
              <strong>V</strong> = Number of graph vertices (Depot + zones) ·{' '}
              <strong>E</strong> = Number of road edges ·{' '}
              <strong>n</strong> = Number of supply items / heap requests ·{' '}
              <strong>W</strong> = Relief vehicle capacity
            </span>
            <span className="text-teal-400">
              All outputs computed live in browser JavaScript
            </span>
          </div>
        </section>
      </main>

      {/* ====================================================================
          QUIET ACADEMIC FOOTER
         ==================================================================== */}
      <footer className="border-t border-slate-800 bg-[#0B132B] px-6 py-4 text-xs text-slate-400">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Disaster Relief Distribution &amp; Shelter Allocator · SAKEC Dept. of AI &amp; Data Science · Group 4 (AY 2026–27)
          </div>
          <div>
            Atharva Shinde (02) · Riya Navale (34) · Jainam Gala (14) · Local Simulation Prototype
          </div>
        </div>
      </footer>
    </div>
  );
}
