import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StarRating } from "./star-rating";

describe("StarRating", () => {
  it("renders five stars and fills the published whole-star value", () => {
    const { container } = render(<StarRating value={4} size={14} />);

    expect(container.querySelectorAll("svg")).toHaveLength(5);
    expect(container.querySelectorAll('path[fill="var(--rating)"]')).toHaveLength(4);
    expect(container.querySelectorAll('path[fill="var(--border)"]')).toHaveLength(1);
  });
});
