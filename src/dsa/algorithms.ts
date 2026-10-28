/**
 * ============================================================================
 * DISASTER RELIEF DISTRIBUTION & SHELTER ALLOCATOR — CORE DSA ALGORITHMS
 * ============================================================================
 * College: Shah & Anchor Kutchhi Engineering College (SAKEC)
 * Department: Artificial Intelligence & Data Science
 * Group 4 | Academic Year 2026–27
 * Members: Atharva Shinde (02), Riya Navale (34), Jainam Gala (14)
 *
 * Implemented Data Structures & Algorithms:
 *  A. Max Heap / Priority Queue — O(log n) insert & extractMax (FIFO tie-break)
 *  B. Weighted Graph (Adjacency List) — Dynamic road block/unblock support
 *  C. Dijkstra's Shortest Path Algorithm — O((V + E) log V) with Min-Heap
 *  D. 0/1 Knapsack Dynamic Programming — O(nW) time & space + Greedy Comparison
 *  E. Breadth-First Search (BFS) — O(V + E) zone reachability analysis
 * ============================================================================
 */

export type ZoneId = 'Depot' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface DistressRequest {
  id: string;
  zone: Exclude<ZoneId, 'Depot'>;
  severity: number; // 1 to 10 (10 = most critical)
  need: string;
  insertionOrder: number; // Monotonic counter to preserve FIFO order for equal severity
  status: 'Pending' | 'Dispatched' | 'Unreachable';
  dispatchedRoute?: string[];
  dispatchedDistance?: number | null;
  dispatchedSupplies?: string[];
  dispatchedUtility?: number;
}

export interface RoadEdge {
  id: string;
  from: ZoneId;
  to: ZoneId;
  distance: number; // in km
  blocked: boolean;
}

export interface SupplyItem {
  id: string;
  name: string;
  weight: number; // in kg
  utility: number; // priority / benefit score
}

export interface AdjacencyEntry {
  neighbor: ZoneId;
  weight: number;
  edgeId: string;
  blocked: boolean;
}

export interface DijkstraResult {
  target: ZoneId;
  reachable: boolean;
  distance: number | null;
  path: ZoneId[];
  visitedOrder: ZoneId[];
  distancesFromDepot: Record<ZoneId, number>;
}

export interface KnapsackResult {
  selectedItems: SupplyItem[];
  totalWeight: number;
  totalUtility: number;
  capacity: number;
  dpTableSample?: number[][]; // Sampled columns for UI inspection
  sampleWeights?: number[];
}

export interface BFSResult {
  startNode: ZoneId;
  reachableNodes: ZoneId[]; // Includes Depot
  reachableZones: Exclude<ZoneId, 'Depot'>[]; // Only zones A..G
  unreachableZones: Exclude<ZoneId, 'Depot'>[];
  traversalOrder: ZoneId[];
  hopLevels: Record<string, number>;
}

