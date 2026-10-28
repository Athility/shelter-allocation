# Disaster Relief Distribution & Shelter Allocator

**College:** Shah & Anchor Kutchhi Engineering College (SAKEC)  
**Department:** Artificial Intelligence & Data Science  
**Group:** Group 4 | **Academic Year:** 2026–27  
**Team Members:**
- Atharva Shinde (Roll No. 02)
- Riya Navale (Roll No. 34)
- Jainam Gala (Roll No. 14)

---

## 1. Launch Instructions

### Option A: Run Local Development Server (Vite + React/TypeScript)
```bash
npm install
npm run dev
```
Then open `http://localhost:3000` in your browser.

### Option B: Direct Single-File Browser Launch (No Build / Server Needed)
A self-contained single-file HTML/CSS/JavaScript version is also included at `public/standalone.html`. You can double-click `public/standalone.html` in your file explorer to open it directly in any browser offline.

---

## 2. Core Data Structures & Algorithms Implemented

All algorithms execute live in browser JavaScript (`src/dsa/algorithms.ts`):

1. **Max Heap / Priority Queue (`DistressMaxHeap`) — $O(\log n)$ Insert & Extract**
   - Stores incoming distress calls in a binary max-heap ordered by `severity` ($1\text{–}10$).
   - Uses a monotonic `insertionOrder` counter to preserve FIFO arrival order when two distress calls have equal severity.
   - Extracts Zone E (severity 10) first, followed by Zone A (severity 8), and Zone C (severity 6).

2. **Weighted Graph using an Adjacency List (`buildAdjacencyList`) — $O(V + E)$ Space**
   - Models the `Depot` and Zones `A` through `G` as vertices ($V = 8$) and road segments as undirected weighted edges ($E = 10$).
   - Supports dynamic road blocking and unblocking (`edge.blocked`), allowing instant rerouting.

3. **Dijkstra's Shortest Path Algorithm (`runDijkstra`) — $O((V + E) \log V)$ Time**
   - Uses an adjacency list and a binary min-heap priority queue to compute the shortest unblocked path from `Depot` to any selected target zone.
   - **Verified Test Cases:**
     - `Depot → A`: `Depot → B → A` (**3 km**, shorter than the direct 4 km road).
     - `Depot → E` (all roads open): `Depot → B → A → C → D → E` (**13 km**).
     - `Depot → E` (after blocking `C–D`): `Depot → B → A → C → E` (**14 km**).
     - `Depot → F` or `G`: Reports **"Zone unreachable"** because `F–G` (1 km) is a disconnected component.

4. **0/1 Knapsack using Dynamic Programming (`runKnapsack01DP`) — $O(nW)$ Time & Space**
   - Builds an $(n + 1) \times (W + 1)$ DP table where $n$ is the number of supply items and $W$ is the relief vehicle capacity.
   - **Verified Test Case ($W = 50$):**
     - **0/1 Knapsack DP (Optimal):** Selects **Food pack (20 kg, utility 100) + Water crate (30 kg, utility 120)** for a total weight of **50 kg** and optimal utility of **220**.
     - **Greedy Ratio Heuristic ($u_i / w_i$):** Sorts by ratio (`Medical kit: 6.0`, `Food pack: 5.0`, `Water crate: 4.0`, `Blanket: 3.0`) and selects **Medical kit + Food pack** with weight **30 kg** and utility **160**, proving why DP outperforms greedy selection by **+60 utility**.

5. **Breadth-First Search (`runBFSReachability`) — $O(V + E)$ Time**
   - Traverses unblocked edges level-by-level from `Depot` using a FIFO queue to identify all reachable zones (`A, B, C, D, E`) and flag isolated zones (`F, G`).
