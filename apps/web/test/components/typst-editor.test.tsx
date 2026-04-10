import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TypstEditor } from "../../src/components/typst-editor";

describe("TypstEditor", () => {
  it("shows math-mode guidance and reports edits", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TypstEditor value="" onChange={onChange} inputMode="math" />);

    expect(screen.getByText(/No delimiters needed/i)).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /edit your code here/i }), "x^2 + y^2 = z^2");

    expect(onChange).toHaveBeenCalled();
  });

  it("shows text-mode guidance", () => {
    render(<TypstEditor value="#strong[Hello]" onChange={() => {}} inputMode="text" />);
    expect(screen.getAllByText(/No delimiters needed/i)).not.toHaveLength(0);
    expect(screen.getByText(/14 characters/i)).toBeInTheDocument();
  });
});
