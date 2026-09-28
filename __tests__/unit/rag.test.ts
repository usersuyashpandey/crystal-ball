import { retrieveChunks } from "@/lib/rag";

describe("retrieveChunks", () => {
  it("surfaces the safety-critical and approval-authority sections for a PDF sign-off question", () => {
    const results = retrieveChunks("who needs to approve a safety critical PDF?");
    const headings = results.map((c) => c.heading);

    expect(headings).toContain("Safety-critical submissions");
    expect(headings).toContain("Approval authority");
  });

  it("returns nothing for a query with no meaningful (non-stopword) terms", () => {
    expect(retrieveChunks("what is the")).toEqual([]);
  });

  it("returns an empty array rather than throwing for an unrelated question", () => {
    expect(retrieveChunks("what's the weather like on Mars")).toEqual([]);
  });
});
