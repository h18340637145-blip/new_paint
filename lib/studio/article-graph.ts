export type ArticleTextRole = "material" | "requirement" | "verbatim";

export const ARTICLE_TEXT_ROLE_LABEL: Record<ArticleTextRole, string> = {
  material: "创作素材",
  requirement: "写作要求",
  verbatim: "原文保留",
};

export interface ArticleTextNodeRecord {
  id: string;
  content: string;
  role: ArticleTextRole;
  x: number;
  y: number;
  width: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleEdgeRecord {
  id: string;
  source: string;
  target: string;
}

export interface ArticleGraphNode {
  nodeId: string;
  kind: "text" | "image";
  role?: ArticleTextRole;
  text?: string;
  assetId?: string;
  assetKind?: "reference" | "generated";
  imageUrl?: string;
  filename?: string;
  pending?: boolean;
}

export interface SnapshotOrderedNode {
  order: number;
  nodeId: string;
  kind: "text" | "image";
  role?: ArticleTextRole;
  text?: string;
  assetId?: string;
  assetKind?: "reference" | "generated";
  filename?: string;
}

export interface ArticleSnapshotRecord {
  id: string;
  projectId: string;
  versionNumber: number;
  title: string;
  nodes: SnapshotOrderedNode[];
  excludedNodes: SnapshotOrderedNode[];
  createdAt: string;
}

export type ArticleGraphStatus =
  | "ok"
  | "empty"
  | "cycle"
  | "branch"
  | "empty_in_chain"
  | "generating_in_chain";

export interface ArticleGraphAnalysis {
  status: ArticleGraphStatus;
  message: string | null;
  problemNodeIds: string[];
  chains: ArticleGraphNode[][];
  needsChainSelection: boolean;
  selectedChainHeadId: string | null;
  activeChain: ArticleGraphNode[];
  excludedNodes: ArticleGraphNode[];
  badges: Record<string, string>;
}

function isEmptyGraphNode(node: ArticleGraphNode): boolean {
  if (node.kind === "text") {
    return !node.text || node.text.trim().length === 0;
  }
  if (node.pending) {
    return false;
  }
  return !node.assetId;
}

export function toSnapshotNode(node: ArticleGraphNode, order: number): SnapshotOrderedNode {
  if (node.kind === "text") {
    return {
      order,
      nodeId: node.nodeId,
      kind: "text",
      role: node.role ?? "material",
      text: node.text ?? "",
    };
  }
  return {
    order,
    nodeId: node.nodeId,
    kind: "image",
    assetId: node.assetId,
    assetKind: node.assetKind ?? "reference",
    ...(node.filename ? { filename: node.filename } : {}),
  };
}

export function deriveSnapshotTitle(chain: ArticleGraphNode[], versionNumber: number): string {
  const firstText = chain.find((n) => n.kind === "text" && n.role !== "requirement" && n.text?.trim());
  const raw = firstText?.text?.trim().split(/\r?\n/)[0]?.replace(/^#+\s*/, "").trim() ?? "";
  if (raw) {
    return raw.length > 42 ? `${raw.slice(0, 42)}…` : raw;
  }
  return `暂存版本 v${versionNumber}（${chain.length} 个节点）`;
}

export function analyzeArticleGraph(
  nodes: ArticleGraphNode[],
  edges: ArticleEdgeRecord[],
  preferredHeadId?: string | null,
): ArticleGraphAnalysis {
  const nodeMap = new Map<string, ArticleGraphNode>();
  for (const node of nodes) {
    nodeMap.set(node.nodeId, node);
  }

  const validEdges: ArticleEdgeRecord[] = [];
  const seenPairs = new Set<string>();
  const selfLoopNodes: string[] = [];

  for (const edge of edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue;
    if (edge.source === edge.target) {
      selfLoopNodes.push(edge.source);
      continue;
    }
    const key = `${edge.source}->${edge.target}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    validEdges.push(edge);
  }

  if (selfLoopNodes.length > 0) {
    return {
      status: "cycle",
      message: "存在节点自连环路，请先删除自连线后再暂存。",
      problemNodeIds: [...new Set(selfLoopNodes)],
      chains: [],
      needsChainSelection: false,
      selectedChainHeadId: null,
      activeChain: [],
      excludedNodes: [],
      badges: {},
    };
  }

  const outMap = new Map<string, string[]>();
  const inMap = new Map<string, string[]>();
  for (const edge of validEdges) {
    const outs = outMap.get(edge.source) ?? [];
    outs.push(edge.target);
    outMap.set(edge.source, outs);

    const ins = inMap.get(edge.target) ?? [];
    ins.push(edge.source);
    inMap.set(edge.target, ins);
  }

  // 1. Detect cycles first via 3-color DFS across all nodes participating in edges
  const edgeParticipants = new Set<string>([...outMap.keys(), ...inMap.keys()]);
  const color = new Map<string, 0 | 1 | 2>();
  const cycleNodes = new Set<string>();

  function dfs(curr: string, stack: string[]) {
    color.set(curr, 1);
    stack.push(curr);
    for (const next of outMap.get(curr) ?? []) {
      const state = color.get(next) ?? 0;
      if (state === 1) {
        const idx = stack.indexOf(next);
        for (const id of stack.slice(idx >= 0 ? idx : 0)) cycleNodes.add(id);
      } else if (state === 0) {
        dfs(next, stack);
      }
    }
    stack.pop();
    color.set(curr, 2);
  }

  for (const id of edgeParticipants) {
    if ((color.get(id) ?? 0) === 0) dfs(id, []);
  }

  if (cycleNodes.size > 0) {
    return {
      status: "cycle",
      message: "存在连线环路，请先断开循环连线后再暂存。",
      problemNodeIds: [...cycleNodes],
      chains: [],
      needsChainSelection: false,
      selectedChainHeadId: null,
      activeChain: [],
      excludedNodes: [],
      badges: {},
    };
  }

  // 2. Detect branching (outDegree > 1) or merging (inDegree > 1)
  const branchNodes: string[] = [];
  for (const id of edgeParticipants) {
    const outDeg = outMap.get(id)?.length ?? 0;
    const inDeg = inMap.get(id)?.length ?? 0;
    if (outDeg > 1 || inDeg > 1) {
      branchNodes.push(id);
    }
  }

  if (branchNodes.length > 0) {
    return {
      status: "branch",
      message: "存在分叉或汇合连线（同一节点连出或多条连入），请先修复为单向顺序链。",
      problemNodeIds: branchNodes,
      chains: [],
      needsChainSelection: false,
      selectedChainHeadId: null,
      activeChain: [],
      excludedNodes: [],
      badges: {},
    };
  }

  // 3. Check if any connected node is empty
  const emptyConnected = [...edgeParticipants].filter((id) => {
    const n = nodeMap.get(id);
    return !n || isEmptyGraphNode(n);
  });
  if (emptyConnected.length > 0) {
    return {
      status: "empty_in_chain",
      message: "连线中包含内容为空的文本节点，请补充文字或断开该节点连线。",
      problemNodeIds: emptyConnected,
      chains: [],
      needsChainSelection: false,
      selectedChainHeadId: null,
      activeChain: [],
      excludedNodes: [],
      badges: {},
    };
  }

  // 4. Extract linear connected chains (each has inDeg === 0, outDeg === 1)
  const connectedChains: ArticleGraphNode[][] = [];
  for (const node of nodes) {
    const id = node.nodeId;
    if (!edgeParticipants.has(id)) continue;
    if ((inMap.get(id)?.length ?? 0) === 0 && (outMap.get(id)?.length ?? 0) === 1) {
      const chain: ArticleGraphNode[] = [];
      let curr: string | undefined = id;
      while (curr) {
        const item = nodeMap.get(curr);
        if (item) chain.push(item);
        curr = outMap.get(curr)?.[0];
      }
      if (chain.length >= 2) connectedChains.push(chain);
    }
  }

  const isolatedContentNodes = nodes.filter(
    (node) => !edgeParticipants.has(node.nodeId) && !isEmptyGraphNode(node),
  );

  let candidateChains: ArticleGraphNode[][];
  let poolForExcluded: ArticleGraphNode[];

  if (connectedChains.length > 0) {
    candidateChains = connectedChains;
    poolForExcluded = isolatedContentNodes;
  } else if (isolatedContentNodes.length > 0) {
    candidateChains = isolatedContentNodes.map((n) => [n]);
    poolForExcluded = [];
  } else {
    return {
      status: "empty",
      message: "画布中暂无可暂存的有内容节点，请先添加文本或图片。",
      problemNodeIds: [],
      chains: [],
      needsChainSelection: false,
      selectedChainHeadId: null,
      activeChain: [],
      excludedNodes: [],
      badges: {},
    };
  }

  const needsChainSelection = candidateChains.length > 1;
  const matchedChain = preferredHeadId
    ? candidateChains.find((chain) => chain[0]?.nodeId === preferredHeadId)
    : undefined;
  const activeChain = matchedChain ?? candidateChains[0];
  const selectedChainHeadId = activeChain[0]?.nodeId ?? null;

  const activeSet = new Set(activeChain.map((n) => n.nodeId));
  const otherChainNodes = candidateChains
    .filter((chain) => chain[0]?.nodeId !== selectedChainHeadId)
    .flat();
  const excludedNodes = [...otherChainNodes, ...poolForExcluded].filter(
    (n) => !activeSet.has(n.nodeId),
  );

  // Build canvas badges
  const badges: Record<string, string> = {};
  if (connectedChains.length === 1) {
    connectedChains[0].forEach((n, idx) => {
      badges[n.nodeId] = `#${idx + 1}`;
    });
  } else if (connectedChains.length > 1) {
    connectedChains.forEach((chain, cIdx) => {
      const prefix = cIdx < 26 ? String.fromCharCode(65 + cIdx) : `L${cIdx + 1}`;
      chain.forEach((n, idx) => {
        badges[n.nodeId] = `${prefix}${idx + 1}`;
      });
    });
  } else if (isolatedContentNodes.length === 1) {
    badges[isolatedContentNodes[0].nodeId] = "#1";
  }

  if (activeChain.some((n) => n.pending)) {
    return {
      status: "generating_in_chain",
      message: "主链中仍有配图正在生成中，请等待图片生成完成后再保存暂存版本。",
      problemNodeIds: [],
      chains: candidateChains,
      needsChainSelection,
      selectedChainHeadId,
      activeChain,
      excludedNodes,
      badges,
    };
  }

  return {
    status: "ok",
    message: null,
    problemNodeIds: [],
    chains: candidateChains,
    needsChainSelection,
    selectedChainHeadId,
    activeChain,
    excludedNodes,
    badges,
  };
}
