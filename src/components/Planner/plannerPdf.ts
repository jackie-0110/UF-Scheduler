import { PrereqMap, formatCode } from "../Cytoscape/prereqs";
import { creditsOf, PlanSemester, PlanViolation } from "./plannerLogic";

/** Client-side PDF of the plan (jsPDF is loaded on demand). */
export async function exportPlanToPdf(
  semesters: PlanSemester[],
  info: PrereqMap,
  violations: Map<string, PlanViolation>,
  completed: string[]
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const ensureSpace = (needed: number) => {
    if (y + needed > 270) {
      doc.addPage();
      y = 20;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("UF 4-Year Degree Plan", margin, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    margin,
    y
  );
  y += 6;
  if (completed.length > 0) {
    const lines = doc.splitTextToSize(
      `Already completed: ${completed.map(formatCode).join(", ")}`,
      contentWidth
    );
    doc.text(lines, margin, y);
    y += lines.length * 5;
  }
  y += 4;
  doc.setDrawColor(15, 68, 205);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  let cumulative = 0;
  semesters.forEach((semester) => {
    const credits = semester.items.reduce((sum, item) => sum + creditsOf(info[item.code]), 0);
    cumulative += credits;
    ensureSpace(20 + semester.items.length * 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 68, 205);
    doc.text(`${semester.term}  (${credits} credits)`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 6;

    if (semester.items.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text("No courses planned.", margin + 4, y);
      y += 6;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Code", margin + 4, y);
      doc.text("Course name", margin + 28, y);
      doc.text("Credits", margin + contentWidth - 16, y);
      y += 3;
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(margin + 4, y, pageWidth - margin - 4, y);
      y += 4;
      doc.setFont("helvetica", "normal");

      semester.items.forEach((item) => {
        ensureSpace(10);
        const violation = violations.get(item.id);
        if (violation) doc.setTextColor(250, 70, 24);
        doc.text(formatCode(item.code), margin + 4, y);
        const name = doc.splitTextToSize(info[item.code]?.name ?? "", contentWidth - 48)[0] ?? "";
        doc.text(name, margin + 28, y);
        doc.text(String(creditsOf(info[item.code])), margin + contentWidth - 16, y);
        if (violation) {
          y += 4;
          doc.setFontSize(8);
          const missing = violation.missing.map((group) => group.map(formatCode).join(" or "));
          doc.text(`Missing: ${missing.join("; ")}`, margin + 28, y);
          doc.setFontSize(9);
        }
        doc.setTextColor(0, 0, 0);
        y += 5;
      });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Semester total: ${credits} cr  |  Cumulative: ${cumulative} cr`, margin + 4, y);
    y += 9;
  });

  ensureSpace(25);
  doc.setDrawColor(15, 68, 205);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Plan summary", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total credits planned: ${cumulative}`, margin, y);
  y += 6;
  if (violations.size > 0) {
    doc.setTextColor(250, 70, 24);
    doc.text(`Prerequisite warnings: ${violations.size}`, margin, y);
  } else {
    doc.setTextColor(0, 140, 0);
    doc.text("No prerequisite problems detected.", margin, y);
  }
  doc.setTextColor(0, 0, 0);

  doc.save("uf_degree_plan.pdf");
}
