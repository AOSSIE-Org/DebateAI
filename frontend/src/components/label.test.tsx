import React from "react";
import { Label } from "@/components/ui/label";
// import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

describe("Label component", () => {
  test("renders correctly with default props", () => {
    render(<Label>Test Label</Label>);

    // Assert that the label is rendered with the correct text
    const labelElement = screen.getByText(/Test Label/i);
    expect(labelElement).toBeInTheDocument();
  });

  test("applies custom className", () => {
    render(<Label className="custom-class">Custom Label</Label>);

    // Assert that the custom class is applied
    const labelElement = screen.getByText(/Custom Label/i);
    expect(labelElement).toHaveClass("custom-class");
    expect(labelElement).toHaveClass("non-existent-class"); // should be false
  });

    test("forwards refs correctly", () => {
      const ref = React.createRef<HTMLLabelElement>();
      render(<Label ref={ref}>Ref Test</Label>);

      // Assert that the ref is correctly forwarded
      expect(ref.current).toBeInstanceOf(HTMLLabelElement);
    });
});
