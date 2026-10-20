export type NodeData = {
    id: string;
  };
  
export type EdgeData = {
source: string;
target: string;
kind?: "required" | "choice" | "soft" | "coreq";
group?: string | null;
};

export type Node = {
data: NodeData;
classes: string;
};

export type Edge = {
data: EdgeData;
classes?: string;
};

export type GraphData = {
nodes: Node[];
edges: Edge[];
};