export const ALL_NODES: ZoneId[] = ['Depot', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
export const ALL_ZONES: Exclude<ZoneId, 'Depot'>[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

// ============================================================================
// INITIAL DOCUMENTED PROJECT DATASET (SAKEC AI & DS GROUP 4)
// ============================================================================

export const INITIAL_ROADS: RoadEdge[] = [
  { id: 'Depot-A', from: 'Depot', to: 'A', distance: 4, blocked: false },
  { id: 'Depot-B', from: 'Depot', to: 'B', distance: 2, blocked: false },
  { id: 'A-B', from: 'A', to: 'B', distance: 1, blocked: false },
  { id: 'A-C', from: 'A', to: 'C', distance: 5, blocked: false },
  { id: 'B-C', from: 'B', to: 'C', distance: 8, blocked: false },
  { id: 'B-D', from: 'B', to: 'D', distance: 10, blocked: false },
  { id: 'C-D', from: 'C', to: 'D', distance: 2, blocked: false },
  { id: 'C-E', from: 'C', to: 'E', distance: 6, blocked: false },
  { id: 'D-E', from: 'D', to: 'E', distance: 3, blocked: false },
  { id: 'F-G', from: 'F', to: 'G', distance: 1, blocked: false },
];

export const INITIAL_DISTRESS_CALLS: DistressRequest[] = [
  {
    id: 'REQ-101',
    zone: 'C',
    severity: 6,
    need: 'Food',
    insertionOrder: 1,
    status: 'Pending',
  },
  {
    id: 'REQ-102',
    zone: 'E',
    severity: 10,
    need: 'Medical',
    insertionOrder: 2,
    status: 'Pending',
  },
  {
    id: 'REQ-103',
    zone: 'A',
    severity: 8,
    need: 'Medical',
    insertionOrder: 3,
    status: 'Pending',
  },
];

export const INITIAL_SUPPLIES: SupplyItem[] = [
  { id: 'SUP-1', name: 'Medical kit', weight: 10, utility: 60 },
  { id: 'SUP-2', name: 'Food pack', weight: 20, utility: 100 },
  { id: 'SUP-3', name: 'Water crate', weight: 30, utility: 120 },
  { id: 'SUP-4', name: 'Blanket', weight: 5, utility: 15 },
];

export const INITIAL_VEHICLE_CAPACITY = 50;

// ============================================================================
// A. MAX HEAP / PRIORITY QUEUE IMPLEMENTATION
//    Time Complexity: O(log n) Insert, O(log n) ExtractMax, O(1) Peek
// ============================================================================

export class DistressMaxHeap {
  private heap: DistressRequest[] = [];

  constructor(initialRequests: DistressRequest[] = []) {
    for (const req of initialRequests) {
      this.insert({ ...req });
    }
  }

  /**
   * Compares two distress requests.
   * Returns true if `a` has strictly higher priority than `b`.
   * Rule 1: Higher severity wins.
   * Rule 2: If severities are equal, smaller insertionOrder (earlier arrival) wins.
   */
  private hasHigherPriority(a: DistressRequest, b: DistressRequest): boolean {
    if (a.severity !== b.severity) {
      return a.severity > b.severity;
    }
    return a.insertionOrder < b.insertionOrder;
  }

  /**
   * Inserts a new distress call into the Max Heap in O(log n) time.
   */
  public insert(request: DistressRequest): void {
    this.heap.push(request);
    this.siftUp(this.heap.length - 1);
  }

  /**
   * Extracts and returns the highest-severity distress call in O(log n) time.
   */
  public extractMax(): DistressRequest | null {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop()!;

    const max = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.siftDown(0);
    return max;
  }

  /**
   * Returns the highest-priority request without removing it in O(1) time.
   */
  public peek(): DistressRequest | null {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  public size(): number {
    return this.heap.length;
  }

  /**
   * Returns the raw internal binary heap array (level-order tree representation).
   */
  public getRawHeapArray(): DistressRequest[] {
    return [...this.heap];
  }

  /**
   * Non-destructively extracts all elements in priority order using heap clone.
   */
  public getPriorityOrderedList(): DistressRequest[] {
    const clone = new DistressMaxHeap(this.heap);
    const ordered: DistressRequest[] = [];
    while (clone.size() > 0) {
      const next = clone.extractMax();
      if (next) ordered.push(next);
    }
    return ordered;
  }

  private siftUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parentIndex = Math.floor((current - 1) / 2);
      if (this.hasHigherPriority(this.heap[current], this.heap[parentIndex])) {
        const temp = this.heap[current];
        this.heap[current] = this.heap[parentIndex];
        this.heap[parentIndex] = temp;
        current = parentIndex;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number): void {
    let current = index;
    const length = this.heap.length;

    while (true) {
      const leftChild = 2 * current + 1;
      const rightChild = 2 * current + 2;
      let highest = current;

      if (
        leftChild < length &&
        this.hasHigherPriority(this.heap[leftChild], this.heap[highest])
      ) {
        highest = leftChild;
      }

      if (
        rightChild < length &&
        this.hasHigherPriority(this.heap[rightChild], this.heap[highest])
      ) {
        highest = rightChild;
      }

      if (highest !== current) {
        const temp = this.heap[current];
        this.heap[current] = this.heap[highest];
        this.heap[highest] = temp;
        current = highest;
      } else {
        break;
      }
    }
  }
}

// ============================================================================
// B. WEIGHTED GRAPH USING ADJACENCY LIST
//    Space Complexity: O(V + E)
// ============================================================================

export function buildAdjacencyList(
  roads: RoadEdge[],
  nodes: ZoneId[] = ALL_NODES
): Record<ZoneId, AdjacencyEntry[]> {
  const adj = {} as Record<ZoneId, AdjacencyEntry[]>;
  for (const node of nodes) {
    adj[node] = [];
  }

  for (const edge of roads) {
    adj[edge.from].push({
      neighbor: edge.to,
      weight: edge.distance,
      edgeId: edge.id,
      blocked: edge.blocked,
    });
    adj[edge.to].push({
      neighbor: edge.from,
      weight: edge.distance,
      edgeId: edge.id,
      blocked: edge.blocked,
    });
  }

  return adj;
}

// ============================================================================
// C. DIJKSTRA'S SHORTEST PATH ALGORITHM (WITH BINARY MIN-HEAP)
//    Time Complexity: O((V + E) log V)
// ============================================================================

interface MinHeapNode {
  node: ZoneId;
  distance: number;
}

class BinaryMinHeap {
  private heap: MinHeapNode[] = [];

  public push(item: MinHeapNode): void {
    this.heap.push(item);
    let idx = this.heap.length - 1;
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[idx].distance < this.heap[parent].distance) {
        [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
        idx = parent;
      } else {
        break;
      }
    }
  }

  public pop(): MinHeapNode | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();
    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    let idx = 0;
    const len = this.heap.length;
    while (true) {
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      let smallest = idx;
      if (left < len && this.heap[left].distance < this.heap[smallest].distance) {
        smallest = left;
      }
      if (right < len && this.heap[right].distance < this.heap[smallest].distance) {
        smallest = right;
      }
      if (smallest !== idx) {
        [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
        idx = smallest;
      } else {
        break;
      }
    }
    return min;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }
}

export function runDijkstra(
  roads: RoadEdge[],
  startNode: ZoneId,
  targetNode: ZoneId,
  nodes: ZoneId[] = ALL_NODES
): DijkstraResult {
  const adj = buildAdjacencyList(roads, nodes);
  const distances = {} as Record<ZoneId, number>;
  const previous = {} as Record<ZoneId, ZoneId | null>;
  const visited = new Set<ZoneId>();
  const visitedOrder: ZoneId[] = [];

  for (const node of nodes) {
    distances[node] = Infinity;
    previous[node] = null;
  }
  distances[startNode] = 0;

  const minHeap = new BinaryMinHeap();
  minHeap.push({ node: startNode, distance: 0 });

  while (!minHeap.isEmpty()) {
    const current = minHeap.pop()!;
    const u = current.node;

    if (visited.has(u)) continue;
    visited.add(u);
    visitedOrder.push(u);

    if (u === targetNode) break;

    for (const edge of adj[u]) {
      // Ignore blocked roads during shortest-path routing
      if (edge.blocked) continue;

      const v = edge.neighbor;
      if (visited.has(v)) continue;

      const candidateDist = distances[u] + edge.weight;
      if (candidateDist < distances[v]) {
        distances[v] = candidateDist;
        previous[v] = u;
        minHeap.push({ node: v, distance: candidateDist });
      }
    }
  }

  // Reconstruct shortest path from startNode to targetNode
  if (distances[targetNode] === Infinity) {
    return {
      target: targetNode,
      reachable: false,
      distance: null,
      path: [],
      visitedOrder,
      distancesFromDepot: distances,
    };
  }

  const path: ZoneId[] = [];
  let curr: ZoneId | null = targetNode;
  while (curr !== null) {
    path.unshift(curr);
    curr = previous[curr];
  }

  return {
    target: targetNode,
    reachable: true,
    distance: distances[targetNode],
    path,
    visitedOrder,
    distancesFromDepot: distances,
  };
}

// ============================================================================
// D. 0/1 KNAPSACK DYNAMIC PROGRAMMING & GREEDY COMPARISON
//    DP Time Complexity: O(n * W) | Space Complexity: O(n * W)
//    Greedy Time Complexity: O(n log n)
// ============================================================================

export function runKnapsack01DP(
  items: SupplyItem[],
  capacity: number
): KnapsackResult {
  const n = items.length;
  const W = Math.max(0, Math.floor(capacity));

  // Create (n + 1) x (W + 1) DP matrix initialized to 0
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(W + 1).fill(0)
  );

  // Fill DP table bottom-up
  for (let i = 1; i <= n; i++) {
    const item = items[i - 1];
    const w_i = item.weight;
    const u_i = item.utility;

    for (let w = 0; w <= W; w++) {
      if (w_i <= w) {
        dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - w_i] + u_i);
      } else {
        dp[i][w] = dp[i - 1][w];
      }
    }
  }

  // Backtrack from dp[n][W] to find which items were selected
  const selectedItems: SupplyItem[] = [];
  let remainingWeight = W;
  for (let i = n; i >= 1; i--) {
    if (dp[i][remainingWeight] !== dp[i - 1][remainingWeight]) {
      const chosen = items[i - 1];
      selectedItems.unshift(chosen);
      remainingWeight -= chosen.weight;
    }
  }

  const totalWeight = selectedItems.reduce((sum, item) => sum + item.weight, 0);
  const totalUtility = dp[n][W];

  // Extract sampled weight columns (e.g. step of 5 or 10) for compact DP table display
  const step = W <= 20 ? 2 : W <= 60 ? 5 : 10;
  const sampleWeights: number[] = [];
  for (let w = 0; w <= W; w += step) {
    sampleWeights.push(w);
  }
  if (sampleWeights[sampleWeights.length - 1] !== W) {
    sampleWeights.push(W);
  }

  const dpTableSample = dp.map((row) => sampleWeights.map((w) => row[w]));

  return {
    selectedItems,
    totalWeight,
    totalUtility,
    capacity: W,
    dpTableSample,
    sampleWeights,
  };
}

