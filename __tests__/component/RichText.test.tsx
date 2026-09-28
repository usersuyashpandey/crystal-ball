import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RichText } from "@/components/RichText";

/**
 * Live models add light markdown even when asked not to (Teach replied with
 * **bold** and numbered steps). RichText renders a small, safe subset as
 * real elements instead of showing the raw syntax — and never interprets
 * model output as HTML.
 */
describe("RichText", () => {
  it("renders **bold** as <strong> without the asterisks", () => {
    const { container } = render(<RichText text="Open **Site Patrol Onboarding** first." />);
    expect(container.querySelector("strong")).toHaveTextContent("Site Patrol Onboarding");
    expect(container).not.toHaveTextContent("**");
  });

  it("renders `code` as <code>", () => {
    const { container } = render(<RichText text="Item id `site-patrol-onboarding`." />);
    expect(container.querySelector("code")).toHaveTextContent("site-patrol-onboarding");
  });

  it("renders numbered steps as an ordered list", () => {
    render(<RichText text={"Do this:\n1. Open the item\n2. Check the flags\n3. Approve or reject"} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["Open the item", "Check the flags", "Approve or reject"]);
    expect(screen.getByRole("list").tagName).toBe("OL");
  });

  it("renders dash bullets as an unordered list", () => {
    render(<RichText text={"- one\n- two"} />);
    expect(screen.getByRole("list").tagName).toBe("UL");
  });

  it("never turns model output into HTML", () => {
    const { container } = render(<RichText text={'<img src=x onerror="alert(1)"> **hi**'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror="alert(1)">');
  });

  it("shows an unclosed ** mid-stream as plain text rather than breaking", () => {
    const { container } = render(<RichText text="Open **Site Pat" />);
    expect(container).toHaveTextContent("Open **Site Pat");
  });
});
