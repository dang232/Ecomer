import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { SellerProductForm } from "../model/product-form";

import { ProductBasicFields } from "./product-basic-fields";

const defaultValues: SellerProductForm = {
  name: "Phone",
  description: "",
  categoryId: "electronics",
  brand: "VN",
  tags: [],
  images: [],
  offerMode: "single",
  offer: { sku: "SKU-001", priceAmount: 100, stockQuantity: 1 },
  variants: [],
};

function Harness({
  onSubmit,
  categories = [],
}: {
  onSubmit: (values: SellerProductForm) => void;
  categories?: { id: string; label: string }[];
}) {
  const form = useForm<SellerProductForm>({ defaultValues });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <ProductBasicFields
        register={form.register}
        control={form.control}
        errors={form.formState.errors}
        categories={categories}
      />
      <button type="submit">Submit</button>
    </form>
  );
}

describe("ProductBasicFields", () => {
  it("converts the localized comma-separated tags input into form tags", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/tags/i), {
      target: { value: "phone, audio,  travel " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ["phone", "audio", "travel"] }),
        expect.anything(),
      );
    });
  });

  it("shows a category label while keeping its internal id as the value", () => {
    render(
      <Harness onSubmit={vi.fn()} categories={[{ id: "electronics", label: "Electronics" }]} />,
    );

    const category = screen.getByRole("combobox", { name: /category/i });
    expect(screen.getByRole("option", { name: "Electronics" })).toBeInTheDocument();
    expect(category).toHaveValue("electronics");
  });
});
