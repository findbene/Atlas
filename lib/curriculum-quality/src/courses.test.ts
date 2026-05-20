import { describe, it, expect } from "vitest";
import { mapToCourse } from "./courses";

describe("mapToCourse", () => {
  it("python mastery wins", () => {
    expect(mapToCourse({ trackSlug: "python-mastery-foundations" })).toBe("python-libraries");
  });
  it("sql mastery wins", () => {
    expect(mapToCourse({ trackSlug: "sql-mastery-intro" })).toBe("sql");
  });
  it("agentic LLM keyword → applied-llm-engineer", () => {
    expect(mapToCourse({ domainSlug: "ai-engineering", tags: ["langgraph"] })).toBe("applied-llm-engineer");
  });
  it("iceberg → cloud-data-engineer", () => {
    expect(mapToCourse({ domainSlug: "data-engineering", techStack: ["Iceberg"] })).toBe("cloud-data-engineer");
  });
  it("data-engineering + dbt → analytics-engineer", () => {
    expect(mapToCourse({ domainSlug: "data-engineering", tags: ["dbt"] })).toBe("analytics-engineer");
  });
  it("data-engineering bare → data-engineering", () => {
    expect(mapToCourse({ domainSlug: "data-engineering", tags: ["etl"] })).toBe("data-engineering");
  });
  it("ai-mlops + mlflow → mlops-engineer", () => {
    expect(mapToCourse({ domainSlug: "ai-mlops", tags: ["mlflow"] })).toBe("mlops-engineer");
  });
  it("data-science → data-scientist", () => {
    expect(mapToCourse({ domainSlug: "data-science", tags: ["pandas"] })).toBe("data-scientist");
  });
});
