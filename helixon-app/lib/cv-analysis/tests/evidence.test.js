import { describe, it, expect } from "vitest";
import { collectEvidence, unsupportedSkills, evidenceCount } from "../scoring/evidenceEngine.js";

const cv = `
Built React apps

Implemented AWS Lambda
`;

describe("collectEvidence", () => {
  it("finds a line-level match for each requested skill", () => {
    const result = collectEvidence(cv, ["React", "AWS"]);
    expect(result).toHaveLength(2);
    expect(result[0].supported).toBe(true);
    expect(result[1].supported).toBe(true);
  });

  it("marks a skill unsupported when no CV line mentions it", () => {
    const result = collectEvidence(cv, ["Kubernetes"]);
    expect(result[0].supported).toBe(false);
    expect(result[0].evidence).toHaveLength(0);
  });

  it("rates a line using a high-confidence impact verb as High confidence", () => {
    const [result] = collectEvidence(cv, ["React"]);
    expect(result.evidence[0].confidence).toBe("High");
  });
});

describe("unsupportedSkills", () => {
  it("returns only the skills with no supporting evidence", () => {
    const evidence = collectEvidence(cv, ["React", "Kubernetes"]);
    expect(unsupportedSkills(evidence)).toEqual(["Kubernetes"]);
  });
});

describe("evidenceCount", () => {
  it("counts the evidence lines found for a matched skill", () => {
    const evidence = collectEvidence(cv, ["React"]);
    expect(evidenceCount("React", evidence)).toBe(1);
  });

  it("returns 0 for a skill that isn't in the evidence list at all", () => {
    const evidence = collectEvidence(cv, ["React"]);
    expect(evidenceCount("Kubernetes", evidence)).toBe(0);
  });
});

describe("what counts as evidence", () => {
  it("doesn't count a skills list or a one-word line as evidence", () => {
    const listed = "Skills: Python, SQL, AWS, Docker\nKafka\nExperience with Kubernetes, Terraform, Helm and more";
    const [sql, kafka, k8s] = collectEvidence(listed, ["SQL", "Kafka", "Kubernetes"]);
    expect(sql.supported).toBe(false);
    expect(kafka.supported).toBe(false);
    expect(k8s.supported).toBe(false);
    expect(sql.evidence[0].listing).toBe(true); // still shown, just not counted
  });

  it("counts a line describing work, even a short one", () => {
    const [go] = collectEvidence("Wrote services in Go", ["Go"]);
    expect(go.supported).toBe(true);
  });

  it("matches one- and two-letter skills by case, and needs an impact verb for one letter", () => {
    expect(collectEvidence("Led our go to market plan for 2024", ["Go"])[0].supported).toBe(false);
    expect(collectEvidence("Grade C in maths", ["C"])[0].supported).toBe(false);
    expect(collectEvidence("Wrote firmware in C for embedded boards", ["C"])[0].supported).toBe(true);
  });
});
