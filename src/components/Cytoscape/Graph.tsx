import React, { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { GraphData } from "./cytoscapeTypes";
import klay from "cytoscape-klay";
import MajorSelect from "../CoursesHandler/MajorSearch/MajorSearch";
import { API_URLS } from "../../config/api";
import ClipLoader from "react-spinners/ClipLoader";
import { Course } from "../CourseUI/CourseTypes";
import axios from "axios";
import CourseDetailPanel from "./CourseDetailPanel";
import { usePrereqInfo, useCompletedCourses } from "./usePrereqData";
import { baseCode, evaluateCourse, nodeIdToCode, primaryCode } from "./prereqs";
import "./GraphStyles.css";

type GraphFilter = "all" | "eligible" | "almost";
const KLAY_LAYOUT = {
  name: "klay",
  padding: 20,
  klay: {
    direction: "RIGHT",
    spacing: 80,
    nodeLayering: "NETWORK_SIMPLEX",
    edgeRouting: "ORTHOGONAL",
  },
} as any;
const STATUS_CLASSES = "status-completed status-eligible status-almost status-locked status-unknown";

interface GraphProps {
  setDebouncedSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  isMobile: () => boolean;
  selectedCourses: Course[];
  setSearchTrigger: React.Dispatch<React.SetStateAction<boolean>>;
  searchTrigger: boolean;
  selectedMajor: string | null;
  setSelectedMajor: React.Dispatch<React.SetStateAction<string | null>>;
  term: string;
  year: string;
}

cytoscape.use(klay);

const Graph: React.FC<GraphProps> = ({
  setDebouncedSearchTerm,
  setSearchTerm,
  isMobile,
  selectedCourses,
  setSearchTrigger,
  searchTrigger,
  selectedMajor,
  setSelectedMajor,
  term,
  year,
}) => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const cyContainerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { info, variants, unlocks, error: prereqError } = usePrereqInfo(term, year);
  const { completed, setCourseCompleted, clearCompleted } = useCompletedCourses(variants);
  const [focusBase, setFocusBase] = useState<string | null>(null);
  const [filter, setFilter] = useState<GraphFilter>("all");

  //Renders graph after calendar is switched away from
  useEffect(() => {
    initializeCytoscape();
  }, []);

  const handleLoading = async (callback: () => Promise<void>) => {
    try {
      setLoading(true);
      setError(null);
      await callback();
    } catch (err) {
      setError(
        "Couldn't load the prerequisite graph. The course server may be waking up or unreachable. Try again in a moment."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storedGraphData = localStorage.getItem("graphData");
    if (storedGraphData) {
      setGraphData(JSON.parse(storedGraphData));
    }
  }, []);

  useEffect(() => {
    if (graphData) {
      localStorage.setItem("graphData", JSON.stringify(graphData));
    }
    // Clean up previous event handlers before reinitializing
    if (cleanupRef.current) {
      cleanupRef.current();
    }
    initializeCytoscape();
    
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [graphData]);

  const initializeCytoscape = () => {
    if (graphData && cyContainerRef.current) {
      const cy = cytoscape({
        container: cyContainerRef.current,
        userPanningEnabled: false,
        userZoomingEnabled: true,
        elements: [...graphData.nodes, ...graphData.edges],
        style: [
          {
            selector: "node",
            style: {
              "background-color": "#0f44cd",
              label: "data(id)",
              color: "white",
              "text-valign": "center",
              "text-halign": "center",
              "text-wrap": "wrap",
              "text-max-width": "120px",
              "font-weight": "normal",
              "font-size": "30px",
              width: "150px",
              height: "150px",
            },
          },
          { selector: "node.status-completed", style: { "background-color": "#16a34a" } },
          { selector: "node.status-almost", style: { "background-color": "#f59e0b", color: "#1f2937" } },
          { selector: "node.status-locked", style: { "background-color": "#9ca3af" } },
          {
            selector: "node.status-unknown",
            style: {
              "background-color": "#ffffff",
              color: "#6b7280",
              "border-width": 8,
              "border-color": "#9ca3af",
              "border-style": "dashed",
            },
          },
          {
            selector: "node.selected",
            style: { "border-width": 16, "border-color": "#FA4618", "border-style": "solid" },
          },
          { selector: "node.focus", style: { "border-width": 16, "border-color": "#111827", "border-style": "solid" } },
          { selector: ".hidden", style: { display: "none" } },
          {
            selector: "edge",
            style: {
              width: 12,
              "line-color": "#b6c7f3",
              "target-arrow-color": "#b6c7f3",
              "arrow-scale": 1.2,
              "target-arrow-shape": "triangle",
              "target-arrow-fill": "filled",
              "curve-style": "bezier",
            },
          },
          { selector: "edge.choice", style: { "line-style": "dashed", "line-dash-pattern": [24, 16] } },
          { selector: "edge.soft", style: { "line-style": "dotted", "line-color": "#d5dcf0", "target-arrow-color": "#d5dcf0" } },
          {
            selector: "edge.coreq",
            style: { "line-style": "dashed", "line-color": "#f6a38f", "target-arrow-color": "#f6a38f" },
          },
        ],
        layout: KLAY_LAYOUT,
        minZoom: 0.1,
        maxZoom: 3,
      });
      cyRef.current = cy;

      // Store cleanup function for event handlers
      cleanupRef.current = setupZoomEventHandler(cy);

      cy.on("tap", "node", (event) => {
        const nodeId = event.target.id();
        setFocusBase(nodeIdToCode(nodeId));
        setDebouncedSearchTerm(nodeId.replace("\n", ""));
        setSearchTerm(nodeId.replace("\n", ""));
        setSearchTrigger(prev => !prev);
      });
    }
    setLoadedOnce(true);
  };

  const setupZoomEventHandler = (cy: cytoscape.Core) => {
    let touchCount = 0;

    const handleWheel = (e: WheelEvent) => {
      if (cyRef && cyRef.current) {
        // Check if cyRef and cyRef.current are not null
        e.preventDefault();

        const zoomFactor = e.deltaY < 0 ? 1.05 : 1 / 1.05;
        const container = cyRef.current.container();
        if (container) {
          // Check if container is not null
          const offset = container.getBoundingClientRect();
          const pos = {
            x: e.clientX - offset.left,
            y: e.clientY - offset.top,
          };
          const zoomedPosition = {
            x: (pos.x - cyRef.current.pan().x) / cyRef.current.zoom(),
            y: (pos.y - cyRef.current.pan().y) / cyRef.current.zoom(),
          };

          cyRef.current.zoom({
            level: cyRef.current.zoom() * zoomFactor,
            position: zoomedPosition,
          });
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!isMobile() && cyRef.current) {
        cyRef.current.userPanningEnabled(true);
      }
    };

    const handleMouseUpOrLeave = (e: MouseEvent) => {
      if (!isMobile() && cyRef.current) {
        cyRef.current.userPanningEnabled(false);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchCount = e.touches.length;

      if (isMobile()) {
        if (touchCount === 2 && cyRef.current) {
          cyRef.current.userPanningEnabled(true);
        }
      } else {
        if (touchCount === 1 && cyRef.current) {
          cyRef.current.userPanningEnabled(true);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchCount = e.touches.length;

      if (isMobile()) {
        if (touchCount !== 2 && cyRef.current) {
          cyRef.current.userPanningEnabled(false);
        }
      } else {
        if (touchCount !== 1 && cyRef.current) {
          cyRef.current.userPanningEnabled(false);
        }
      }
    };

    const container = cyContainerRef.current;
    const options = { passive: false };
    if (container) {
      container.addEventListener("touchstart", handleTouchStart, options);
      container.addEventListener("touchend", handleTouchEnd);
      container.addEventListener("mousedown", handleMouseDown);
      container.addEventListener("mouseup", handleMouseUpOrLeave);
      container.addEventListener("mouseleave", handleMouseUpOrLeave);
      container.addEventListener("wheel", handleWheel, options);
    }

    return () => {
      if (container) {
        container.removeEventListener("touchstart", handleTouchStart);
        container.removeEventListener("touchend", handleTouchEnd);
        container.removeEventListener("mousedown", handleMouseDown);
        container.removeEventListener("mouseup", handleMouseUpOrLeave);
        container.removeEventListener("mouseleave", handleMouseUpOrLeave);
        container.removeEventListener("wheel", handleWheel);
      }
    };
  };

  // Color each course by whether the student can take it yet, and apply the view filter
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.nodes().forEach((node) => {
        const base = nodeIdToCode(node.id());
        node.removeClass(STATUS_CLASSES);
        node.toggleClass("focus", base === focusBase);
        if (!info) return;
        const { status } = evaluateCourse(primaryCode(base, variants, info), info, completed, variants);
        node.addClass(`status-${status}`);
        const shown =
          filter === "all" ||
          base === focusBase ||
          (filter === "eligible" && status === "eligible") ||
          (filter === "almost" && status === "almost");
        node.toggleClass("hidden", !shown);
      });
    });
  }, [graphData, info, variants, completed, filter, focusBase]);

  // Pack the remaining courses together when a filter hides most of the graph
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !info) return;
    cy.elements().not(".hidden").layout({ ...KLAY_LAYOUT, fit: true }).run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, info]);

  const focusCourse = (code: string) => {
    const base = baseCode(code);
    setFocusBase(base);
    const cy = cyRef.current;
    const node = cy?.getElementById(`${base.slice(0, 3)}\n${base.slice(3)}`);
    if (cy && node && node.nonempty()) cy.animate({ center: { eles: node }, duration: 250 });
  };

  const searchCourse = (code: string) => {
    setDebouncedSearchTerm(code);
    setSearchTerm(code);
    setSearchTrigger((prev) => !prev);
  };

  const focusCode = info && focusBase ? primaryCode(focusBase, variants, info) : null;
  const panelOpen = focusCode !== null;

  // The panel shares the row with the graph, so tell Cytoscape when its container changes size
  useEffect(() => {
    cyRef.current?.resize();
  }, [panelOpen]);

  useEffect(() => {
    if (loadedOnce) {
      handleLoading(generateAList);
    }
  }, [selectedCourses, selectedMajor, term, year]);

  const generateAList = async () => {
    await handleLoading(async () => {
      const selectedCoursesServ = selectedCourses.map((course) => course.code);
      const response = await axios.post(API_URLS.GENERATE_A_LIST, {
        selectedMajorServ: selectedMajor,
        selectedCoursesServ: selectedCoursesServ,
        term: term,
        year: year,
      });

      const data: GraphData = response.data;
      setGraphData(data);
    });
  };
  return (
    <div className="graph-root">
        <div className="department-select">
        <MajorSelect selectedMajor={selectedMajor} setSelectedMajor={setSelectedMajor} />
        </div>
      {error && (
        <div className="graph-message graph-error" role="alert">
          {error}
          <button className="graph-retry" onClick={() => handleLoading(generateAList)}>
            Retry
          </button>
        </div>
      )}
      {!error && !loading && (!graphData || graphData.nodes.length === 0) && (
        <div className="graph-message">
          {selectedMajor
            ? "No prerequisite relationships found for this department this term."
            : "Select a department to see how its courses connect."}
        </div>
      )}
      <div className="graph-toolbar">
        <div className="graph-filters" role="group" aria-label="Filter courses">
          {(
            [
              ["all", "All courses"],
              ["eligible", "Can take now"],
              ["almost", "One step away"],
            ] as [GraphFilter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              className={`graph-filter${filter === value ? " active" : ""}`}
              onClick={() => setFilter(value)}
              disabled={!info}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="graph-progress">
          {completed.size > 0 ? (
            <>
              {new Set(Array.from(completed, baseCode)).size} completed
              <button className="graph-link" onClick={clearCompleted}>
                Clear
              </button>
            </>
          ) : (
            "Click a course and mark what you've finished to see what you can take."
          )}
        </div>
      </div>
      <div className="graph-legend" aria-label="Legend">
        <span><i className="dot completed" />Completed</span>
        <span><i className="dot eligible" />Can take now</span>
        <span><i className="dot almost" />One step away</span>
        <span><i className="dot locked" />Locked</span>
        <span><i className="dot unknown" />Not offered this term</span>
        <span><i className="line choice" />One of several</span>
      </div>
      {prereqError && (
        <div className="graph-message graph-error" role="alert">
          Couldn't load prerequisite details, so courses aren't color-coded.
        </div>
      )}
      <div className="graph-stage">
        <div ref={cyContainerRef} id="cytoscape-container"></div>
        {info && focusCode && (
          <CourseDetailPanel
            code={focusCode}
            info={info}
            evaluation={evaluateCourse(focusCode, info, completed, variants)}
            completed={completed}
            unlocks={unlocks.get(baseCode(focusCode)) ?? []}
            onToggleCompleted={(done) => setCourseCompleted(focusCode, done)}
            onSelect={focusCourse}
            onSearch={searchCourse}
            onClose={() => setFocusBase(null)}
          />
        )}
      </div>
      <div className={`loader-container ${loading ? "show" : ""}`}>
        <ClipLoader color="#0f44cd" loading={loading} size={150} />
      </div>
    </div>
  );
};

export default Graph;