/**
 * Greedy heuristic for 0/1 Knapsack based on highest utility-to-weight ratio.
 * Sorts items by (utility / weight) descending and packs sequentially until
 * the next highest-ratio item exceeds remaining capacity.
 *
 * For the documented SAKEC project example (Capacity = 50):
 *  1. Medical kit (w=10, u=60, ratio=6.0) -> Selected (rem=40)
 *  2. Food pack   (w=20, u=100, ratio=5.0) -> Selected (rem=20)
 *  3. Water crate (w=30, u=120, ratio=4.0) -> Exceeds rem=20, greedy stops!
 *  Result: Medical kit + Food pack (Weight = 30, Utility = 160 vs DP Optimal 220).
 */
export function runKnapsackGreedy(
  items: SupplyItem[],
  capacity: number
): KnapsackResult {
  const W = Math.max(0, Math.floor(capacity));

  const sortedByRatio = [...items].sort(
    (a, b) => b.utility / b.weight - a.utility / a.weight
  );

  const selectedItems: SupplyItem[] = [];
  let totalWeight = 0;
  let totalUtility = 0;

  for (const item of sortedByRatio) {
    if (totalWeight + item.weight <= W) {
      selectedItems.push(item);
      totalWeight += item.weight;
      totalUtility += item.utility;
    } else {
      // Standard contiguous greedy heuristic stops when the next best-ratio item cannot fit
      break;
    }
  }

  return {
    selectedItems,
    totalWeight,
    totalUtility,
    capacity: W,
  };
}

// ============================================================================
// E. BREADTH-FIRST SEARCH (BFS) REACHABILITY ALGORITHM
//    Time Complexity: O(V + E) | Space Complexity: O(V)
// ============================================================================

export function runBFSReachability(
  roads: RoadEdge[],
  startNode: ZoneId = 'Depot',
  nodes: ZoneId[] = ALL_NODES
): BFSResult {
  const adj = buildAdjacencyList(roads, nodes);
  const visited = new Set<ZoneId>([startNode]);
  const queue: ZoneId[] = [startNode];
  const traversalOrder: ZoneId[] = [];
  const hopLevels: Record<string, number> = { [startNode]: 0 };

  while (queue.length > 0) {
    const current = queue.shift()!;
    traversalOrder.push(current);

    // Sort active neighbors alphabetically for deterministic BFS order (A, B, C, D, E)
    const neighbors = [...adj[current]]
      .filter((edge) => !edge.blocked)
      .sort((a, b) => a.neighbor.localeCompare(b.neighbor));

    for (const edge of neighbors) {
      if (!visited.has(edge.neighbor)) {
        visited.add(edge.neighbor);
        hopLevels[edge.neighbor] = hopLevels[current] + 1;
        queue.push(edge.neighbor);
      }
    }
  }

  const reachableNodes = Array.from(visited);
  const reachableZones = ALL_ZONES.filter((z) => visited.has(z)).sort();
  const unreachableZones = ALL_ZONES.filter((z) => !visited.has(z)).sort();

  return {
    startNode,
    reachableNodes,
    reachableZones,
    unreachableZones,
    traversalOrder,
    hopLevels,
  };
}
